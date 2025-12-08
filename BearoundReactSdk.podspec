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
  s.source       = { :git => "https://github.com/Bearound/bearound-react-native-sdk.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,cpp,swift}"
  s.private_header_files = "ios/**/*.h"
  
  s.dependency "BearoundSDK", "1.2.0"

  s.frameworks = "CoreBluetooth", "CoreLocation", "UIKit", "Foundation", "AdSupport"

  s.swift_version = '5.0'
  s.pod_target_xcconfig = {
     'CLANG_ENABLE_MODULES'  => 'YES',
     'DEFINES_MODULE'        => 'YES',
     'OTHER_CFLAGS'          => '$(inherited) -fmodules',
     'OTHER_CPLUSPLUSFLAGS'  => '$(inherited) -fcxx-modules -fmodules'
   }

  install_modules_dependencies(s)
end
