# 🐻 Bearound React Native SDK

Official SDK to integrate **Bearound's** secure BLE beacon detection into **React Native** apps (Android and iOS).

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
yarn add bearound-react-native-sdk

# or with npm
npm i bearound-react-native-sdk
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
  <string>bluetooth-central</string>
  <string>location</string>
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

> Enable **Background Modes** (Location + Bluetooth) in the app target.

---

## Quick Start

```tsx
import React from 'react';
import { Alert, Button, View, Platform } from 'react-native';
import * as BeAround from 'bearound-react-native-sdk';
import { ensurePermissions } from 'bearound-react-native-sdk';

export default function App() {
  const start = async () => {
    // Request permissions (Android only)
    if (Platform.OS === 'android') {
      const status = await ensurePermissions({ askBackground: true });
      const ok =
        status.fineLocation &&
        status.btScan &&
        status.btConnect &&
        status.notifications &&
        status.backgroundLocation;

      if (!ok) {
        Alert.alert('Permissions', 'Grant all permissions to start.');
        return;
      }
    }

    // Initialize SDK (permissions handled natively on iOS)
    await BeAround.initialize('<CLIENT_TOKEN>', true); // debug optional
    Alert.alert('Bearound', 'SDK started successfully');
  };

  const stop = async () => {
    await BeAround.stop();
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
export type Beacon = {
  uuid: string;
  major: string;
  minor: string;
  rssi: number;
  bluetoothName?: string;
  bluetoothAddress?: string;
  distanceMeters?: number;
};
```

### Functions

```ts
// Initializes the native SDK (Android/iOS) and starts monitoring
initialize(clientToken: string, debug?: boolean): Promise<void>;

// Stops monitoring and finalizes native resources
stop(): Promise<void>;

// Permission helper for Android (no-ops on iOS)
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

---

## Best Practices

* **Platform-specific permissions**: Use permission functions on Android only. iOS handles permissions natively during SDK initialization.
* Request permissions with user context (use `ensurePermissions`).
* **Android**: The foreground service uses your app's icon; ensure an appropriate icon.
* **iOS**: Always test on physical device; enable Background Modes in target.
* Avoid repeatedly initializing/stopping in sequence; prefer a clear lifecycle.
* **Simplified architecture**: The SDK no longer uses event listeners. All beacon detection and processing happens natively.

---

## Troubleshooting

**SDK doesn't start or detect beacons**

* Check **Location**/**Bluetooth** permissions (and Background on Android 10+).
* Test with a **physical beacon** (or app like nRF Connect).
* **iOS**: Permissions are requested natively during `initialize()`. Make sure Info.plist is configured correctly.
* **Android**: Use `ensurePermissions()` before calling `initialize()`.

**iOS: compilation error involving headers/Codegen**

* Run `cd ios && pod install` after installing the package.
* Clean Derived Data in Xcode and recompile.
* If using `use_frameworks!`, prefer `:linkage => :static`.

**Android: crash on restart**

* Avoid calling `initialize()` again without `stop()`. Some BLE scanners don't allow configuration changes after "consumers bound".

**Android permissions (API 31+)**

* Ensure `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` at runtime. Use `ensurePermissions`.

**Missing background location permission**

* **Android 10+**: Background location requires separate permission request after foreground location.
* **Android 12+**: Background location can be requested independently of fine location.

---

## License

MIT © Bearound