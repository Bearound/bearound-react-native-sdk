import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import BearoundSDK
import BearoundReactSdk
import UserNotifications

@main
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // CRITICAL — terminated/background relaunch path:
    // When iOS relaunches the app from a beacon-region event, accessing
    // BeAroundSDK.shared runs its init, which auto-restores the saved config and
    // RE-ARMS region monitoring synchronously. The region-enter callback then
    // fires asynchronously on the run loop. The SDK delegate is a runtime object
    // (not persisted), so it MUST be re-set NOW — before that callback fires —
    // otherwise didEnterBeaconRegion lands on a nil delegate and the persisted
    // log + local notification never happen. Doing this via the async JS
    // configure() path is too late and races the relaunch region event.
    BeAroundSDK.shared.delegate = RNBearoundBridge.shared

    // Register background tasks BEFORE app finishes launching
    BeAroundSDK.shared.registerBackgroundTasks()

    // Become the notification delegate so banners show while the app is in the
    // foreground (iOS suppresses them by default without willPresent → .banner).
    UNUserNotificationCenter.current().delegate = self

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

    // Register for remote (silent) push — the ONLY vector that wakes a
    // user-force-quit app on iOS. This triggers APNs registration; the raw
    // token arrives in didRegisterForRemoteNotificationsWithDeviceToken below.
    // Requires the app target to have the Push Notifications capability
    // (the signed `aps-environment` entitlement) — no SDK can add it for you.
    application.registerForRemoteNotifications()

    // If iOS relaunched us due to a region/bluetooth event, surface it immediately
    // (the SDK auto-restores scanning from storage; we don't reconfigure here so
    // the user's saved scan precision is preserved).
    if launchOptions?[.location] != nil {
      NSLog("[BearoundReactSdkExample] App launched due to LOCATION event (beacon region entry)")
      postRelaunchNotification()
    }
    if launchOptions?[.bluetoothCentrals] != nil {
      NSLog("[BearoundReactSdkExample] App launched due to BLUETOOTH event (state restoration)")
      postRelaunchNotification()
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

  // Raw APNs token → SDK. The backend pushes via APNs (not FCM), so we forward
  // the RAW device token. The SDK also auto-captures it via swizzle, but
  // forwarding explicitly is the robust path (the swizzle is intercepted when
  // Firebase is present). Idempotent — setting the same token twice is a no-op.
  func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    NSLog("[BearoundReactSdkExample] APNs token registered (%d bytes)", deviceToken.count)
    BeAroundSDK.shared.setPushToken(token)
  }

  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    // Common cause: the Push Notifications capability / aps-environment
    // entitlement is missing from the app target (nothing the SDK can fix).
    NSLog("[BearoundReactSdkExample] APNs registration failed: %@", error.localizedDescription)
  }

  // Silent push (cold-launch race): the SDK's push swizzle only installs once
  // configure() runs — in RN that's after JS boots. iOS delivers the
  // launch-triggering push before that, so handle it here. After configure(),
  // the SDK's swizzle consumes bearound pushes itself (no double-handling).
  func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    guard userInfo["bearound"] != nil else {
      completionHandler(.noData)
      return
    }
    NSLog("[BearoundReactSdkExample] Silent push received (bearound) — triggering BLE refresh + sync")
    BeAroundSDK.shared.performBackgroundBLERefreshAndSync(
      bleScanDuration: 10,
      trigger: "silent_push"
    ) { success in
      completionHandler(success ? .newData : .noData)
    }
  }

  // Background URLSession: iOS relaunches the app to deliver completed beacon-upload
  // transfers. Forward to the SDK so it finalizes the pending upload(s), invokes their
  // delegate callbacks (batch removal on success) and calls the system completion handler.
  // Without this, terminated-state uploads complete in nsurlsessiond but the app is never
  // re-attached to process the result.
  func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    NSLog("[BearoundReactSdkExample] handleEventsForBackgroundURLSession: %@", identifier)
    BeAroundSDK.shared.handleBackgroundURLSessionEvents(
      identifier: identifier,
      completionHandler: completionHandler
    )
  }

  // Present banners + sound while the app is in the FOREGROUND. Without this,
  // iOS silently drops notifications added while the app is active.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list, .sound, .badge])
  }

  private func postRelaunchNotification() {
    let content = UNMutableNotificationContent()
    content.title = "App reativado"
    content.body = "Bearound detectou uma região de beacon em segundo plano"
    content.sound = .default
    let request = UNNotificationRequest(
      identifier: "bearound-relaunch-\(UUID().uuidString)",
      content: content,
      trigger: nil
    )
    UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
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
