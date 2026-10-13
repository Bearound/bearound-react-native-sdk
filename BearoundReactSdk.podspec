require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "BearoundReactSdk"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = package["homepage"]
  s.license      = package["license"]
  s.authors      = package["author"]

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/Bearound/bearound-react-native-sdk.git", :tag => "v#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.private_header_files = "ios/**/*.h"
  
  if ENV["BEAROUND_APP_PRESENCE_LOCAL"] == "1"
    # Local native SDK (development only, opt-in, see scripts/app-presence-local-native.sh).
    # Require the version the local BearoundSDK.podspec declares, so the host's
    # `pod "BearoundSDK", :path => ...` never conflicts with the release pin below.
    ios_sdk_path = ENV["BEAROUND_IOS_SDK_PATH"].to_s
    native_podspec = File.join(ios_sdk_path, "BearoundSDK.podspec")
    unless ios_sdk_path.start_with?("/") && File.file?(native_podspec)
      raise "BEAROUND_APP_PRESENCE_LOCAL=1 requires BEAROUND_IOS_SDK_PATH to be the absolute path of a native iOS SDK checkout (got '#{ios_sdk_path}')."
    end
    unless File.file?(File.join(ios_sdk_path, "BearoundSDK", "Models", "AppPresence.swift"))
      raise "Native iOS SDK at #{ios_sdk_path} does not contain the app presence API."
    end
    s.dependency "BearoundSDK", Pod::Specification.from_file(native_podspec).version.to_s
  else
    # Exact pin, kept in lockstep with the Android gradle dep (same native release).
    # Bumping is a deliberate, guarded step: see scripts/check-native-versions.mjs.
    s.dependency "BearoundSDK", "3.16.0"
  end

  s.frameworks = "CoreBluetooth", "CoreLocation", "UIKit", "Foundation"

  s.swift_version = '5.0'
  s.pod_target_xcconfig = {
     'CLANG_ENABLE_MODULES'  => 'YES',
     'DEFINES_MODULE'        => 'YES',
     'OTHER_CFLAGS'          => '$(inherited) -fmodules',
     'OTHER_CPLUSPLUSFLAGS'  => '$(inherited) -fcxx-modules -fmodules',
     # React Native 0.86 ships React-Core as a prebuilt framework whose umbrella
     # header includes non-modular headers. Compiling this pod's generated
     # `-Swift.h` against it fails with "include of non-modular header inside
     # framework module" unless the check is relaxed for THIS target — which is
     # what every app on RN 0.86 (Expo SDK 57) would otherwise have to patch into
     # its own Podfile.
     'CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES' => 'YES'
   }

  install_modules_dependencies(s)
end
