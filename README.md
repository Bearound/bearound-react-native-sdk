# 🐻 Bearound React Native SDK

Official SDK to integrate **Bearound's** secure BLE beacon detection into **React Native** apps (Android and iOS).
Aligned with Bearound native SDKs **3.4.2** (exact pins live in `android/build.gradle` and `BearoundReactSdk.podspec`, kept in lockstep by `scripts/check-native-versions.mjs`).

> ✅ Compatible with **New Architecture** (TurboModules) and also compatible with classic architecture.

---

## Table of Contents

* [Requirements](#requirements)
* [Installation](#installation)
* [Permission Configuration](#permission-configuration)
  * [Android – Manifest](#android--manifest)
  * [iOS – Info.plist and Background Modes](#ios--infoplist-and-background-modes)
* [Scan modes (Android)](#scan-modes-android)
* [iOS Background Integration (required)](#ios-background-integration-required)
* [Quick Start](#quick-start)
* [API](#api)
  * [Types](#types)
  * [Functions](#functions)
  * [Events](#events)
* [Best Practices](#best-practices)
* [Troubleshooting](#troubleshooting)
* [Migrating from 2.x](#migrating-from-2x)
* [License](#license)

> Cross-platform behavior of every event and getter (including iOS-only / Android-only gaps) is documented in [EVENT-PARITY.md](./EVENT-PARITY.md).

---

## Requirements

* **React Native** ≥ 0.73
* **Android**: minSdk **24+** (the library builds with `minSdkVersion 24`); Android 12+ requires the `BLUETOOTH_SCAN` runtime permission ("Nearby devices")
* **iOS**: iOS **13+** (recommended 15+), Bluetooth and Location enabled

> **Important:** The SDK **does not** work on iOS simulator for BLE (use physical device).

---

## Installation

In your React Native project:

```bash
# with yarn
yarn add @bearound/react-native-sdk

# or with npm
npm i @bearound/react-native-sdk
```

### iOS

In the `ios` folder:

```bash
cd ios
pod install
```

> The Podspec declares a **CocoaPods dependency** on the native `BearoundSDK` pod (exact version pin — see `BearoundReactSdk.podspec`), resolved automatically by `pod install`. If your `Podfile` uses `use_frameworks!`, prefer **static**:
>
> ```ruby
> use_frameworks! :linkage => :static
> ```

### Android

No additional Gradle configuration is needed beyond permissions. The native Android SDK is resolved as a module dependency.

---

## Permission Configuration

### Android – Manifest

**You normally don't need to add any permissions** — the native SDK declares them all and the Android manifest merger injects them into your app automatically. The SDK uses the **`connectedDevice` foreground-service model** (Bluetooth), **not** location.

> ⚠️ If you redeclare `BLUETOOTH_SCAN`, keep the `neverForLocation` flag (and add `xmlns:tools` to your `<manifest>` tag). If any declaration omits it, the flag is dropped from the merged manifest and Google treats the app as deriving location.

For reference, the SDK declares:

```xml
<!-- Bluetooth -->
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" tools:targetApi="s" />

<!-- Location: legacy only (BLE scan on API <= 30); not requested on API 31+ -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" android:maxSdkVersion="30" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" android:maxSdkVersion="30" />

<!-- Foreground service: connectedDevice (BLE) on Android 14+ -->
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE" />

<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
```

> **Runtime (Android 12+)**: request `BLUETOOTH_SCAN` and `POST_NOTIFICATIONS` at runtime. Because `BLUETOOTH_SCAN` is declared with `neverForLocation`, **no location permission is required** for scanning on API 31+. This package exposes a helper [`ensurePermissions`](#functions) to facilitate this.

### iOS – Info.plist and Background Modes

In `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>location</string>
  <string>processing</string>
  <string>bluetooth-central</string>
  <string>remote-notification</string>
</array>

<key>NSBluetoothAlwaysUsageDescription</key>
<string>We use Bluetooth to detect nearby beacons.</string>

<key>NSBluetoothPeripheralUsageDescription</key>
<string>We use Bluetooth to detect nearby beacons.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to identify nearby beacons.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location even in background to identify beacons.</string>
```

> **Important for terminated app detection:**
> - Waking the app on beacon detection is done by **CoreLocation region monitoring** (the `location` background mode + "Always" permission) — `fetch` does **not** wake the app for beacons; it only grants periodic background windows the SDK uses to sync queued data
> - `remote-notification` enables the **silent-push wake vector** — the only mechanism that resurrects a fully terminated app (see [iOS Background Integration](#ios-background-integration-required))
> - User must grant "Always" location permission
> - User must enable "Background App Refresh" in Settings > General > Background App Refresh

---

## Scan modes (Android)

> On **iOS** scanning is always system-managed (region monitoring + `BGTaskScheduler`). These modes are **Android-only**.

The SDK ships **two background-scan strategies** — **you pick per app**. Both already exist in the native SDK; you just choose which one to turn on.

### At a glance — what you gain

| | 🪶 Opportunistic *(default)* | 🛡️ Foreground service |
|---|---|---|
| **Best for** | casual presence, battery-first apps | real-time footfall, mission-critical presence |
| **You gain** | zero setup · **no Play video** · lowest battery | reliable detection that **survives app-kill & aggressive OEMs** |
| **You accept** | unpredictable latency · misses in deep background | persistent notification + Play demo video |

### Mode 1 — Opportunistic (no foreground service) · *default*

**What you gain:** no `FOREGROUND_SERVICE_CONNECTED_DEVICE` permission, **no Play demonstration video**, lowest battery.

```ts
import { startScanning } from '@bearound/react-native-sdk';

await startScanning(); // PendingIntent/AlarmManager — no foreground service
```

The OS delivers beacons via a `PendingIntent` scan re-armed by `AlarmManager` — it keeps working with the app **killed**, but the system decides *when* (throttled).

To fully drop the Play video, also remove the FGS permission the native SDK injects via manifest merge:

```xml
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE"
    tools:node="remove" />
```

### Mode 2 — Foreground service (`connectedDevice`)

**What you gain:** continuous, low-latency detection that **survives app-kill and aggressive OEMs** (Xiaomi/Huawei/Samsung) — the reliable path for footfall/presence.

```ts
import { startScanning, enableForegroundScanning } from '@bearound/react-native-sdk';

await startScanning();
// By default the notification shows the host app's own name (localized by the
// device) + a generic, localized subtitle ("Atualizando conteúdo" / "Updating
// content") — nothing about Bluetooth or reading data.
await enableForegroundScanning();

// Want a custom title/subtitle instead? Pass them explicitly:
// await enableForegroundScanning({ notificationTitle: 'My App', notificationText: 'Bluetooth active' });
```

> ⚠️ **Google Play:** the `connectedDevice` foreground service requires a Play Console declaration + **demonstration video**. In the **video/declaration**, frame the feature as *reading data from external Bluetooth devices* — never as location or proximity (stays consistent with `neverForLocation`). The persistent notification itself just shows the app name, which is enough to satisfy the perceptibility requirement.

### Trade-off

| | 🪶 Opportunistic | 🛡️ Foreground service |
|---|---|---|
| App in foreground | continuous | continuous |
| App in background | opportunistic, throttled | continuous |
| App killed / swiped away | relaunched by OS (PendingIntent) | process kept alive |
| Aggressive OEM (Xiaomi/Huawei) | ❌ killed | ✅ survives |
| Detection latency | unpredictable (s → min) | low (per scan precision) |
| Presence accuracy | low / medium | **high** |
| Battery | lower | higher |
| Persistent notification | none | yes (mandatory) |
| Extra permission | none | `FOREGROUND_SERVICE_CONNECTED_DEVICE` |
| **Google Play video** | ❌ not required | ✅ required |

### Advanced: WorkManager (client-side)

The SDK doesn't bundle WorkManager. For a predictable low-frequency sweep without a foreground service, schedule your own periodic worker (minimum interval **15 min**) that calls `startScanning()` for a short window and then `stopScanning()`. Trades latency for battery and avoids the Play video — presence lags by up to the chosen period.

---

## iOS Background Integration (required)

This section is the **consumer contract** for background and terminated-state operation. Without this wiring the SDK still works in foreground, but it **silently degrades** in background: terminated-state uploads never finalize, BGTasks never run, and the app is never woken once iOS kills it.

The snippets below are the example app **verbatim**: §1 is the **complete** `AppDelegate` and §2 + the usage-description strings in [Permission Configuration → iOS](#ios--infoplist-and-background-modes) together form the **complete** `Info.plist`. Copy them as-is (changing only the module name, marked in §1).

> **Template note:** §1 is the **Swift** `AppDelegate` (the React Native ≥ 0.77 default — `RCTReactNativeFactory` / `ReactNativeDelegate`). If your app still ships the older Objective-C `AppDelegate.mm` (common on RN 0.73–0.76), wire the **same** calls there instead, or migrate the target to the Swift template first (add a bridging header if needed).

### 1. AppDelegate wiring

This is the **complete** `AppDelegate` from the proven-working example (`example/ios/BearoundReactSdkExample/AppDelegate.swift`) — **copy it as-is** (changing only the module name, marked below). Every method here is load-bearing for background/terminated detection; nothing is optional or Firebase-specific. Two rules make it work:

- **Touch `BeAroundSDK.shared` synchronously** in `didFinishLaunchingWithOptions`, before the React Native bootstrap and before you `return`. Accessing it runs the SDK init, which auto-restores the saved config and **re-arms region monitoring** while the BLE state-restoration window is still open; the region-enter callback then fires asynchronously. The SDK delegate is a runtime object (not persisted), so it must be re-set **now** — deferring it to the async JS `configure()` path is too late and races the relaunch region event.
- **The class conforms to `UNUserNotificationCenterDelegate`** and imports `UserNotifications`, so foreground banners, APNs registration, and the silent-push handler are wired **unconditionally** — not hidden behind a Firebase check. These push methods cover the **user-force-quit** resurrection vector — the one case CoreLocation region monitoring cannot wake: `registerForRemoteNotifications()` obtains the APNs token, `didRegisterForRemoteNotificationsWithDeviceToken` forwards it, and `didReceiveRemoteNotification` handles the cold-launch silent push that arrives *before* the JS swizzle installs. (Background/terminated wake on beacon **entry** is driven separately by CoreLocation region monitoring — see §2.)

```swift
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
        NSLog("[Bearound] Notification permission granted")
      } else if let error = error {
        NSLog("[Bearound] Notification permission error: %@", error.localizedDescription)
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
      NSLog("[Bearound] App launched due to LOCATION event (beacon region entry)")
      postRelaunchNotification()
    }
    if launchOptions?[.bluetoothCentrals] != nil {
      NSLog("[Bearound] App launched due to BLUETOOTH event (state restoration)")
      postRelaunchNotification()
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "YourAppName", // 👈 replace with YOUR registered module name (AppRegistry.registerComponent / app.json "name")
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
    NSLog("[Bearound] Background fetch triggered")
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
    NSLog("[Bearound] APNs token registered (%d bytes)", deviceToken.count)
    BeAroundSDK.shared.setPushToken(token)
  }

  func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    // Common cause: the Push Notifications capability / aps-environment
    // entitlement is missing from the app target (nothing the SDK can fix).
    NSLog("[Bearound] APNs registration failed: %@", error.localizedDescription)
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
    NSLog("[Bearound] Silent push received (bearound) — triggering BLE refresh + sync")
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
    NSLog("[Bearound] handleEventsForBackgroundURLSession: %@", identifier)
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
    content.title = "App reactivated"
    content.body = "Bearound detected a beacon region in the background"
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
```

> The three APNs methods above (`registerForRemoteNotifications`, `didRegisterForRemoteNotificationsWithDeviceToken`, `didReceiveRemoteNotification`) do nothing without the **Push Notifications capability** (§3): if the signed `aps-environment` entitlement is missing, `didFailToRegisterForRemoteNotificationsWithError` fires and no token ever arrives.

### 2. Info.plist — background modes and BGTask identifiers

Declare the **full** `UIBackgroundModes` list and the two BGTask identifiers the SDK schedules:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>bluetooth-central</string>
  <string>fetch</string>
  <string>processing</string>
  <string>location</string>
  <string>remote-notification</string>
</array>

<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
  <string>io.bearound.sdk.sync</string>
  <string>io.bearound.sdk.processing</string>
</array>
```

Without the `BGTaskSchedulerPermittedIdentifiers` entries, `registerBackgroundTasks()` cannot register the SDK's BGTasks and iOS will never grant them execution time.

> These background-mode keys are only **half** of the Info.plist. Also add the four Bluetooth/Location **usage-description** strings — `NSBluetoothAlwaysUsageDescription`, `NSBluetoothPeripheralUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription` — from [Permission Configuration → iOS](#ios--infoplist-and-background-modes). Copy **only those `NS…UsageDescription` strings** from that section (its `UIBackgroundModes` block is the same one shown here — don't declare it twice). Without the usage strings, iOS silently denies Bluetooth/Location at runtime even with the background modes set.

### 3. Push Notifications capability (silent-push wake vector)

Enable the **Push Notifications** capability on your app target in Xcode (Signing & Capabilities → + Capability → Push Notifications). This adds the `aps-environment` entitlement.

Without it, the SDK's automatic APNs token capture silently gets **no token**, and the **silent-push wake vector — the only mechanism that resurrects a fully terminated app — never works**. Everything else still compiles and runs, which is exactly why this is easy to miss.

The capability **by itself yields no token** — something must trigger APNs registration. That trigger is the `application.registerForRemoteNotifications()` call wired in §1; without it, enabling the capability produces no APNs token and the silent-push wake vector stays dead.

### 4. Call `configure()` on app mount

Call `configure()` when your root component mounts (e.g. in a `useEffect`), **not** behind a button press. The SDK's push swizzle (automatic APNs token capture + silent-push handling) only installs once `configure()` runs in the process — if the user never taps the button after a relaunch, the app never registers for pushes in that process.

```tsx
useEffect(() => {
  BeAround.configure({ businessToken: 'your-business-token' });
}, []);
```

### 5. Using Firebase Messaging / disabled swizzling?

§1 already forwards the APNs token and handles the silent push directly on your `AppDelegate` — that explicit wiring is the **robust default, not an escape hatch**. The SDK *also* auto-captures the APNs token and consumes `bearound` silent pushes via `AppDelegate` swizzling as a fallback, but the swizzle is **intercepted whenever Firebase (or any other push library) swizzles first**. Relying on the swizzle alone is exactly how an app ends up with a **NULL push token in the backend** and no terminated-state wake (a real production failure we have seen). So keep the §1 wiring regardless of whether you use Firebase.

Two cases:

- **You own the `AppDelegate` (the §1 setup):** you're done. The raw APNs token is forwarded via `BeAroundSDK.shared.setPushToken(...)` in `didRegisterForRemoteNotificationsWithDeviceToken`, and the cold-launch silent push is handled in `didReceiveRemoteNotification`. Nothing else to do.
- **Firebase (or another library) owns the push delegates — or you opted out with `BearoundAppDelegateProxyEnabled = NO` in `Info.plist`:** the SDK's swizzle won't fire and your native `didRegister…` may never run. Forward the token from JS instead. On iOS, forward the **raw APNs token** (`messaging().getAPNSToken()`) — **not** the FCM token:

```ts
import { setPushToken } from '@bearound/react-native-sdk';

// e.g. from your Firebase Messaging token-refresh handler.
// On iOS forward the RAW APNs token, not the FCM token.
await setPushToken(token);
```

`setPushToken` is idempotent, so forwarding the same token from both the native delegate and JS is safe.

### 6. Verify it works

Foreground detection working is **not** proof that background/terminated detection is wired — every gap above fails **silently** while the app is open. Run these checks before you ship.

**Static config**

* `plutil -lint ios/YourApp/Info.plist` prints `OK`.
* `plutil -p ios/YourApp/Info.plist` shows **all five** background modes (`fetch`, `location`, `processing`, `bluetooth-central`, `remote-notification`) **and** both `BGTaskSchedulerPermittedIdentifiers` (`io.bearound.sdk.sync`, `io.bearound.sdk.processing`).
* Your app target's `.entitlements` contains `aps-environment`, and `CODE_SIGN_ENTITLEMENTS` points to it in **both** the Debug **and** Release build configurations — a Debug-only wiring builds fine but ships a Release/TestFlight build with no push entitlement.

**Runtime**

* `getAuthorizationStatus()` resolves `'always'` (not `'whenInUse'`) — Always location is what delivers region events in background/terminated state.
* Background App Refresh is **on** (Settings → General → Background App Refresh, plus the per-app toggle).
* On launch, the Xcode console prints `APNs token registered (… bytes)` — proof that `registerForRemoteNotifications()` → `setPushToken` fired. If you instead see `APNs registration failed`, the Push Notifications capability / `aps-environment` entitlement is missing (§3).

**End-to-end (the real test)**

* **Foreground:** walk near a real Bearound beacon — beacons appear in the list and a banner shows (proves `willPresent`).
* **Background:** background the app, walk into range — the "App reactivated" local notification fires.
* **Terminated:** force-quit the app (swipe up in the app switcher), then either walk into a beacon region **or** have the backend send the `bearound` silent push. Expect the "App reactivated" notification and, on next foreground, `getPersistedLog()` entries written while the app wasn't running, with `getPendingBatchCount()` draining to `0` (proves the background URLSession upload finalized via `handleEventsForBackgroundURLSession`).

---

## Quick Start

Three rules the snippet below follows — all come from how the SDK actually works:

1. **`configure()` runs on mount** (in a `useEffect`), **not** behind a button. The SDK's push swizzle (automatic APNs token capture + silent-push handling) only installs once `configure()` runs in the process — see [§4 of iOS Background Integration](#4-call-configure-on-app-mount).
2. **The Android permission gate depends on the OS version.** On Android 12+ the **only** permission that unlocks scanning is `BLUETOOTH_SCAN` ("Nearby devices") — location does **not** unlock BLE scan there (the SDK declares `neverForLocation`). On Android ≤ 11 it's the opposite: location is what unlocks scanning. Do **not** gate on `btConnect`/`backgroundLocation` — the SDK doesn't need them to scan, and on 12+ they can never all be granted (the location permissions are declared with `maxSdkVersion="30"`).
3. **Android background needs the foreground service.** For reliable background detection, call `enableForegroundScanning()` after `startScanning()` — it's what the proven-working example does. The opportunistic default is throttled by the OS and killed outright by aggressive OEMs (Xiaomi/Huawei/Samsung). It shows a persistent notification and needs a Play Console declaration + demo video — see [Scan modes](#scan-modes-android).

```tsx
import React, { useEffect } from 'react';
import { Alert, Button, View, Platform } from 'react-native';
import * as BeAround from '@bearound/react-native-sdk';
import { ensurePermissions } from '@bearound/react-native-sdk';

export default function App() {
  useEffect(() => {
    // On mount — installs the push swizzle in every process, including
    // background relaunches where the user never taps anything.
    BeAround.configure({
      businessToken: 'your-business-token',
      scanPrecision: BeAround.ScanPrecision.HIGH,
      maxQueuedPayloads: BeAround.MaxQueuedPayloads.MEDIUM,
    });
  }, []);

  const start = async () => {
    // askBackground: false — background location is NOT needed for scanning.
    // Only pass true if your app declares ACCESS_BACKGROUND_LOCATION itself
    // (the SDK doesn't); otherwise the request is auto-denied and the helper
    // bounces the user to Settings.
    const status = await ensurePermissions({ askBackground: false });

    const ok =
      Platform.OS === 'android'
        ? Number(Platform.Version) >= 31
          ? status.btScan // Android 12+: BLUETOOTH_SCAN is the only scan gate
          : status.fineLocation // Android ≤ 11: location unlocks BLE scan
        : true; // iOS: either eye works (Location OR Bluetooth) — don't hard-block

    if (!ok) {
      Alert.alert(
        'Permissions',
        Number(Platform.Version) >= 31
          ? 'Allow "Nearby devices" to detect beacons.'
          : 'Allow Location to detect beacons.'
      );
      return;
    }

    await BeAround.startScanning();
    if (Platform.OS === 'android') {
      // Reliable background detection on Android — the opportunistic default is
      // throttled by the OS and killed by aggressive OEMs. Android 13+: also
      // check status.notifications so the persistent notification is visible.
      await BeAround.enableForegroundScanning().catch(() => null);
    }
    Alert.alert('Bearound', 'SDK started successfully');
  };

  const stop = async () => {
    await BeAround.stopScanning();
    Alert.alert('Bearound', 'SDK stopped');
  };

  return (
    <View style={{ padding: 24 }}>
      <Button title="Start SDK" onPress={start} />
      <Button title="Stop SDK" onPress={stop} />
    </View>
  );
}
```

---

## API

### Types

```ts
export enum ScanPrecision {
  HIGH = 'high',    // continuous scanning, sync every 15s
  MEDIUM = 'medium', // 3 cycles/min (10s scan + 10s pause), sync every 60s
  LOW = 'low',      // 1 cycle/min (10s scan + 50s pause), sync every 60s
}

export enum MaxQueuedPayloads {
  SMALL = 50,
  MEDIUM = 100, // default
  LARGE = 200,
  XLARGE = 500,
}

export type SdkConfig = {
  businessToken: string; // required - your business token
  scanPrecision?: ScanPrecision; // defaults to HIGH (aligned with the iOS native default)
  maxQueuedPayloads?: MaxQueuedPayloads; // defaults to MEDIUM
};

export type UserProperties = {
  internalId?: string;
  email?: string;
  name?: string;
  customProperties?: Record<string, string>;
};

export type BeaconProximity = 'immediate' | 'near' | 'far' | 'bt' | 'unknown';

export type BeaconMetadata = {
  // Firmware identifier. As of native SDK 3.0.0 this is an integer encoded as
  // a string (e.g. "1"), NOT a semantic version ("2.1.0") as in 2.x.
  firmwareVersion: string;
  // Battery level. As of native SDK 3.0.0 this is in millivolts (e.g. 3269),
  // NOT a 0-100 percentage as in 2.x.
  batteryLevel: number;
  movements: number;
  temperature: number;
  txPower?: number;
  rssiFromBLE?: number;
  isConnectable?: boolean;
};

// iOS-only: which detector(s) saw the beacon ("two eyes" model —
// coreLocation = Location eye; serviceUUID/name = Bluetooth eye).
export type BeaconDiscoverySource = 'serviceUUID' | 'name' | 'coreLocation';

// Android-only: aggregated RSSI statistics over a sync window.
export type RssiStats = {
  count: number;
  min: number;
  max: number;
  avg: number;
  stdDev: number;
  firstSeen: number;
  lastSeen: number;
};

export type Beacon = {
  uuid: string;
  major: number;
  minor: number;
  rssi: number;
  proximity: BeaconProximity;
  accuracy: number;
  timestamp: number; // milliseconds since epoch
  metadata?: BeaconMetadata;
  txPower?: number;
  alreadySynced?: boolean; // whether this beacon was already synced to the ingest API
  syncedAt?: number; // epoch ms of the last successful sync, if any
  discoverySources?: BeaconDiscoverySource[]; // iOS-only
  rssiRaw?: number; // Android-only: raw (unsmoothed) RSSI of the latest sample
  rssiSamples?: RssiStats; // Android-only
  isStale?: boolean; // Android-only: not seen within the freshness window
};

export type SyncLifecycleEvent = {
  type: 'started' | 'completed';
  beaconCount: number;
  success?: boolean;
  error?: string;
};

export type BackgroundDetectionEvent = {
  beaconCount: number;
};

export type BearoundError = {
  message: string;
};
```

### Functions

```ts
// Configures the SDK (call before startScanning)
configure(config: SdkConfig): Promise<void>;

// Starts and stops scanning
startScanning(): Promise<void>;
stopScanning(): Promise<void>;
isScanning(): Promise<boolean>;

// User properties
setUserProperties(properties: UserProperties): Promise<void>;
clearUserProperties(): Promise<void>;

// Push token — forwards the token to the native SDK, which associates it with
// the device and sends it on the next sync (re-sent only when it changes or
// after the native heartbeat window).
// - Android: pass the FCM token. The native SDK also auto-collects it when
//   Firebase is present; this call is the explicit fallback.
// - iOS: forward the RAW APNs device token (hex), NOT the FCM token. The
//   example AppDelegate (§1) already forwards it from
//   didRegisterForRemoteNotificationsWithDeviceToken — that native wiring is the
//   robust default. Use THIS JS call when Firebase (or another library) owns the
//   push delegates so your native didRegister never runs, or when
//   BearoundAppDelegateProxyEnabled = NO. See "Using Firebase Messaging /
//   disabled swizzling?" above.
setPushToken(token: string): Promise<void>;

// Error telemetry opt-out (default: enabled). See "SDK error telemetry" below.
setErrorReportingEnabled(enabled: boolean): void;

// Event listeners
addBeaconsListener(listener: (beacons: Beacon[]) => void): EmitterSubscription;
addSyncLifecycleListener(listener: (event: SyncLifecycleEvent) => void): EmitterSubscription;
addBackgroundDetectionListener(listener: (event: BackgroundDetectionEvent) => void): EmitterSubscription;
addScanningListener(listener: (isScanning: boolean) => void): EmitterSubscription;
addErrorListener(listener: (error: BearoundError) => void): EmitterSubscription;
addBeaconRegionListener(listener: (event: BeaconRegionEvent) => void): EmitterSubscription;
addActiveScanListener(listener: (event: ActiveScanEvent) => void): EmitterSubscription;
addBluetoothZoneListener(listener: (event: BluetoothZoneEvent) => void): EmitterSubscription; // iOS-only event
addBluetoothScanModeListener(listener: (event: BluetoothScanModeEvent) => void): EmitterSubscription; // iOS-only event
addBluetoothStateListener(listener: (state: BluetoothState) => void): EmitterSubscription; // both platforms

// Diagnostics / state getters
getSdkVersion(): Promise<string>; // native SDK version (real value on both platforms)
getCurrentScanPrecision(): Promise<string>; // 'high' | 'medium' | 'low', or '' if not configured
getBleDiagnosticInfo(): Promise<string>; // iOS-only; Android returns ''
getPendingBatchCount(): Promise<number>; // failed sync batches queued for retry (real value on both platforms)
isConfigured(): Promise<boolean>; // whether configure() has run
isLocationAvailable(): Promise<boolean>; // whether device location services are enabled
getAuthorizationStatus(): Promise<AuthorizationStatus>; // iOS: 'always' | 'whenInUse' | ...; Android: its own permission-status string
getBluetoothState(): Promise<BluetoothState>; // current Bluetooth adapter state (both platforms)

// Location authorization (iOS-only; no-op on Android — use requestForegroundPermissions there)
requestLocationAuthorization(level?: 'always' | 'whenInUse'): Promise<void>;

// Persisted detection log (iOS-only; Android resolves [] / no-op)
// Entries are written natively on every event — including while the app is
// backgrounded or terminated — so JS can show what happened while it wasn't running.
getPersistedLog(): Promise<PersistedLogEntry[]>;
clearPersistedLog(): Promise<void>;

// Foreground-service scanning (Android-only; no-op on iOS)
enableForegroundScanning(config?: ForegroundScanConfig): Promise<void>;
disableForegroundScanning(): Promise<void>;
isForegroundScanningEnabled(): Promise<boolean>; // iOS always resolves false
setForegroundNotificationContent(content: NotificationContent): Promise<void>;

// Permission helper (Android + iOS)
ensurePermissions(opts?: { askBackground?: boolean }): Promise<{
  fineLocation: boolean;
  btScan: boolean;
  btConnect: boolean;
  notifications: boolean;
  backgroundLocation: boolean;
}>;

// Check current permission status
checkPermissions(): Promise<{
  fineLocation: boolean;
  btScan: boolean;
  btConnect: boolean;
  notifications: boolean;
  backgroundLocation: boolean;
}>;

// Request only foreground permissions (Android)
requestForegroundPermissions(): Promise<{
  fineLocation: boolean;
  btScan: boolean;
  btConnect: boolean;
  notifications: boolean;
  backgroundLocation: boolean;
}>;

// Request background location permission (Android)
requestBackgroundLocation(): Promise<boolean>;
```

> **`PermissionResult` semantics on iOS:** the iOS bridge checks a single thing —
> **location authorization** (`authorizedAlways` **or** `authorizedWhenInUse`).
> `fineLocation`, `btScan`, `btConnect` and `backgroundLocation` all mirror that one
> location boolean, and `notifications` is hardcoded `true` (never checked). In
> particular:
>
> * `btScan`/`btConnect` do **not** reflect the Bluetooth permission on iOS — use
>   [`getBluetoothState()`](#functions) instead (`'unauthorized'` means Bluetooth
>   permission was denied).
> * `backgroundLocation: true` does **not** mean "Always" was granted — it is `true`
>   with only When-In-Use. Use `getAuthorizationStatus()` to distinguish `'always'`
>   from `'whenInUse'` (terminated-app wake-up requires **Always**).
> * On iOS, `ensurePermissions`/`requestForegroundPermissions` trigger the system
>   location prompt (requesting Always) only while the status is `notDetermined`;
>   once denied they resolve `false` without prompting.
>
> On Android each field reflects the real status of its permission
> (`ACCESS_FINE_LOCATION`/`ACCESS_COARSE_LOCATION`, `BLUETOOTH_SCAN`,
> `BLUETOOTH_CONNECT`, `POST_NOTIFICATIONS`, `ACCESS_BACKGROUND_LOCATION`), but note
> the SDK manifest only declares the location permissions up to API 30 and does not
> declare `ACCESS_BACKGROUND_LOCATION` — so on Android 12+ `fineLocation` and
> `backgroundLocation` stay `false` unless your app declares them itself. Gate
> scanning as shown in [Quick Start](#quick-start), not on "all fields true".

> **`getBluetoothState()` on iOS — side effect:** the first call lazily creates the
> `CBCentralManager`, which triggers the system **Bluetooth permission prompt** if
> not yet determined. It is also what arms `addBluetoothStateListener` on iOS — the
> listener only starts emitting after the first `getBluetoothState()` call in the
> process (on Android it emits on adapter changes without any prior call).

### SDK error telemetry

The SDK ships lightweight, self-contained crash telemetry so we can spot and fix
SDK-side regressions in the field. It's installed automatically by `configure()`
and covers **three layers**:

- **Native (Android/iOS):** the embedded native SDKs capture their own crashes via
  their built-in error reporters.
- **React Native / JS:** this package additionally captures uncaught JS exceptions
  and unhandled promise rejections **that originate in the SDK's own JS layer**.

**Golden rules — it never gets in your way:**

- **Only the SDK's own errors are reported.** An error is sent only when its
  **first application stack frame** (skipping the RN runtime) is inside
  `@bearound/react-native-sdk` — i.e. the error *originated* in the SDK. Errors
  from your app code are ignored — including errors thrown inside your own
  callbacks that merely pass through the SDK — and the telemetry module never
  reports its own failures.
- **It never throws and never hijacks your handlers.** The global error handler is
  *chained*: the SDK stores your previous `ErrorUtils` handler and always delegates
  back to it, so your own crash reporter (Sentry, Crashlytics, etc.) keeps working
  unchanged.
- **Fire-and-forget and self-limiting.** Reports are posted best-effort to
  `https://ingest.bearound.io/sdk-errors` with a 5 s timeout, rate-limited to 20/hour
  and de-duplicated for 5 minutes. Nothing blocks your app.

Each report includes the error (type, message, stack, context), a device snapshot
(OS/version, permission state), and the SDK version/platform. If a `businessToken`
is set, it's sent as the `Authorization` header.

**Opting out:**

```ts
import { setErrorReportingEnabled } from '@bearound/react-native-sdk';

// Disable JS-layer SDK error reporting (default: enabled).
setErrorReportingEnabled(false);
```

> Opting out disables the **JS-layer** reporting exposed by this package. Native
> crash telemetry follows the embedded native SDKs' own behavior.

### Events

Available listeners:

* `addBeaconsListener` — fires with the detected beacons on every scan window.
* `addSyncLifecycleListener` — fires when a sync to the ingest API starts/completes.
* `addBackgroundDetectionListener` — fires when beacons are detected while the app is in background.
* `addScanningListener` — fires when scanning starts/stops.
* `addErrorListener` — fires on SDK errors.
* `addBeaconRegionListener` — fires on beacon region enter/exit transitions; outside the region only the low-power kernel filter scan is active.
* `addActiveScanListener` — fires when active-scan gating changes (BLE ranging + duty cycle run only while inside a beacon region).
* `addBluetoothZoneListener` — **iOS-only**: fires on Bluetooth-zone enter/exit (the "Bluetooth eye", backed by CBCentralManager, independent of CoreLocation). On Android the listener registers but never fires.
* `addBluetoothScanModeListener` — **iOS-only**: fires when the BLE scanner duty-cycle mode changes (`idle` ↔ `active`, with `nextIdleScanAt` when idle). On Android the listener registers but never fires.
* `addBluetoothStateListener` — fires on Bluetooth adapter state changes (`poweredOn`/`poweredOff`/`unauthorized`/...) on **both platforms** — use it to gate the Bluetooth eye independently of location. **iOS:** it only starts emitting after the first `getBluetoothState()` call in the process (which creates the underlying `CBCentralManager` and may show the Bluetooth permission prompt); call it once on mount if you rely on this listener.

```ts
import {
  addBeaconsListener,
  addSyncLifecycleListener,
  addBackgroundDetectionListener,
  addScanningListener,
  addErrorListener,
  addBluetoothStateListener,
} from '@bearound/react-native-sdk';

const beaconsSub = addBeaconsListener((beacons) => {
  console.log('Beacons', beacons);
});

const syncLifecycleSub = addSyncLifecycleListener((event) => {
  if (event.type === 'started') {
    console.log(`Sync started with ${event.beaconCount} beacons`);
  }
  if (event.type === 'completed') {
    console.log(`Sync ${event.success ? 'succeeded' : 'failed'}`);
  }
});

const backgroundDetectionSub = addBackgroundDetectionListener((event) => {
  console.log(`${event.beaconCount} beacons detected in background`);
});

const scanningSub = addScanningListener((isScanning) => {
  console.log('Scanning', isScanning);
});

const errorSub = addErrorListener((error) => {
  console.log('SDK error', error.message);
});

const bluetoothStateSub = addBluetoothStateListener((state) => {
  console.log('Bluetooth state', state);
});

// later (e.g. on unmount)
beaconsSub.remove();
syncLifecycleSub.remove();
backgroundDetectionSub.remove();
scanningSub.remove();
errorSub.remove();
bluetoothStateSub.remove();
```

---

## Best Practices

* **Platform-specific permissions**: Use permission helpers on Android/iOS before starting scans.
* Request permissions with user context (use `ensurePermissions`).
* **Android**: The foreground service uses your app's icon; ensure an appropriate icon.
* **iOS**: Always test on a physical device; enable **all five** Background Modes (`fetch`, `location`, `processing`, `bluetooth-central`, `remote-notification`) **and** the **Push Notifications** capability on the target — see [iOS Background Integration](#ios-background-integration-required).
* Avoid repeatedly starting/stopping in sequence; prefer a clear lifecycle.
* **Simplified architecture**: Beacon detection and processing happens natively.

---

## Troubleshooting

**No beacons detected (any platform)**

* Test with a **real Bearound beacon**. The SDK scans for Bearound's proprietary BLE advertisement (service data `0xBEAD`) — a **generic iBeacon, or a phone simulating one with nRF Connect, is NOT detected** by design.
* Call `configure()` before `startScanning()` — `startScanning()` without a prior `configure()` resolves without error but detects nothing. Check with `isConfigured()`.
* Verify the business token. An invalid token fails **silently** in the current version: beacons still appear locally, but every sync fails — watch `addSyncLifecycleListener` for `completed` events with `success: false`.
* Check Bluetooth: `getBluetoothState()` should resolve `'poweredOn'` (`'unauthorized'` on iOS means the Bluetooth permission was denied).

**Android 12+ (API 31+): permissions**

* `BLUETOOTH_SCAN` ("Nearby devices") is the **only** permission that unlocks scanning. It is declared with `neverForLocation`, so **granting Location does NOT unlock the BLE scan** — a device with Location granted but Nearby devices denied detects nothing.
* `POST_NOTIFICATIONS` (Android 13+) is only needed for the persistent notification of `enableForegroundScanning()` to be visible.
* `BLUETOOTH_CONNECT` and background location are **not** required for scanning.

**Android ≤ 11 (API ≤ 30): permissions**

* Fine (or coarse) **location** is what unlocks BLE scan results (Android platform requirement on these versions). The legacy `BLUETOOTH`/`BLUETOOTH_ADMIN` permissions arrive via manifest merge.

**Android: detection stops in background or after swipe-away**

* The default (opportunistic) mode is throttled by the OS and killed outright by aggressive OEMs (Xiaomi/Huawei/Samsung and others). For reliable background detection, use `enableForegroundScanning()` ([Mode 2](#mode-2--foreground-service-connecteddevice)) and ask the user to exempt the app from battery optimization / enable autostart in the OEM settings.
* Remember the Play cost of Mode 2: the `connectedDevice` foreground service requires a Play Console declaration **and a demonstration video** during review — see [Scan modes](#scan-modes-android).

**Android: scan throttled after rapid start/stop**

* Android silently throttles apps that start/stop BLE scans too frequently (more than ~5 starts in 30 s). Avoid `startScanning()`/`stopScanning()` loops; prefer a stable lifecycle.

**iOS: nothing detected in background / app never wakes**

* **Physical device only** — BLE does not work on the iOS simulator.
* Grant **Always** location: waking a terminated app on beacon entry relies on CoreLocation region monitoring, and Always is required. Check with `getAuthorizationStatus()` (must be `'always'`, not `'whenInUse'`).
* Enable **Background App Refresh** (Settings → General → Background App Refresh, and per-app): without it the SDK's BGTasks (sync/processing) never get execution time.
* The **silent-push wake vector** — the only mechanism that resurrects a fully terminated app — needs the Push Notifications capability and a delivered APNs token; see [iOS Background Integration](#ios-background-integration-required). If you use Firebase Messaging, forward the raw APNs token yourself via `setPushToken` (the swizzle won't fire).
* Force-quit (swipe up in the app switcher) suspends the Bluetooth eye until the app is relaunched — by region entry (CoreLocation) or silent push.
* Complete the AppDelegate + Info.plist wiring (background modes, BGTask identifiers) — see [iOS Background Integration](#ios-background-integration-required).
* **Foreground detects but background is completely dead?** Verify your app target's `Info.plist` actually contains all five `UIBackgroundModes` as a proper `<array>`. A truncated or malformed `Info.plist` (missing keys, or a partial file) still **builds and runs in the foreground**, but iOS silently drops the background modes — so scanning works while the app is open and stops the instant it's backgrounded. Confirm with `plutil -p ios/YourApp/Info.plist` (you must see `bluetooth-central`, `location`, `fetch`, `processing`, `remote-notification`) and `plutil -lint` (must print `OK`).

**iOS: compilation error involving headers/Codegen**

* Run `cd ios && pod install` after installing the package.
* Clean Derived Data in Xcode and recompile.
* If using `use_frameworks!`, prefer `:linkage => :static`.

---

## Migrating from 2.x

Version 3.x of this package tracks the native SDKs across their 3.0.0 major. If you are coming from `@bearound/react-native-sdk` 2.x:

* **`locationCapture` API removed** — native 3.x dropped beacon-triggered GPS capture. Remove `addLocationCaptureListener` and the `CapturedLocation`/`LocationCapture*` types; there is no replacement (the SDK no longer captures GPS coordinates).
* **`BeaconMetadata` semantics changed**: `batteryLevel` is now **millivolts** (e.g. `3269`), not a 0–100 percentage; `firmwareVersion` is now an integer encoded as a string (e.g. `"1"`), not a semver (`"2.1.0"`). Update any UI/analytics that parsed these.
* **Default `scanPrecision` is now `HIGH`** (was `MEDIUM`). Pass `scanPrecision: ScanPrecision.MEDIUM` explicitly to keep the 2.x duty cycle.
* Coming from **≤ 2.1.0**: `enableBluetoothScanning`/`enablePeriodicScanning` config flags were removed (always-on) and `addSyncStatusListener` was replaced by `addSyncLifecycleListener`.
* Everything else is additive — two-eyes listeners, persisted log, foreground-service APIs, diagnostics getters, `setPushToken` (3.4.1+). Full details per release in [CHANGELOG.md](./CHANGELOG.md); cross-platform behavior in [EVENT-PARITY.md](./EVENT-PARITY.md).

---

## License

MIT © Bearound
