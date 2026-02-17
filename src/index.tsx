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
 * @version 2.3.0
 */

import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
  type NativeModule,
} from 'react-native';

import Native from './NativeBearoundReactSdk';

/**
 * Foreground scan interval options (5-60 seconds).
 *
 * Note: SECONDS_5 uses continuous scanning mode (no pause between scans)
 * for maximum beacon detection. Other intervals use periodic scanning
 * with calculated scan/pause durations.
 */
export enum ForegroundScanInterval {
  /** Continuous scanning mode - no pause between scans */
  SECONDS_5 = 5,
  SECONDS_10 = 10,
  SECONDS_15 = 15,
  SECONDS_20 = 20,
  SECONDS_25 = 25,
  SECONDS_30 = 30,
  SECONDS_35 = 35,
  SECONDS_40 = 40,
  SECONDS_45 = 45,
  SECONDS_50 = 50,
  SECONDS_55 = 55,
  SECONDS_60 = 60,
}

/**
 * Background scan interval options (15-120 seconds).
 */
export enum BackgroundScanInterval {
  SECONDS_15 = 15,
  SECONDS_30 = 30,
  SECONDS_60 = 60,
  SECONDS_90 = 90,
  SECONDS_120 = 120,
}

/**
 * Maximum queued payloads configuration.
 */
export enum MaxQueuedPayloads {
  SMALL = 50,
  MEDIUM = 100,
  LARGE = 200,
  XLARGE = 500,
}

/**
 * Configuration options for the SDK.
 */
export type SdkConfig = {
  businessToken: string;
  foregroundScanInterval?: ForegroundScanInterval;
  backgroundScanInterval?: BackgroundScanInterval;
  maxQueuedPayloads?: MaxQueuedPayloads;
  /** @deprecated Since v2.2.1 - Bluetooth scanning is now automatic (ignored) */
  enableBluetoothScanning?: boolean;
  /** @deprecated Since v2.2.1 - Periodic scanning is now automatic (ignored) */
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
  timestamp: number;
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

const EVENT_BEACONS = 'bearound:beacons';
const EVENT_SYNC_LIFECYCLE = 'bearound:syncLifecycle';
const EVENT_BACKGROUND_DETECTION = 'bearound:backgroundDetection';
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
    case 'bt':
      return 'bt';
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

const parseSyncLifecycleEvent = (event: unknown): SyncLifecycleEvent => {
  const payload = asMap(event);
  return {
    type: String(payload.type) as 'started' | 'completed',
    beaconCount: asNumber(payload.beaconCount),
    success:
      payload.success === undefined ? undefined : Boolean(payload.success),
    error: payload.error === undefined ? undefined : String(payload.error),
  };
};

const parseBackgroundDetectionEvent = (
  event: unknown
): BackgroundDetectionEvent => {
  const payload = asMap(event);
  return {
    beaconCount: asNumber(payload.beaconCount),
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
 * - Sync intervals are in seconds (foreground: 5-60, background: 15-120)
 * - **v2.2.1**: `enableBluetoothScanning` and `enablePeriodicScanning` are ignored
 *   (Bluetooth metadata and periodic scanning are now automatic)
 *
 * @example
 * ```typescript
 * import { configure, ensurePermissions, ForegroundScanInterval, BackgroundScanInterval, MaxQueuedPayloads } from '@bearound/react-native-sdk';
 *
 * await configure({
 *   businessToken: 'your-business-token',
 *   foregroundScanInterval: ForegroundScanInterval.SECONDS_15,
 *   backgroundScanInterval: BackgroundScanInterval.SECONDS_30,
 *   maxQueuedPayloads: MaxQueuedPayloads.MEDIUM,
 * });
 * ```
 */
export async function configure(config: SdkConfig) {
  const {
    businessToken,
    foregroundScanInterval = ForegroundScanInterval.SECONDS_15,
    backgroundScanInterval = BackgroundScanInterval.SECONDS_30,
    maxQueuedPayloads = MaxQueuedPayloads.MEDIUM,
    enableBluetoothScanning = false,
    enablePeriodicScanning = true,
  } = config;

  if (!businessToken || businessToken.trim().length === 0) {
    throw new Error('Business token is required');
  }

  await Native.configure(
    businessToken.trim(),
    foregroundScanInterval,
    backgroundScanInterval,
    maxQueuedPayloads,
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
 *
 * @deprecated Since v2.2.1 - Bluetooth scanning is now automatic.
 * This method does nothing but is maintained for backward compatibility.
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

export function addSyncLifecycleListener(
  listener: (event: SyncLifecycleEvent) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_SYNC_LIFECYCLE, (event) => {
    listener(parseSyncLifecycleEvent(event));
  });
}

export function addBackgroundDetectionListener(
  listener: (event: BackgroundDetectionEvent) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_BACKGROUND_DETECTION, (event) => {
    listener(parseBackgroundDetectionEvent(event));
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
