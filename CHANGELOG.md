# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
