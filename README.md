# 🐻 Bearound React Native SDK

Official SDK to integrate **Bearound's** secure BLE beacon detection into **React Native** apps (Android and iOS).
Aligned with Bearound native SDKs **2.3.0**.

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

<key>NSUserTrackingUsageDescription</key>
<string>We need permission to use IDFA on iOS 14+.</string>
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
      foregroundScanInterval: BeAround.ForegroundScanInterval.SECONDS_15,
      backgroundScanInterval: BeAround.BackgroundScanInterval.SECONDS_30,
      maxQueuedPayloads: BeAround.MaxQueuedPayloads.MEDIUM,
      // Bluetooth metadata and periodic scanning are automatic since v2.2.1
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
export enum ForegroundScanInterval {
  SECONDS_5 = 5,
  SECONDS_10 = 10,
  SECONDS_15 = 15, // default
  // ... up to SECONDS_60
}

export enum BackgroundScanInterval {
  SECONDS_15 = 15,
  SECONDS_30 = 30, // default
  SECONDS_60 = 60,
  SECONDS_90 = 90,
  SECONDS_120 = 120,
}

export enum MaxQueuedPayloads {
  SMALL = 50,
  MEDIUM = 100, // default
  LARGE = 200,
  XLARGE = 500,
}

export type SdkConfig = {
  businessToken: string; // required - your business token
  foregroundScanInterval?: ForegroundScanInterval; // defaults to SECONDS_15
  backgroundScanInterval?: BackgroundScanInterval; // defaults to SECONDS_30
  maxQueuedPayloads?: MaxQueuedPayloads; // defaults to MEDIUM
  enableBluetoothScanning?: boolean; // @deprecated v2.2.1 - ignored, always enabled
  enablePeriodicScanning?: boolean; // @deprecated v2.2.1 - ignored, automatic
};

export type UserProperties = {
  internalId?: string;
  email?: string;
  name?: string;
  customProperties?: Record<string, string>;
};

export type BeaconProximity = 'immediate' | 'near' | 'far' | 'bt' | 'unknown';

export type BeaconMetadata = {
  firmwareVersion: string;
  batteryLevel: number;
  movements: number;
  temperature: number;
  txPower?: number;
  rssiFromBLE?: number;
  isConnectable?: boolean;
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

// Optional settings
setBluetoothScanning(enabled: boolean): Promise<void>;
setUserProperties(properties: UserProperties): Promise<void>;
clearUserProperties(): Promise<void>;

// Event listeners
addBeaconsListener(listener: (beacons: Beacon[]) => void): EmitterSubscription;
addSyncLifecycleListener(listener: (event: SyncLifecycleEvent) => void): EmitterSubscription;
addBackgroundDetectionListener(listener: (event: BackgroundDetectionEvent) => void): EmitterSubscription;
addScanningListener(listener: (isScanning: boolean) => void): EmitterSubscription;
addErrorListener(listener: (error: BearoundError) => void): EmitterSubscription;

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

```ts
import {
  addBeaconsListener,
  addSyncLifecycleListener,
  addBackgroundDetectionListener,
  addScanningListener,
  addErrorListener,
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

// later (e.g. on unmount)
beaconsSub.remove();
syncSub.remove();
scanningSub.remove();
errorSub.remove();
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
