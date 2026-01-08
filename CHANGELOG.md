# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
