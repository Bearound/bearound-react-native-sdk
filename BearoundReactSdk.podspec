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
  
  # Exact pin, kept in lockstep with the Android gradle dep (same native release).
  # Bumping is a deliberate, guarded step — see scripts/check-native-versions.mjs.
  s.dependency "BearoundSDK", "3.9.0"

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
