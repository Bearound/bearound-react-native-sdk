package com.bearoundreactsdk

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
import io.bearound.sdk.models.Beacon
import io.bearound.sdk.models.BeaconMetadata
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

  private val sdk: BeAroundSDK by lazy {
    BeAroundSDK.getInstance(ctx.applicationContext)
  }

  init {
    sdk.delegate = this
  }

  override fun getName() = NAME

  override fun configure(
    businessToken: String,
    syncInterval: Double,
    enableBluetoothScanning: Boolean,
    enablePeriodicScanning: Boolean,
    promise: Promise
  ) {
    try {
      if (businessToken.trim().isEmpty()) {
        promise.reject("INVALID_ARGUMENT", "Business token is required")
        return
      }
      val intervalMs = (syncInterval * 1000).toLong()
      sdk.configure(
        businessToken = businessToken.trim(),
        syncInterval = intervalMs,
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
}
