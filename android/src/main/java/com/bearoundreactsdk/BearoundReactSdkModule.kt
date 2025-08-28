package com.bearoundreactsdk

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.bearound.sdk.BeAround
import com.facebook.react.bridge.Arguments

@ReactModule(name = BearoundReactSdkModule.NAME)
class BearoundReactSdkModule(private val ctx: ReactApplicationContext) :
  NativeBearoundReactSdkSpec(ctx) {

  companion object {
    const val NAME = "BearoundReactSdk"
    private const val EVENT_BEACON = "bearound:beacon"
    private const val EVENT_STOPPED = "bearound:stopped"
  }

  private var beAround: BeAround? = null

  override fun getName() = NAME
  override fun initialize(
    clientToken: String?,
    debug: Boolean?,
    promise: Promise?
  ) {
    try {
      beAround?.stop()
      beAround = null

      val sdk = BeAround.getInstance(ctx.applicationContext)
//      sdk.setListener(object : BeAround.Listener {
//        override fun onBeaconDetected(beacon: org.altbeacon.beacon.Beacon) {
//          val m = Arguments.createMap().apply {
//            putString("uuid", beacon.id1?.toString() ?: "")
//            putString("major", beacon.id2?.toString() ?: "")
//            putString("minor", beacon.id3?.toString() ?: "")
//            putInt("rssi", beacon.rssi)
//            putString("bluetoothName", beacon.bluetoothName ?: "")
//            putString("bluetoothAddress", beacon.bluetoothAddress ?: "")
//            putDouble("distanceMeters", beacon.distance)
//          }
//          sendEvent(EVENT_BEACON, m)
//        }
//
//        override fun onMonitoringStopped() {
//          sendEvent(EVENT_STOPPED)
//        }
//      })

      sdk.initialize(ctx.applicationInfo.icon, "", true)
      beAround = sdk
      promise?.resolve(null)
    } catch (t: Throwable) {
      // fallback: tenta parar e reporta
      try { beAround?.stop() } catch (_: Throwable) {}
      beAround = null
      promise?.reject("INIT_ERROR", t)
    }
  }

  private fun sendEvent(event: String, params: WritableMap = Arguments.createMap()) {
    ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(event, params)
  }

  @ReactMethod
  override fun stop(promise: Promise) {
    try {
      beAround?.stop()
      beAround = null
      promise.resolve(null)
    } catch (t: Throwable) {
      promise.reject("STOP_ERROR", t)
    }
  }

  // Requisitos do EventEmitter em Android
  @ReactMethod
  override fun addListener(eventName: String) { /* RN tracking */ }

  @ReactMethod
  override fun removeListeners(count: Double) { /* RN tracking */ }
}
