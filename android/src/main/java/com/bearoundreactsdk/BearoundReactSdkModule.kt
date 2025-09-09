package com.bearoundreactsdk

import com.facebook.react.bridge.*
import com.facebook.react.module.annotations.ReactModule
import org.bearound.sdk.BeAround

@ReactModule(name = BearoundReactSdkModule.NAME)
class BearoundReactSdkModule(private val ctx: ReactApplicationContext) :
  NativeBearoundReactSdkSpec(ctx) {

  companion object {
    const val NAME = "BearoundReactSdk"
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
      sdk.initialize(ctx.applicationInfo.icon, "", true)
      beAround = sdk
      promise?.resolve(null)
    } catch (t: Throwable) {
      try { beAround?.stop() } catch (_: Throwable) {}
      beAround = null
      promise?.reject("INIT_ERROR", t)
    }
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
}
