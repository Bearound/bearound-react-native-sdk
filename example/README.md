# BeAroundScan — example app

Debug/demo app for `@bearound/react-native-sdk`. It mirrors the iOS native demo app: it **auto-configures and starts scanning on launch** (no button press needed) and exposes the SDK's full event surface in a dark-themed debug UI.

> Beacons: the SDK only detects **Bearound's proprietary beacons** (BLE service data `0xBEAD`). A generic iBeacon or a phone simulating one (nRF Connect) will not show up — you need a real Bearound beacon nearby.

## Business token

The token is hardcoded in [`src/App.tsx`](./src/App.tsx) (`configureSdk`, the `businessToken` field):

```ts
businessToken: 'ee2ec9c46d2b2ad99bddcdd0afe224e6',
```

This is a **public test token, published on purpose** so anyone can run the example against the Bearound ingest. To see devices/detections in *your* Control Hub, replace it with your own business token.

## Running

Install dependencies from the **repo root** (Yarn workspaces):

```sh
yarn
```

Then, in this folder:

```sh
# Start Metro
yarn start

# Android (device or emulator — detection needs a real device with BLE)
yarn android

# iOS (physical device only for BLE; first time: install pods)
bundle install               # once
bundle exec pod install      # in example/ios, after native dep changes
yarn ios
```

## What the UI demonstrates

| UI element | SDK API exercised |
|---|---|
| **Permissões** card | `checkPermissions()` / `ensurePermissions()`, `getBluetoothState()` + `addBluetoothStateListener` — shows the "two eyes" model: scanning works with Location **or** Bluetooth (`anyOf`), so it only warns when **neither** is available |
| **Informações do Scan / Sync** cards | `addSyncLifecycleListener` (started/completed, duration, success/failure), current `ScanPrecision` and `MaxQueuedPayloads` |
| **Debug Geofence** card | `addBeaconRegionListener` (region enter/exit), `addActiveScanListener` (ranging gating), rolling event log with live ages |
| **👁 👁 Dois Olhos** modal | Location eye vs Bluetooth eye side by side: `addBluetoothZoneListener`, `addBluetoothScanModeListener` (iOS-only; on Android the Bluetooth eye card shows as unavailable), per-eye beacon counts from `discoverySources` |
| **📋 Log** modal | `getPersistedLog()` / `clearPersistedLog()` — on iOS this is the **native persisted log** (survives restarts, records background/terminated wakes); on Android the SDK exposes no log API, so the modal shows a JS-side in-memory log only |
| **⚙︎ Settings** modal | Re-`configure()` at runtime with a different `ScanPrecision` / `MaxQueuedPayloads`; shows `getSdkVersion()` |
| Beacon cards | `addBeaconsListener` — RSSI, proximity, accuracy, `metadata` (battery in mV, temperature, movements, firmware), sync status (`alreadySynced`/`syncedAt`), iOS `discoverySources` badges, Android `rssiSamples`/`isStale` |
| Start/stop buttons | `configure()` → `startScanning()` / `stopScanning()`, plus `enableForegroundScanning()` on Android (see below) |

On Android, `startScan` also calls **`enableForegroundScanning()`** — the foreground-service mode ([Mode 2 in the root README](../README.md#scan-modes-android)) — so background detection survives swipe-away. The persistent notification shows just the app name.

## Testing background behavior (physical device)

### Android

1. Start the scan, then background the app (home button) — detection keeps running via the foreground service (persistent notification visible; on Android 13+ grant the notifications permission to see it).
2. Swipe the app away from recents — the service keeps the process alive; beacon events continue (watch the notification / Control Hub).
3. On aggressive OEMs (Xiaomi/Huawei/Samsung), also disable battery optimization for the app, or the OS may still kill it.

### iOS

1. Use a **physical device** (no BLE on simulator), grant **Always** location when prompted, and enable **Background App Refresh** for the app.
2. Background the app near a beacon → watch the **📋 Log** modal after reopening: entries tagged `background`/`backgroundLocked` were written natively while the UI was away.
3. Terminated test: background the app, wait for iOS to evict it (or reboot the device — do **not** force-quit from the app switcher, that's a different, user-intent state), then walk into beacon range. CoreLocation region entry relaunches the app; the log shows entries tagged `terminated`.
4. Silent push (the only wake vector after a force-quit) requires the Push Notifications capability and an APNs token — see [iOS Background Integration in the root README](../README.md#ios-background-integration-required). The example's `AppDelegate.swift` + `Info.plist` already carry the full wiring (delegate re-set, `registerBackgroundTasks()`, the five `UIBackgroundModes`, both `BGTaskSchedulerPermittedIdentifiers`) — copy them into your app as-is.

## Troubleshooting

See the [root README's Troubleshooting](../README.md#troubleshooting). For generic React Native environment issues (Metro, emulators, CocoaPods), see the [React Native docs](https://reactnative.dev/docs/environment-setup).
