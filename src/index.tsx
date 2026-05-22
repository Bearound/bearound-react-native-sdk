import {
  NativeEventEmitter,
  NativeModules,
  type EmitterSubscription,
  type NativeModule,
} from 'react-native';

import Native from './NativeBearoundReactSdk';

export enum ScanPrecision {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum MaxQueuedPayloads {
  SMALL = 50,
  MEDIUM = 100,
  LARGE = 200,
  XLARGE = 500,
}

export type SdkConfig = {
  businessToken: string;
  scanPrecision?: ScanPrecision;
  maxQueuedPayloads?: MaxQueuedPayloads;
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

// v2.4 — region + location capture lifecycle

export type BeaconRegionEvent = {
  type: 'enter' | 'exit';
};

export type ActiveScanEvent = {
  isActive: boolean;
};

export type CapturedLocation = {
  latitude: number;
  longitude: number;
  horizontalAccuracy?: number;
  altitude?: number;
  speed?: number;
  course?: number;
  timestamp: number;
};

export type LocationCaptureStartedEvent = {
  type: 'started';
  reason: string;
};

export type LocationCaptureCompletedEvent = {
  type: 'completed';
  reason: string;
  outcome: string;
  hasFix: boolean;
  timestamp: number;
  location?: CapturedLocation;
};

export type LocationCaptureEvent =
  | LocationCaptureStartedEvent
  | LocationCaptureCompletedEvent;

const EVENT_BEACONS = 'bearound:beacons';
const EVENT_SYNC_LIFECYCLE = 'bearound:syncLifecycle';
const EVENT_BACKGROUND_DETECTION = 'bearound:backgroundDetection';
const EVENT_SCANNING = 'bearound:scanning';
const EVENT_ERROR = 'bearound:error';
const EVENT_BEACON_REGION = 'bearound:beaconRegion';
const EVENT_ACTIVE_SCAN = 'bearound:activeScan';
const EVENT_LOCATION_CAPTURE = 'bearound:locationCapture';

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

const parseBeaconRegionEvent = (event: unknown): BeaconRegionEvent => {
  const payload = asMap(event);
  const type = String(payload.type ?? '').toLowerCase();
  return {
    type: type === 'exit' ? 'exit' : 'enter',
  };
};

const parseActiveScanEvent = (event: unknown): ActiveScanEvent => {
  const payload = asMap(event);
  return { isActive: Boolean(payload.isActive) };
};

const parseCapturedLocation = (
  value: unknown
): CapturedLocation | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const payload = value as Record<string, unknown>;
  return {
    latitude: asNumber(payload.latitude),
    longitude: asNumber(payload.longitude),
    horizontalAccuracy:
      payload.horizontalAccuracy === undefined
        ? undefined
        : asNumber(payload.horizontalAccuracy),
    altitude:
      payload.altitude === undefined ? undefined : asNumber(payload.altitude),
    speed: payload.speed === undefined ? undefined : asNumber(payload.speed),
    course: payload.course === undefined ? undefined : asNumber(payload.course),
    timestamp: asNumber(payload.timestamp),
  };
};

const parseLocationCaptureEvent = (event: unknown): LocationCaptureEvent => {
  const payload = asMap(event);
  const type = String(payload.type ?? '').toLowerCase();
  if (type === 'started') {
    return {
      type: 'started',
      reason: String(payload.reason ?? ''),
    };
  }
  return {
    type: 'completed',
    reason: String(payload.reason ?? ''),
    outcome: String(payload.outcome ?? ''),
    hasFix: Boolean(payload.hasFix),
    timestamp: asNumber(payload.timestamp),
    location: parseCapturedLocation(payload.location),
  };
};

export async function configure(config: SdkConfig) {
  const {
    businessToken,
    scanPrecision = ScanPrecision.MEDIUM,
    maxQueuedPayloads = MaxQueuedPayloads.MEDIUM,
  } = config;

  if (!businessToken || businessToken.trim().length === 0) {
    throw new Error('Business token is required');
  }

  await Native.configure(
    businessToken.trim(),
    scanPrecision,
    maxQueuedPayloads
  );
}

export async function startScanning() {
  await Native.startScanning();
}

export async function stopScanning() {
  await Native.stopScanning();
}

export async function isScanning() {
  return Native.isScanning();
}

export async function setUserProperties(properties: UserProperties) {
  await Native.setUserProperties(properties as unknown as object);
}

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
 * Subscribe to beacon region enter/exit transitions.
 *
 * v2.4: fires when the device enters or exits the BLE proximity zone of a
 * known beacon. Outside the region only the low-power kernel filter scan is
 * active — active BLE scanning and GPS are off.
 */
export function addBeaconRegionListener(
  listener: (event: BeaconRegionEvent) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_BEACON_REGION, (event) => {
    listener(parseBeaconRegionEvent(event));
  });
}

/**
 * Subscribe to active-scan gating changes. Active scanning (BLE ranging +
 * duty cycle) runs only while inside a beacon region.
 */
export function addActiveScanListener(
  listener: (event: ActiveScanEvent) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_ACTIVE_SCAN, (event) => {
    listener(parseActiveScanEvent(event));
  });
}

/**
 * Subscribe to beacon-triggered location capture lifecycle. Fires `started`
 * when the SDK opens a one-shot GPS window because a beacon was detected,
 * then `completed` with an outcome (and optional location fix) when the
 * window closes.
 */
export function addLocationCaptureListener(
  listener: (event: LocationCaptureEvent) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_LOCATION_CAPTURE, (event) => {
    listener(parseLocationCaptureEvent(event));
  });
}

export * from './permissions';
