/**
 * @fileoverview Main entry point for the Bearound React Native SDK
 *
 * This module provides the primary API for integrating Bearound's BLE beacon detection
 * capabilities into React Native applications.
 *
 * **Platform Support:**
 * - **Android**: Full native integration with permission management
 * - **iOS**: Native framework integration with explicit permission handling
 *
 * **Key Features:**
 * - SDK 2.0.0 configure/start/stop lifecycle
 * - Cross-platform BLE beacon detection
 * - Background monitoring capabilities
 * - Built-in permission management (Android/iOS)
 *
 * @author Bearound Team
 * @version 2.0.0
 */

import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
  type NativeModule,
} from 'react-native';

import Native from './NativeBearoundReactSdk';

/**
 * Configuration options for the SDK.
 */
export type SdkConfig = {
  businessToken: string;
  syncInterval?: number;
  enableBluetoothScanning?: boolean;
  enablePeriodicScanning?: boolean;
};

/**
 * User properties associated with beacon events.
 */
export type UserProperties = {
  internalId?: string;
  email?: string;
  name?: string;
  customProperties?: Record<string, string>;
};

export type BeaconProximity = 'immediate' | 'near' | 'far' | 'unknown';

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
  timestamp: number;
  metadata?: BeaconMetadata;
  txPower?: number;
};

export type SyncStatus = {
  secondsUntilNextSync: number;
  isRanging: boolean;
};

export type BearoundError = {
  message: string;
};

const EVENT_BEACONS = 'bearound:beacons';
const EVENT_SYNC = 'bearound:sync';
const EVENT_SCANNING = 'bearound:scanning';
const EVENT_ERROR = 'bearound:error';

const nativeModules = NativeModules as { [key: string]: NativeModule };
const nativeModule: NativeModule =
  nativeModules.BearoundReactSdk ?? (Native as unknown as NativeModule);
const eventEmitterModule =
  nativeModules.BearoundReactSdkEventEmitter ?? nativeModule;
const eventEmitter = new NativeEventEmitter(eventEmitterModule);

const asMap = (event: unknown): Record<string, unknown> => {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    return {};
  }
  return event as Record<string, unknown>;
};

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const parseProximity = (value: unknown): BeaconProximity => {
  switch (String(value || '').toLowerCase()) {
    case 'immediate':
      return 'immediate';
    case 'near':
      return 'near';
    case 'far':
      return 'far';
    default:
      return 'unknown';
  }
};

const parseMetadata = (value: unknown): BeaconMetadata | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const payload = value as Record<string, unknown>;
  return {
    firmwareVersion: String(payload.firmwareVersion ?? ''),
    batteryLevel: asNumber(payload.batteryLevel),
    movements: asNumber(payload.movements),
    temperature: asNumber(payload.temperature),
    txPower:
      payload.txPower === undefined ? undefined : asNumber(payload.txPower),
    rssiFromBLE:
      payload.rssiFromBLE === undefined
        ? undefined
        : asNumber(payload.rssiFromBLE),
    isConnectable:
      payload.isConnectable === undefined
        ? undefined
        : Boolean(payload.isConnectable),
  };
};

const parseBeacons = (event: unknown): Beacon[] => {
  const payload = asMap(event);
  const raw = Array.isArray(event) ? event : payload.beacons;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => {
    const beacon = asMap(item);
    return {
      uuid: String(beacon.uuid ?? ''),
      major: asNumber(beacon.major),
      minor: asNumber(beacon.minor),
      rssi: asNumber(beacon.rssi),
      proximity: parseProximity(beacon.proximity),
      accuracy: asNumber(beacon.accuracy),
      timestamp: asNumber(beacon.timestamp),
      metadata: parseMetadata(beacon.metadata),
      txPower:
        beacon.txPower === undefined ? undefined : asNumber(beacon.txPower),
    };
  });
};

const parseSyncStatus = (event: unknown): SyncStatus => {
  const payload = asMap(event);
  return {
    secondsUntilNextSync: asNumber(payload.secondsUntilNextSync),
    isRanging: Boolean(payload.isRanging),
  };
};

/**
 * Configures the Bearound SDK before starting scans.
 *
 * **Platform Behavior:**
 * - **Android**: Requires permissions to be granted before starting scanning.
 *   Use `ensurePermissions()` first to request all required permissions.
 * - **iOS**: Requests location permission via the permissions helper.
 *
 * **Important Notes:**
 * - Call before `startScanning()`
 * - Business token is required
 * - Sync interval is in seconds (5-60)
 *
 * @example
 * ```typescript
 * import { configure, ensurePermissions } from 'bearound-react-native-sdk';
 *
 * await configure({
 *   businessToken: 'your-business-token',
 *   syncInterval: 30,
 *   enableBluetoothScanning: true,
 *   enablePeriodicScanning: true,
 * });
 * ```
 */
export async function configure(config: SdkConfig) {
  const {
    businessToken,
    syncInterval = 30,
    enableBluetoothScanning = false,
    enablePeriodicScanning = true,
  } = config;

  if (!businessToken || businessToken.trim().length === 0) {
    throw new Error('Business token is required');
  }

  await Native.configure(
    businessToken.trim(),
    syncInterval,
    enableBluetoothScanning,
    enablePeriodicScanning
  );
}

/**
 * Starts beacon scanning (requires `configure()`).
 */
export async function startScanning() {
  await Native.startScanning();
}

/**
 * Stops beacon scanning and releases native resources.
 */
export async function stopScanning() {
  await Native.stopScanning();
}

/**
 * Returns whether the SDK is currently scanning.
 */
export async function isScanning() {
  return Native.isScanning();
}

/**
 * Enables or disables Bluetooth metadata scanning.
 */
export async function setBluetoothScanning(enabled: boolean) {
  await Native.setBluetoothScanning(enabled);
}

/**
 * Sets user properties associated with beacon events.
 */
export async function setUserProperties(properties: UserProperties) {
  await Native.setUserProperties(properties as unknown as object);
}

/**
 * Clears user properties.
 */
export async function clearUserProperties() {
  await Native.clearUserProperties();
}

export function addBeaconsListener(
  listener: (beacons: Beacon[]) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_BEACONS, (event) => {
    listener(parseBeacons(event));
  });
}

export function addSyncStatusListener(
  listener: (status: SyncStatus) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_SYNC, (event) => {
    listener(parseSyncStatus(event));
  });
}

export function addScanningListener(
  listener: (isScanning: boolean) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_SCANNING, (event) => {
    if (typeof event === 'boolean') {
      listener(event);
      return;
    }
    const payload = asMap(event);
    listener(Boolean(payload.isScanning));
  });
}

export function addErrorListener(
  listener: (error: BearoundError) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_ERROR, (event) => {
    if (typeof event === 'string') {
      listener({ message: event });
      return;
    }
    const payload = asMap(event);
    listener({ message: String(payload.message ?? 'Unknown error') });
  });
}

/**
 * Re-export all permission-related functions and types.
 *
 * **Available exports:**
 * - `ensurePermissions(opts?)` - Request all required permissions (Android)
 * - `checkPermissions()` - Check current permission status (Android)
 * - `requestForegroundPermissions()` - Request foreground permissions only (Android)
 * - `requestBackgroundLocation()` - Request background location permission (Android)
 * - `PermissionResult` - Type definition for permission status
 *
 * **Note:** iOS permissions are requested via native helper methods in this SDK.
 */
export * from './permissions';
