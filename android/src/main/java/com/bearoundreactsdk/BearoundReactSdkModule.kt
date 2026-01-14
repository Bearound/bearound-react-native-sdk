package com.bearoundreactsdk

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.module.annotations.ReactModule
import io.bearound.sdk.BeAroundSDK
import io.bearound.sdk.interfaces.BeAroundSDKDelegate
import io.bearound.sdk.models.BackgroundScanInterval
import io.bearound.sdk.models.Beacon
import io.bearound.sdk.models.BeaconMetadata
import io.bearound.sdk.models.ForegroundScanInterval
import io.bearound.sdk.models.MaxQueuedPayloads
import io.bearound.sdk.models.UserProperties

@ReactModule(name = BearoundReactSdkModule.NAME)
class BearoundReactSdkModule(private val ctx: ReactApplicationContext) :
  NativeBearoundReactSdkSpec(ctx), BeAroundSDKDelegate {

  companion object {
    const val NAME = "BearoundReactSdk"
    private const val EVENT_BEACONS = "bearound:beacons"
    private const val EVENT_SYNC = "bearound:sync"
    private const val EVENT_SCANNING = "bearound:scanning"
    private const val EVENT_ERROR = "bearound:error"
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  
  private val sdk: BeAroundSDK by lazy {
    if (Looper.myLooper() == Looper.getMainLooper()) {
      BeAroundSDK.getInstance(ctx.applicationContext)
    } else {
      var instance: BeAroundSDK? = null
      mainHandler.post {
        instance = BeAroundSDK.getInstance(ctx.applicationContext)
      }
      while (instance == null) {
        Thread.sleep(10)
      }
      instance!!
    }
  }

  override fun getName() = NAME

  override fun configure(
    businessToken: String,
    foregroundScanInterval: Double,
    backgroundScanInterval: Double,
    maxQueuedPayloads: Double,
    enableBluetoothScanning: Boolean,
    enablePeriodicScanning: Boolean,
    promise: Promise
  ) {
    try {
      if (businessToken.trim().isEmpty()) {
        promise.reject("INVALID_ARGUMENT", "Business token is required")
        return
      }
      
      val foregroundInterval = mapToForegroundScanInterval(foregroundScanInterval.toInt())
      val backgroundInterval = mapToBackgroundScanInterval(backgroundScanInterval.toInt())
      val maxQueued = mapToMaxQueuedPayloads(maxQueuedPayloads.toInt())
      
      sdk.configure(
        businessToken = businessToken.trim(),
        foregroundScanInterval = foregroundInterval,
        backgroundScanInterval = backgroundInterval,
        maxQueuedPayloads = maxQueued,
        enableBluetoothScanning = enableBluetoothScanning,
        enablePeriodicScanning = enablePeriodicScanning
      )
      sdk.delegate = this
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("CONFIG_ERROR", t)
    }
  }

  override fun startScanning(promise: Promise) {
    try {
      sdk.startScanning()
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("START_ERROR", t)
    }
  }

  override fun stopScanning(promise: Promise) {
    try {
      sdk.stopScanning()
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("STOP_ERROR", t)
    }
  }

  override fun isScanning(promise: Promise) {
    promise.resolve(sdk.isScanning)
  }

  override fun setBluetoothScanning(enabled: Boolean, promise: Promise) {
    try {
      sdk.setBluetoothScanning(enabled)
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("BT_SCAN_ERROR", t)
    }
  }

  override fun setUserProperties(properties: ReadableMap, promise: Promise) {
    try {
      val userProperties = mapUserProperties(properties)
      sdk.setUserProperties(userProperties)
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("USER_PROPERTIES_ERROR", t)
    }
  }

  override fun clearUserProperties(promise: Promise) {
    try {
      sdk.clearUserProperties()
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("USER_PROPERTIES_ERROR", t)
    }
  }

  override fun checkPermissions(promise: Promise) {
    promise.resolve(true)
  }

  override fun requestPermissions(promise: Promise) {
    promise.resolve(true)
  }

  override fun addListener(eventName: String) {
    // Required for NativeEventEmitter; events are emitted from the SDK delegate.
  }

  override fun removeListeners(count: Double) {
    // Required for NativeEventEmitter; no-op for now.
  }

  override fun didUpdateBeacons(beacons: List<Beacon>) {
    val payload = Arguments.createMap()
    payload.putArray("beacons", mapBeacons(beacons))
    sendEvent(EVENT_BEACONS, payload)
  }

  override fun didFailWithError(error: Exception) {
    val payload = Arguments.createMap()
    payload.putString("message", error.message ?: "Unknown error")
    sendEvent(EVENT_ERROR, payload)
  }

  override fun didChangeScanning(isScanning: Boolean) {
    val payload = Arguments.createMap()
    payload.putBoolean("isScanning", isScanning)
    sendEvent(EVENT_SCANNING, payload)
  }

  override fun didUpdateSyncStatus(secondsUntilNextSync: Int, isRanging: Boolean) {
    val payload = Arguments.createMap()
    payload.putInt("secondsUntilNextSync", secondsUntilNextSync)
    payload.putBoolean("isRanging", isRanging)
    sendEvent(EVENT_SYNC, payload)
  }

  private fun mapUserProperties(args: ReadableMap): UserProperties {
    val internalId = args.getString("internalId")
    val email = args.getString("email")
    val name = args.getString("name")
    val customMap = mutableMapOf<String, String>()

    val rawCustom = args.getMap("customProperties")
    if (rawCustom != null) {
      val iterator = rawCustom.keySetIterator()
      while (iterator.hasNextKey()) {
        val key = iterator.nextKey()
        val value = rawCustom.getString(key)
        if (value != null) {
          customMap[key] = value
        }
      }
    }

    return UserProperties(
      internalId = internalId,
      email = email,
      name = name,
      customProperties = customMap
    )
  }

  private fun mapBeacons(beacons: List<Beacon>): WritableArray {
    val array = Arguments.createArray()
    beacons.forEach { beacon ->
      array.pushMap(mapBeacon(beacon))
    }
    return array
  }

  private fun mapBeacon(beacon: Beacon): WritableMap {
    val map = Arguments.createMap()
    map.putString("uuid", beacon.uuid.toString())
    map.putInt("major", beacon.major)
    map.putInt("minor", beacon.minor)
    map.putInt("rssi", beacon.rssi)
    map.putString("proximity", beacon.proximity.toApiString())
    map.putDouble("accuracy", beacon.accuracy)
    map.putDouble("timestamp", beacon.timestamp.time.toDouble())

    beacon.metadata?.let { metadata ->
      map.putMap("metadata", mapMetadata(metadata))
    }

    beacon.txPower?.let { txPower ->
      map.putInt("txPower", txPower)
    }

    return map
  }

  private fun mapMetadata(metadata: BeaconMetadata): WritableMap {
    val map = Arguments.createMap()
    map.putString("firmwareVersion", metadata.firmwareVersion)
    map.putInt("batteryLevel", metadata.batteryLevel)
    map.putInt("movements", metadata.movements)
    map.putInt("temperature", metadata.temperature)
    metadata.txPower?.let { map.putInt("txPower", it) }
    metadata.rssiFromBLE?.let { map.putInt("rssiFromBLE", it) }
    metadata.isConnectable?.let { map.putBoolean("isConnectable", it) }
    return map
  }

  private fun sendEvent(name: String, payload: Any) {
    ctx.runOnUiQueueThread {
      ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(name, payload)
    }
  }

  private fun mapToForegroundScanInterval(seconds: Int): ForegroundScanInterval {
    return when (seconds) {
      5 -> ForegroundScanInterval.SECONDS_5
      10 -> ForegroundScanInterval.SECONDS_10
      15 -> ForegroundScanInterval.SECONDS_15
      20 -> ForegroundScanInterval.SECONDS_20
      25 -> ForegroundScanInterval.SECONDS_25
      30 -> ForegroundScanInterval.SECONDS_30
      35 -> ForegroundScanInterval.SECONDS_35
      40 -> ForegroundScanInterval.SECONDS_40
      45 -> ForegroundScanInterval.SECONDS_45
      50 -> ForegroundScanInterval.SECONDS_50
      55 -> ForegroundScanInterval.SECONDS_55
      60 -> ForegroundScanInterval.SECONDS_60
      else -> ForegroundScanInterval.SECONDS_15
    }
  }

  private fun mapToBackgroundScanInterval(seconds: Int): BackgroundScanInterval {
    return when (seconds) {
      15 -> BackgroundScanInterval.SECONDS_15
      30 -> BackgroundScanInterval.SECONDS_30
      60 -> BackgroundScanInterval.SECONDS_60
      90 -> BackgroundScanInterval.SECONDS_90
      120 -> BackgroundScanInterval.SECONDS_120
      else -> BackgroundScanInterval.SECONDS_30
    }
  }

  private fun mapToMaxQueuedPayloads(value: Int): MaxQueuedPayloads {
    return when (value) {
      50 -> MaxQueuedPayloads.SMALL
      100 -> MaxQueuedPayloads.MEDIUM
      200 -> MaxQueuedPayloads.LARGE
      500 -> MaxQueuedPayloads.XLARGE
      else -> MaxQueuedPayloads.MEDIUM
    }
  }
}
