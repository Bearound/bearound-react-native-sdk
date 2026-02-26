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
import io.bearound.sdk.interfaces.BeAroundSDKListener
import io.bearound.sdk.models.Beacon
import io.bearound.sdk.models.BeaconMetadata
import io.bearound.sdk.models.MaxQueuedPayloads
import io.bearound.sdk.models.ScanPrecision
import io.bearound.sdk.models.UserProperties

@ReactModule(name = BearoundReactSdkModule.NAME)
class BearoundReactSdkModule(private val ctx: ReactApplicationContext) :
  NativeBearoundReactSdkSpec(ctx), BeAroundSDKListener {

  companion object {
    const val NAME = "BearoundReactSdk"
    private const val EVENT_BEACONS = "bearound:beacons"
    private const val EVENT_SYNC_LIFECYCLE = "bearound:syncLifecycle"
    private const val EVENT_BACKGROUND_DETECTION = "bearound:backgroundDetection"
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
      
      val scanPrecision = mapToScanPrecision(foregroundScanInterval.toInt())
      val maxQueued = mapToMaxQueuedPayloads(maxQueuedPayloads.toInt())

      // FIX: If SDK was already scanning, stop it first so new config takes effect
      val wasScanning = sdk.isScanning
      if (wasScanning) {
        sdk.stopScanning()
      }

      // Ensure listener is set before configure
      sdk.listener = this

      sdk.configure(
        businessToken = businessToken.trim(),
        scanPrecision = scanPrecision,
        maxQueuedPayloads = maxQueued
      )
      
      // If SDK was scanning before, restart with new configuration
      if (wasScanning) {
        sdk.startScanning()
      }
      
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("CONFIG_ERROR", t)
    }
  }

  override fun startScanning(promise: Promise) {
    try {
      // Ensure listener is set before starting scan
      sdk.listener = this
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
    // v2.2.1: Bluetooth scanning is now automatic - method deprecated
    // Maintained for backward compatibility but does nothing
    promise.resolve(null)
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

  // BeAroundSDKListener callbacks (v2.2.1)
  
  override fun onBeaconsUpdated(beacons: List<Beacon>) {
    val payload = Arguments.createMap()
    payload.putArray("beacons", mapBeacons(beacons))
    sendEvent(EVENT_BEACONS, payload)
  }

  override fun onError(error: Exception) {
    val payload = Arguments.createMap()
    payload.putString("message", error.message ?: "Unknown error")
    sendEvent(EVENT_ERROR, payload)
  }

  override fun onScanningStateChanged(isScanning: Boolean) {
    val payload = Arguments.createMap()
    payload.putBoolean("isScanning", isScanning)
    sendEvent(EVENT_SCANNING, payload)
  }
  
  override fun onAppStateChanged(isInBackground: Boolean) {
    // Not needed for React Native - handled by framework
  }
  
  override fun onSyncStarted(beaconCount: Int) {
    val payload = Arguments.createMap()
    payload.putString("type", "started")
    payload.putInt("beaconCount", beaconCount)
    sendEvent(EVENT_SYNC_LIFECYCLE, payload)
  }
  
  override fun onSyncCompleted(beaconCount: Int, success: Boolean, error: Exception?) {
    val payload = Arguments.createMap()
    payload.putString("type", "completed")
    payload.putInt("beaconCount", beaconCount)
    payload.putBoolean("success", success)
    payload.putString("error", error?.message)
    sendEvent(EVENT_SYNC_LIFECYCLE, payload)
  }
  
  override fun onBeaconDetectedInBackground(beaconCount: Int) {
    val payload = Arguments.createMap()
    payload.putInt("beaconCount", beaconCount)
    sendEvent(EVENT_BACKGROUND_DETECTION, payload)
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

  private fun mapToScanPrecision(foregroundSeconds: Int): ScanPrecision {
    return when {
      foregroundSeconds <= 5 -> ScanPrecision.HIGH
      foregroundSeconds <= 20 -> ScanPrecision.MEDIUM
      else -> ScanPrecision.LOW
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
