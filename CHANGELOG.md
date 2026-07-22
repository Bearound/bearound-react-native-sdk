# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [3.5.2] - 2026-07-22

### Changed

- **Android native SDK v3.5.0 → v3.5.2** (3.5.1 was never published for this wrapper; this release carries both). Scan reliability on modern Android 13+ (anti-downgrade refresh, pure-0xBEAD batch filter, PendingIntent kept armed in foreground), **continuous hardware-managed duty for MEDIUM/LOW** (no more scan-start-quota starvation), **adaptive foreground boost** (LOW_LATENCY whenever the app is in use — best detection automatically with the MEDIUM default), smooth beacon presence (10 s stale fade / 15 s eviction), **weak-receiver SoC profile** (Unisoc/Spreadtrum devices get doubled retention windows automatically), ghost-beacon fixes and precision-apply fix.
- Native version alignment check now requires the same **MAJOR.MINOR line** (patch may differ): platform-specific patches ship independently and the exact-pin rule forced an empty alignment release of the other platform for every patch.
- **Android native SDK v3.5.0 → v3.5.1.** Scan reliability on modern Android 13+ (periodic anti-downgrade scan refresh, batch-scan filter for pure-0xBEAD frames from firmware v4 beacons, PendingIntent scan kept armed in foreground), ghost-beacon fixes on the host list (expirations now reach the listener, including the empty list) and scan-precision changes now apply immediately on reconfigure. No JS API changes — all fixes live in the embedded native SDK. See the native SDK CHANGELOG for full details.

## [3.5.0] - 2026-07-14

### Added

- **Silent-push wake-up bridge (Android):** new `handleRemoteMessage(data)` — forward the FCM data message from your `@react-native-firebase/messaging` background handler and the SDK triggers an on-demand scan + sync (resolves `true` only for Bearound wake-ups, marked `bearound`). See README → *Silent-push wake-up (Android)*.

### Changed

- Wraps native **iOS 3.5.0** (BLE scan fix: `withServices: nil` + Service Data `0xBEAD` match — beacons detect again; regression since 2.3.2) and **Android v3.5.0** (silent-push wake-up + never-crash-the-host hardening).

## [3.4.5] - 2026-07-04

### Fixed

- **Never-crash-the-host hardening (Android bridge).** Three fixes from the cross-platform crash-safety audit: (1) the lazy native-SDK initializer posted `BeAroundSDK.getInstance` to the main Looper with no guard — a failure there would crash the HOST app on the main thread (outside every method-level guard) and leave a busy-wait spinning forever; it now captures the failure and rethrows on the caller thread, where it becomes a promise rejection the host can handle. (2) Every bridged method now resolves or rejects — the diagnostic getters (`isScanning`, `getPendingBatchCount`, `getBluetoothState`, the battery/autostart helpers, etc.) called the native SDK without the try/catch their mutator siblings had; an escaping `Throwable` from a `@ReactMethod` crashes the host process on Android. (3) `sendEvent` is gated on `hasActiveReactInstance` + try/catch — beacon callbacks arriving during a React reload/teardown threw an uncaught `RuntimeException` on the UI queue. Doctrine: the SDK may fail silently, but it must NEVER crash the host — and every silent failure is reported to `POST /sdk-errors`.
- **Android: FGS `connectedDevice` crash-loop (via native SDK 3.4.5).** Bumped the Android native SDK `3.4.2 → 3.4.5`, which fixes the foreground-service `connectedDevice` `SecurityException` crash-loop on Android 14+ when the user denies "Nearby devices". The RN wrapper exposes `enableForegroundScanning`, so it inherited this crash until now. iOS `BearoundSDK` bumped `3.4.2 → 3.4.5` in lockstep.
- **Permission flow no longer sabotages itself on Android 12+.** `requestForegroundPermissions()` now gates by API level: on Android 12+ it requests `BLUETOOTH_SCAN` (+ `BLUETOOTH_CONNECT`, and `POST_NOTIFICATIONS` on 13+) and **does not** request location — the scan is unlocked by `BLUETOOTH_SCAN` (the SDK asserts `neverForLocation`, so detection works with Bluetooth alone). On Android ≤ 11 it still requests fine location (coarse fallback).
- **`ensurePermissions()` no longer requests background location by default** and **never opens app Settings automatically.** Background location is not a scan requirement and, undeclared, resolves to `NEVER_ASK_AGAIN`; request it only via the explicit `{ askBackground: true }` opt-in. `requestBackgroundLocation()` returns the denial state instead of calling `Linking.openSettings()` — routing to Settings is now the host app's decision.
- **iOS `PermissionResult` reports real values.** `notifications` now comes from a real `UNUserNotificationCenter` check (was hardcoded `true`) and `backgroundLocation` is `true` only for `authorizedAlways` (When-In-Use no longer reported as background-capable). Android answers `checkNotificationPermission` via `NotificationManagerCompat`.

### Added

- **JS-layer SDK error telemetry.** `configure()` now installs a lightweight, isolated error reporter for the React Native / JS layer (parity with the native Android/iOS reporters, which already capture their own crashes). It captures **only** uncaught JS exceptions and unhandled promise rejections that ORIGINATE in `@bearound/react-native-sdk` — ownership is decided by the first application frame (skipping the RN/React/native runtime and the telemetry module), so a host error that merely passes through an SDK callback is never captured — and posts them fire-and-forget to `https://ingest.bearound.io/sdk-errors` (5 s timeout, rate-limited to 20/hour, de-duplicated for 5 min, stack capped at 8000 chars). It **never throws, never breaks the host app, and never hijacks your error handling** — the global `ErrorUtils` handler is chained and always delegates to the previously-installed handler. Opt out with the new `setErrorReportingEnabled(enabled: boolean)` (default: enabled). No new runtime dependencies.
- **Background reliability helpers (Android-only; native SDK 3.4.5), the Xiaomi/Huawei kill mitigation:** `isIgnoringBatteryOptimizations()`, `openBatteryOptimizationSettings()`, `isAutostartManageable()`, `openManufacturerAutostartSettings()`. iOS has no user-facing equivalent — `isIgnoringBatteryOptimizations()` resolves `true` and the others resolve `false`.

## [3.4.2] - 2026-06-27

### Fixed

- **Android: removed `USE_EXACT_ALARM` and `SCHEDULE_EXACT_ALARM` (via native SDK 3.4.2).** The SDK is not an alarm/calendar app and doesn't qualify for exact alarms on Google Play (Play Console requires removing it, otherwise it asks for the "Exact alarms" declaration). The scan watchdog now uses an **inexact** alarm (`setAndAllowWhileIdle`) — periodic scanning (WorkManager + watchdog) keeps working without the exact-alarm permission. iOS unaffected.

## [3.4.1] - 2026-06-27

### Fixed

- **Push token forwarding (was missing entirely).** Added the `setPushToken(token)` API across all layers (JS, TurboModule spec, Android, iOS). The native SDKs (3.4.0+) already accept a push token and send it on the next sync, but the React Native bridge never exposed it — so apps had no way to register their FCM/APNs token. `setPushToken` now forwards the token to the native SDK on both platforms (mirrors the Flutter 3.4.1 fix).
- **Order-proof push token (native SDKs 3.4.1).** `setPushToken`, when scanning is already active and the token hasn't been sent yet, forces a register immediately (`beacons:[]` + token) instead of waiting for the next sync — so the token reaches the backend regardless of whether the app calls `setPushToken` before or after `startScanning`.

## [3.4.0] - 2026-06-26

### Added

- **Device register on init** (via native SDKs 3.4.0). The device reports to the backend on `startScanning()` even before detecting a beacon, so it appears in the Control Hub on first launch. No API change — handled by the native SDK.
- **Scan modes documentation** in the README (opportunistic vs `connectedDevice` foreground service) with trade-offs and a WorkManager note.

### Changed

- **Foreground-service notification.** Title defaults to the host app's own name (`android:label`, localized by the device); subtitle is a generic, localized string ("Atualizando conteúdo" / "Updating content") — no Bluetooth or "reading data" wording. Clients can still override both.
- Bumped native SDKs to **3.4.0** (Android `bearound-android-sdk`, iOS `BearoundSDK`).

## [3.3.1] - 2026-06-11

Native SDKs bumped **2.4.0 → 3.3.1** (both platforms). This crosses the native 3.0.0 major, so the bridge surface changed accordingly.

### Breaking

- **`locationCapture` API removed.** Native SDK 3.x dropped beacon-triggered GPS capture, so the bridge removed:
  - `addLocationCaptureListener(listener)`
  - the `bearound:locationCapture` event channel
  - the types `CapturedLocation`, `LocationCaptureStartedEvent`, `LocationCaptureCompletedEvent`, `LocationCaptureEvent`
- **`BeaconMetadata` semantics changed** (native SDK 3.0.0):
  - `batteryLevel` is now in **millivolts** (e.g. `3269`), not a 0–100 percentage as in 2.x.
  - `firmwareVersion` is now an integer encoded as a string (e.g. `"1"`), not a semantic version (`"2.1.0"`) as in 2.x.
- **`configure()` default `scanPrecision` is now `HIGH`** (was `MEDIUM`), aligned with the iOS native default. Pass `scanPrecision: ScanPrecision.MEDIUM` explicitly to keep the old duty cycle.

### Added

- **"Two eyes" listeners:**
  - `addBluetoothZoneListener(listener)` — Bluetooth-zone enter/exit (the "Bluetooth eye"). **iOS-only event** — on Android the listener registers but never fires.
  - `addBluetoothScanModeListener(listener)` — BLE scanner duty-cycle changes (`idle` ↔ `active`, with `nextIdleScanAt`). **iOS-only event** — on Android the listener registers but never fires.
  - `addBluetoothStateListener(listener)` — Bluetooth adapter state changes (`poweredOn`/`poweredOff`/`unauthorized`/...). Fires on **both platforms**.
- **Persisted detection log:** `getPersistedLog()` / `clearPersistedLog()` — reads/clears the native detection log written even while the app is backgrounded or terminated. **iOS-only**; Android resolves `[]`.
- **Foreground-service APIs** (**Android-only**; no-op on iOS): `enableForegroundScanning(config)`, `disableForegroundScanning()`, `isForegroundScanningEnabled()`, `setForegroundNotificationContent(content)`.
- **Diagnostics getters:** `getSdkVersion()`, `getCurrentScanPrecision()`, `getBleDiagnosticInfo()` (iOS-only; Android returns `''`), `getPendingBatchCount()`, `isConfigured()`, `isLocationAvailable()`, `getAuthorizationStatus()`, `getBluetoothState()`. `getSdkVersion()` and `getPendingBatchCount()` return real values on both platforms.
- **`requestLocationAuthorization(level)`** — requests `'always'`/`'whenInUse'` location authorization. **iOS-only**; no-op on Android (use `requestForegroundPermissions()` there).
- **New `Beacon` fields:** `alreadySynced`, `syncedAt`, `discoverySources` (**iOS-only**), `rssiRaw`, `rssiSamples`, `isStale` (**Android-only**).
- **`sdk.technology: "react-native"`** tagged on every ingest event — hardcoded in the native bridges (`ios/RNBearoundBridge.swift`, `android/.../BearoundReactSdkModule.kt`), not configurable from JS.

### Fixed

- **Native 3.3.1 — three correctness fixes around BLE zone presence:**
  1. **Phantom zone exit→enter flap** (~1ms apart, every 5-10 min, device stationary inside zone) — cleanup-immune `lastBeaconSeenAt` + grace bumped 60s → 300s.
  2. **iOS-only: CoreLocation daemon churn → BLE delivery stalls.** Five `CLLocationManager()` throwaways replaced with a single lifetime-scoped instance.
  3. **Phantom ENTER after OS termination + state restoration** (iOS) / **PendingIntent wake** (Android). Zone state persisted to UserDefaults / SharedPreferences and restored on cold start; snapshots > 1h are stale and ignored.

  Pins:
  - iOS: `BearoundSDK 3.3.1`
  - Android: `com.github.Bearound:bearound-android-sdk:3.3.1`

  See native CHANGELOGs for root-cause details.

## [2.4.0] - 2026-05-21

### Changed

- **Native SDKs bumped to v2.4.0**:
  - iOS: `BearoundSDK ~> 2.4.0`
  - Android: `com.github.Bearound:bearound-android-sdk:2.4.0`
- **Location + active scan now strictly beacon-gated.** GPS and active BLE ranging only run while inside a beacon region. Outside the region, only the kernel-level filter scan is on. See native SDK v2.4.0 release notes for full behavior.

### Added

- 3 new event channels surfaced from the native SDKs:
  - `bearound:beaconRegion` — fires on region enter/exit transitions
  - `bearound:activeScan` — fires when active scanning (ranging + BLE) toggles
  - `bearound:locationCapture` — fires `started` when a beacon-triggered GPS window opens and `completed` when it closes (with or without a fix)
- 3 new listener helpers in `@bearound/react-native-sdk`:
  - `addBeaconRegionListener(listener)` — `BeaconRegionEvent { type: 'enter' | 'exit' }`
  - `addActiveScanListener(listener)` — `ActiveScanEvent { isActive: boolean }`
  - `addLocationCaptureListener(listener)` — `LocationCaptureEvent` discriminated union
- New exported types: `BeaconRegionEvent`, `ActiveScanEvent`, `CapturedLocation`, `LocationCaptureStartedEvent`, `LocationCaptureCompletedEvent`, `LocationCaptureEvent`.
- Example app: new **Debug Geofence** section showing live region status, active-scan state, in-flight GPS capture, last captured coordinates, and a rolling log of geofence events with 1 Hz live ages.

### Non-breaking

- All new event channels and listeners are additive. Existing event names and listeners (`addBeaconsListener`, `addSyncLifecycleListener`, etc.) are unchanged.

---

## [2.3.2] - 2026-02-19

### Changed

- **Documentation**: Updated README to reflect native SDK v2.3.0 alignment and added `'bt'` proximity type to API docs.

---

## [2.3.1] - 2026-02-18

### Changed

- **Native SDKs Updated**:
  - Android: `com.github.Bearound:bearound-android-sdk:v2.3.0`
  - iOS: `BearoundSDK ~> 2.3.0`

### Added

- **Bluetooth-only (BT) proximity fallback**: New `'bt'` proximity value for beacons detected via Bluetooth scanning only, without CoreLocation/distance estimation.

### Technical Details

- **Native SDK v2.3.0 Changes**:
  - Added BT proximity for bluetooth-only fallback detection
  - Improved beacon structure with discovery source tracking

---

## [2.2.2] - 2026-01-22

### Changed

- **Native SDKs Updated**:
  - Android: `com.github.Bearound:bearound-android-sdk:v2.2.2`
  - iOS: `BearoundSDK ~> 2.2.2`

### Technical Details

- **Native SDK v2.2.2 Changes**:
  - Removed 1-second foreground scan interval option (minimum is now 5 seconds)
  - 5-second foreground scan interval now uses continuous scanning (no pause between scans)
  - Beacons are no longer cleared from internal state after being sent to the API

---

## [2.2.1] - 2026-01-21

### ⚠️ Breaking Changes

- **Removed `enableBluetoothScanning` and `enablePeriodicScanning` parameters**: Bluetooth metadata and periodic scanning are now automatic in v2.2.1. These parameters are ignored if passed to `configure()`.
- **Deprecated `addSyncStatusListener`**: Use `addSyncLifecycleListener` instead for sync events.

### Added

- **NEW Listeners**:
  - `addSyncLifecycleListener()` - Listen to sync started/completed events
  - `addBackgroundDetectionListener()` - Listen to background beacon detections
  
- **NEW Types**:
  - `SyncLifecycleEvent` - Sync lifecycle event with type, beaconCount, success, error
  - `BackgroundDetectionEvent` - Background detection event with beaconCount

### Fixed

- **iOS/Android: Auto-restored scan not respecting configuration**: Fixed bug where if the SDK auto-restored scanning from a previous session, it would continue with the old configuration. The bridge now detects if SDK was already scanning during `configure()`, stops it, applies the new configuration, and restarts with correct settings.
- **Android: Listener being overwritten**: Android bridge now re-assigns listener in both `configure()` and `startScanning()` methods to ensure React Native always receives callbacks.
- **iOS: App state synchronization**: Added workaround to force SDK to recognize correct foreground state when starting scan.

### Changed

- **Native SDKs Updated**:
  - Android: `com.github.Bearound:bearound-android-sdk:v2.2.1`
  - iOS: `BearoundSDK ~> 2.2.1`

### Migration from 2.1.0 to 2.2.1

**Before (v2.1.0):**
```typescript
// Configure with explicit flags
await configure({
  businessToken: 'token',
  enableBluetoothScanning: true,  // ❌ Removed
  enablePeriodicScanning: true,   // ❌ Removed
});

// Listen to sync status (countdown)
addSyncStatusListener((status) => {
  console.log(`Next sync in ${status.secondsUntilNextSync}s`);
});
```

**After (v2.2.1):**
```typescript
// Simpler configuration
await configure({
  businessToken: 'token',
  // ✅ Bluetooth metadata: always enabled
  // ✅ Periodic scanning: automatic (FG: enabled, BG: continuous)
});

// NEW: Listen to sync lifecycle events
addSyncLifecycleListener((event) => {
  if (event.type === 'started') {
    console.log(`Sync started with ${event.beaconCount} beacons`);
  }
  if (event.type === 'completed') {
    console.log(`Sync ${event.success ? 'succeeded' : 'failed'}`);
  }
});

// NEW: Listen to background detections
addBackgroundDetectionListener((event) => {
  console.log(`${event.beaconCount} beacons detected in background`);
});
```

---

## [2.1.0] - 2026-01-13

### ⚠️ Breaking Changes

**Configurable Scan Intervals**: SDK now supports separate foreground and background scan intervals with configurable retry queue.

### Added

- **Configurable Scan Intervals**: New enums for fine-grained control over scan behavior
  - `ForegroundScanInterval`: Configure foreground scan intervals from 5 to 60 seconds (in 5-second increments)
  - `BackgroundScanInterval`: Configure background scan intervals (15s, 30s, 60s, 90s, or 120s)
  - Default: 15 seconds for foreground, 30 seconds for background
  
- **Configurable Retry Queue**: New `MaxQueuedPayloads` enum to control retry queue size
  - `SMALL` (50 failed batches)
  - `MEDIUM` (100 failed batches) - default
  - `LARGE` (200 failed batches)
  - `XLARGE` (500 failed batches)

### Changed

- **Configuration API**: `configure()` method now accepts enum parameters instead of single `syncInterval`
  - `foregroundScanInterval: ForegroundScanInterval = ForegroundScanInterval.SECONDS_15`
  - `backgroundScanInterval: BackgroundScanInterval = BackgroundScanInterval.SECONDS_30`
  - `maxQueuedPayloads: MaxQueuedPayloads = MaxQueuedPayloads.MEDIUM`
  - Old `syncInterval` parameter removed in favor of separate foreground/background intervals

- **Native SDKs**: Updated to version 2.1.0
  - Android: `com.github.Bearound:bearound-android-sdk:v2.1.0`
  - iOS: `BearoundSDK ~> 2.1.0`

### Migration

**Before (v2.0.1):**
```typescript
await configure({
  businessToken: 'your-business-token-here',
  syncInterval: 30,
});
```

**After (v2.1.0):**
```typescript
import { ForegroundScanInterval, BackgroundScanInterval, MaxQueuedPayloads } from '@bearound/react-native-sdk';

// Using defaults (recommended)
await configure({
  businessToken: 'your-business-token-here',
});

// Custom configuration
await configure({
  businessToken: 'your-business-token-here',
  foregroundScanInterval: ForegroundScanInterval.SECONDS_30,
  backgroundScanInterval: BackgroundScanInterval.SECONDS_90,
  maxQueuedPayloads: MaxQueuedPayloads.LARGE,
});
```

---

## [2.0.1] - 2026-01-08

### Breaking Changes

- **Authentication API**: Replaced `appId` with `businessToken` for SDK configuration
  - `configure()` now requires `businessToken` parameter
  - App ID is automatically extracted from bundle/package identifier
  - Aligns with native SDKs v2.0.1+ authentication model

### Changed

- **Native SDK Dependencies**:
  - Android: Updated to v2.0.2 (includes background scanning improvements)
  - iOS: Updated to v2.0.1+
- **Configuration**: `businessToken` is now required and validated

### Migration from 2.0.0 to 2.0.1

**Before (v2.0.0):**
```typescript
await configure({
  appId: 'com.example.app', // optional
  syncInterval: 30,
});
```

**After (v2.0.1):**
```typescript
await configure({
  businessToken: 'your-business-token', // required
  syncInterval: 30,
});
```

## [2.0.0] - 2026-01-05

### Breaking Changes

- **API Redesign**: Replaced `initialize()` and `stop()` with new lifecycle methods:
  - `configure()` - Configure SDK settings before scanning
  - `startScanning()` - Start beacon detection
  - `stopScanning()` - Stop beacon detection
  - `isScanning()` - Check scanning status
- **Removed deprecated event constants**: `EVENTS.BEACON` and `EVENTS.STOPPED` are no longer available
- **iOS Permissions**: iOS now requires explicit permission handling via SDK helpers instead of automatic native handling

### Added

- **Event Listeners**: New event subscription system for real-time updates:
  - `addBeaconsListener()` - Listen to detected beacons
  - `addSyncStatusListener()` - Monitor sync status
  - `addScanningListener()` - Track scanning state changes
  - `addErrorListener()` - Handle SDK errors
- **User Properties Management**:
  - `setUserProperties()` - Associate user data with beacon events
  - `clearUserProperties()` - Clear user properties
- **Enhanced Permission Helpers**:
  - `checkPermissions()` - Check current permission status (Android + iOS)
  - `requestForegroundPermissions()` - Request foreground permissions (Android + iOS)
  - `requestBackgroundLocation()` - Request background location (Android + iOS)
  - `ensurePermissions()` - Request all required permissions (Android + iOS)
- **SDK Configuration Options**:
  - `syncInterval` - Configure sync interval (5-60 seconds)
  - `enableBluetoothScanning` - Enable/disable BLE metadata scanning
  - `enablePeriodicScanning` - Enable/disable periodic scanning mode
- **Bluetooth Scanning Control**:
  - `setBluetoothScanning()` - Toggle BLE metadata scanning at runtime
- **Enhanced Type Definitions**:
  - `SdkConfig` - Configuration options type
  - `UserProperties` - User properties type
  - `BeaconProximity` - Beacon proximity enum
  - `BeaconMetadata` - Extended beacon metadata type
  - `Beacon` - Complete beacon data type
  - `SyncStatus` - Sync status type
  - `BearoundError` - Error type

### Changed

- **Architecture**: Complete rewrite of native bridge layer for both Android and iOS
- **iOS Event Emitter**: Migrated from Objective-C to Swift (`BearoundReactSdkEventEmitter.swift`)
- **Permission Handling**: Unified permission handling across Android and iOS platforms
- **Native SDK Alignment**: Now aligned with Bearound native SDKs version 2.0.0
- **Documentation**: Comprehensive API documentation and examples in README
- **Test Suite**: Updated tests to reflect new API surface and event system

### Fixed

- **iOS SDK Build**: Resolved iOS compilation issues with native bridge ([90bc53e](https://github.com/Bearound/bearound-react-native-sdk/commit/90bc53e))
- **iOS SDK**: Additional iOS-specific fixes and improvements ([afe7ac1](https://github.com/Bearound/bearound-react-native-sdk/commit/afe7ac1))
- **Background Modes**: Improved iOS background mode configuration in example app

### Improved

- **Example App**: Updated with comprehensive examples demonstrating all SDK features
- **TypeScript Support**: Enhanced type definitions for better developer experience
- **Error Handling**: Improved error reporting with detailed error messages
- **Cross-Platform Consistency**: Unified behavior between Android and iOS implementations

### Migration Guide

If upgrading from 1.x.x to 2.0.0:

**Before (v1.x.x):**
```typescript
import { initialize, stop } from '@bearound/react-native-sdk';

await initialize('your-token', true);
// SDK started, no events available

await stop();
```

**After (v2.0.0):**
```typescript
import {
  configure,
  startScanning,
  stopScanning,
  addBeaconsListener,
  ensurePermissions,
} from '@bearound/react-native-sdk';

// Request permissions
await ensurePermissions({ askBackground: true });

// Configure SDK
await configure({
  businessToken: 'your-business-token',
  syncInterval: 30,
  enableBluetoothScanning: true,
  enablePeriodicScanning: true,
});

// Listen to beacons
const subscription = addBeaconsListener((beacons) => {
  console.log('Detected beacons:', beacons);
});

// Start scanning
await startScanning();

// Later: stop scanning and cleanup
await stopScanning();
subscription.remove();
```

## [1.3.1] - 2025-12-22

### Fixed

- Version bump and stability improvements

### Changed

- Updated package version to 1.3.1

---

## Previous Versions

Previous versions used the legacy `initialize/stop` API. See git history for details on versions prior to 1.3.1.
