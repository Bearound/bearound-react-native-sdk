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

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<!-- Bluetooth / Location / Foreground Service / Notifications -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
```

> **Runtime (Android 10+ / 12+)**: You **must** request `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `BLUETOOTH_SCAN` and `POST_NOTIFICATIONS` at runtime when applicable. This package exposes a helper [`ensurePermissions`](#functions) to facilitate this.

### iOS – Info.plist and Background Modes

In `Info.plist`:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>location</string>
  <string>processing</string>
  <string>bluetooth-central</string>
</array>

<key>NSBluetoothAlwaysUsageDescription</key>
<string>We use Bluetooth to detect nearby beacons.</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>We need your location to identify nearby beacons.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>We need your location even in background to identify beacons.</string>
```

> **Important for terminated app detection:**
> - `fetch` mode allows iOS to wake the app when beacons are detected via region monitoring
> - User must grant "Always" location permission
> - User must enable "Background App Refresh" in Settings > General > Background App Refresh

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
