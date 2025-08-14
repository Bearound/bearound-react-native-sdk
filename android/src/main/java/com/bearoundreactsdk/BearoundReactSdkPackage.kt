package com.bearoundreactsdk

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class BearoundReactSdkPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
    return if (name == BearoundReactSdkModule.NAME) {
      BearoundReactSdkModule(reactContext)
    } else null
  }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider {
    return ReactModuleInfoProvider {
      mapOf(
        BearoundReactSdkModule.NAME to ReactModuleInfo(
          BearoundReactSdkModule.NAME,
          BearoundReactSdkModule.NAME,
          false, /* canOverrideExistingModule */
          false, /* needsEagerInit */
          false, /* isCxxModule */
          true   /* isTurboModule */
        )
      )
    }
  }
}
