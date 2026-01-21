import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import BearoundSDK
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // CRITICAL: Register background tasks BEFORE app finishes launching
    BeAroundSDK.shared.registerBackgroundTasks()
    
    // Check if app was relaunched due to location event (beacon region entry)
    if launchOptions?[.location] != nil {
      NSLog("[BearoundReactSdkExample] App launched due to LOCATION event (beacon region entry)")
    }
    
    // Request notification permissions for background alerts
    UNUserNotificationCenter.current().requestAuthorization(
      options: [.alert, .sound, .badge]
    ) { granted, error in
      if granted {
        NSLog("[BearoundReactSdkExample] Notification permission granted")
      } else if let error = error {
        NSLog("[BearoundReactSdkExample] Notification permission error: %@", error.localizedDescription)
      }
    }
    
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "BearoundReactSdkExample",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
  
  // Handle background fetch - called by iOS when app needs to refresh data
  func application(
    _ application: UIApplication,
    performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    NSLog("[BearoundReactSdkExample] Background fetch triggered")
    BeAroundSDK.shared.performBackgroundFetch { success in
      completionHandler(success ? .newData : .noData)
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
