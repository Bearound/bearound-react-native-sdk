# 🐻 Bearound React Native SDK

Official SDK to integrate **Bearound's** secure BLE beacon detection into **React Native** apps (Android and iOS).
Aligned with Bearound native SDKs **3.3.1**.

> ✅ Compatible with **New Architecture** (TurboModules) and also compatible with classic architecture.

---

## Table of Contents

* [Requirements](#requirements)
* [Installation](#installation)
* [Permission Configuration](#permission-configuration)
  * [Android – Manifest](#android--manifest)
  * [iOS – Info.plist and Background Modes](#ios--infoplist-and-background-modes)
* [iOS Background Integration (required)](#ios-background-integration-required)
* [Quick Start](#quick-start)
* [API](#api)
  * [Types](#types)
  * [Functions](#functions)
  * [Events](#events)
* [Best Practices](#best-practices)
* [Troubleshooting](#troubleshooting)
* [License](#license)

---

## Requirements

* **React Native** ≥ 0.73
* **Android**: minSdk **21+** (BLE), Android 12+ requires runtime BLE permissions
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

> The package already includes the native iOS framework as **vendored xcframework** in the Podspec. If your `Podfile` uses `use_frameworks!`, prefer **static**:
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

The snippets below mirror the example app (`example/ios/BearoundReactSdkExample/AppDelegate.swift` and `Info.plist`) — copy them as-is.

### 1. AppDelegate wiring

In `didFinishLaunchingWithOptions`, touch `BeAroundSDK.shared` **synchronously** and register the background tasks. Accessing `BeAroundSDK.shared` runs its init while the BLE state-restoration window is still open and sets up relaunch auto-resume — deferring it to the async JS `configure()` path is too late and races the relaunch event.

```swift
import BearoundSDK
import BearoundReactSdk

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
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

    // ... your React Native bootstrap (factory.startReactNative...) ...

    return true
  }

  // Handle background fetch - called by iOS when app needs to refresh data
  func application(
    _ application: UIApplication,
    performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    BeAroundSDK.shared.performBackgroundFetch { success in
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
    BeAroundSDK.shared.handleBackgroundURLSessionEvents(
      identifier: identifier,
      completionHandler: completionHandler
    )
  }
}
```

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

### 3. Push Notifications capability (silent-push wake vector)

Enable the **Push Notifications** capability on your app target in Xcode (Signing & Capabilities → + Capability → Push Notifications). This adds the `aps-environment` entitlement.

Without it, the SDK's automatic APNs token capture silently gets **no token**, and the **silent-push wake vector — the only mechanism that resurrects a fully terminated app — never works**. Everything else still compiles and runs, which is exactly why this is easy to miss.

### 4. Call `configure()` on app mount

Call `configure()` when your root component mounts (e.g. in a `useEffect`), **not** behind a button press. The SDK's push swizzle (automatic APNs token capture + silent-push handling) only installs once `configure()` runs in the process — if the user never taps the button after a relaunch, the app never registers for pushes in that process.

```tsx
useEffect(() => {
  BeAround.configure({ businessToken: 'your-business-token' });
}, []);
```

### 5. Using Firebase Messaging / disabled swizzling?

If another library owns the push delegates (e.g. Firebase Messaging with method swizzling), or you opted out via `BearoundAppDelegateProxyEnabled = NO` in Info.plist, the SDK's automatic capture won't fire — forward the token yourself.

**From JavaScript** (cross-platform): pass the token you already obtain — FCM on Android, raw APNs on iOS — to `setPushToken`:

```ts
import { setPushToken } from '@bearound/react-native-sdk';

// e.g. from your Firebase Messaging token-refresh handler
await setPushToken(token);
```

**Or natively from your AppDelegate** (iOS) — forward the APNs token and Bearound silent pushes to the SDK:

```swift
func application(
  _ application: UIApplication,
  didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
) {
  let token = deviceToken.map { String(format: "%02x", $0) }.joined()
  BeAroundSDK.shared.setPushToken(token)
}

func application(
  _ application: UIApplication,
  didReceiveRemoteNotification userInfo: [AnyHashable: Any],
  fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
) {
  // Bearound silent pushes carry a "bearound" key in the payload.
  guard userInfo["bearound"] != nil else {
    completionHandler(.noData)
    return
  }
  BeAroundSDK.shared.performBackgroundBLERefreshAndSync(
    bleScanDuration: 10,
    trigger: "silent_push"
  ) { success in
    completionHandler(success ? .newData : .noData)
  }
}
```

This is a **native-level escape hatch** — by design it is not part of the JS API.

---

## Quick Start

```tsx
import React from 'react';
import { Alert, Button, View, Platform } from 'react-native';
import * as BeAround from '@bearound/react-native-sdk';
import { ensurePermissions } from '@bearound/react-native-sdk';

export default function App() {
  const start = async () => {
    // Request permissions (Android + iOS)
    const status = await ensurePermissions({ askBackground: true });
    const ok =
      Platform.OS === 'android'
        ? status.fineLocation &&
          status.btScan &&
          status.btConnect &&
          status.notifications &&
          status.backgroundLocation
        : status.fineLocation;

    if (!ok) {
      Alert.alert('Permissions', 'Grant required permissions to start.');
      return;
    }

    await BeAround.configure({
      businessToken: 'your-business-token',
      scanPrecision: BeAround.ScanPrecision.HIGH,
      maxQueuedPayloads: BeAround.MaxQueuedPayloads.MEDIUM,
    });
    await BeAround.startScanning();
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
* `addBluetoothStateListener` — fires on Bluetooth adapter state changes (`poweredOn`/`poweredOff`/`unauthorized`/...) on **both platforms** — use it to gate the Bluetooth eye independently of location.

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
* **iOS**: Always test on physical device; enable Background Modes in target.
* Avoid repeatedly starting/stopping in sequence; prefer a clear lifecycle.
* **Simplified architecture**: Beacon detection and processing happens natively.

---

## Troubleshooting

**SDK doesn't start or detect beacons**

* Check **Location**/**Bluetooth** permissions (and Background on Android 10+).
* Test with a **physical beacon** (or app like nRF Connect).
* **iOS**: Use `ensurePermissions()` before calling `startScanning()` and keep Info.plist configured.
* **Android**: Use `ensurePermissions()` before calling `startScanning()`.

**iOS: compilation error involving headers/Codegen**

* Run `cd ios && pod install` after installing the package.
* Clean Derived Data in Xcode and recompile.
* If using `use_frameworks!`, prefer `:linkage => :static`.

**Android: crash on restart**

* Avoid calling `startScanning()` repeatedly without `stopScanning()`. Some BLE scanners don't allow frequent restarts.

**Android permissions (API 31+)**

* Ensure `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` at runtime. Use `ensurePermissions`.

**Missing background location permission**

* **Android 10+**: Background location requires separate permission request after foreground location.
* **Android 12+**: Background location can be requested independently of fine location.

---

## License

MIT © Bearound
