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
  /**
   * Firmware identifier. As of native SDK 3.0.0 this is an integer encoded as a
   * string (e.g. `"1"`), NOT a semantic version (`"2.1.0"`) as in 2.x.
   */
  firmwareVersion: string;
  /**
   * Battery level. As of native SDK 3.0.0 this is in **millivolts** (e.g. `3269`),
   * NOT a 0–100 percentage as in 2.x.
   */
  batteryLevel: number;
  movements: number;
  temperature: number;
  txPower?: number;
  rssiFromBLE?: number;
  isConnectable?: boolean;
};

/**
 * Which detector(s) saw this beacon. **iOS-only** — drives the "two eyes" model
 * (`coreLocation` = Location eye; `serviceUUID`/`name` = Bluetooth eye). Absent on
 * Android, which is BLE-only and does not distinguish detection sources.
 */
export type BeaconDiscoverySource = 'serviceUUID' | 'name' | 'coreLocation';

/**
 * Aggregated RSSI statistics over a sync window. **Android-only** — iOS does not
 * expose per-beacon RSSI sample aggregates.
 */
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
  timestamp: number;
  metadata?: BeaconMetadata;
  txPower?: number;
  /** Whether this beacon has already been synced to the ingest API. */
  alreadySynced?: boolean;
  /** Epoch ms of the last successful sync for this beacon, if any. */
  syncedAt?: number;
  /** iOS-only. See {@link BeaconDiscoverySource}. */
  discoverySources?: BeaconDiscoverySource[];
  /** Android-only. Raw (unsmoothed) RSSI of the latest sample. */
  rssiRaw?: number;
  /** Android-only. See {@link RssiStats}. */
  rssiSamples?: RssiStats;
  /** Android-only. True when the beacon hasn't been seen within the freshness window. */
  isStale?: boolean;
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

// v2.4 — beacon region lifecycle

export type BeaconRegionEvent = {
  type: 'enter' | 'exit';
};

export type ActiveScanEvent = {
  isActive: boolean;
};

// v2.5 — Bluetooth "two eyes" zone (iOS-only; Android has no equivalent)

export type BluetoothZoneEvent = {
  type: 'enter' | 'exit';
};

export type BluetoothScanMode = 'idle' | 'active';

/** Bluetooth adapter state, mirroring iOS `CBManagerState` / Android adapter state. */
export type BluetoothState =
  | 'poweredOn'
  | 'poweredOff'
  | 'unauthorized'
  | 'unsupported'
  | 'resetting'
  | 'unknown';

export type BluetoothStateEvent = {
  state: BluetoothState;
};

export type BluetoothScanModeEvent = {
  mode: BluetoothScanMode;
  /** Epoch ms of the next idle peek. Present only when `mode === 'idle'`. */
  nextIdleScanAt?: number;
};

const EVENT_BEACONS = 'bearound:beacons';
const EVENT_SYNC_LIFECYCLE = 'bearound:syncLifecycle';
const EVENT_BACKGROUND_DETECTION = 'bearound:backgroundDetection';
const EVENT_SCANNING = 'bearound:scanning';
const EVENT_ERROR = 'bearound:error';
const EVENT_BEACON_REGION = 'bearound:beaconRegion';
const EVENT_ACTIVE_SCAN = 'bearound:activeScan';
const EVENT_BLUETOOTH_ZONE = 'bearound:bluetoothZone';
const EVENT_BLUETOOTH_SCAN_MODE = 'bearound:bluetoothScanMode';
const EVENT_BLUETOOTH_STATE = 'bearound:bluetoothState';

const BLUETOOTH_STATES: BluetoothState[] = [
  'poweredOn',
  'poweredOff',
  'unauthorized',
  'unsupported',
  'resetting',
  'unknown',
];

const parseBluetoothState = (value: unknown): BluetoothState => {
  const raw = String(
    (value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>).state
      : value) ?? ''
  );
  return (BLUETOOTH_STATES as string[]).includes(raw)
    ? (raw as BluetoothState)
    : 'unknown';
};

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
      alreadySynced:
        beacon.alreadySynced === undefined
          ? undefined
          : Boolean(beacon.alreadySynced),
      syncedAt:
        beacon.syncedAt === undefined ? undefined : asNumber(beacon.syncedAt),
      discoverySources: parseDiscoverySources(beacon.discoverySources),
      rssiRaw:
        beacon.rssiRaw === undefined ? undefined : asNumber(beacon.rssiRaw),
      rssiSamples: parseRssiStats(beacon.rssiSamples),
      isStale:
        beacon.isStale === undefined ? undefined : Boolean(beacon.isStale),
    };
  });
};

const DISCOVERY_SOURCES: BeaconDiscoverySource[] = [
  'serviceUUID',
  'name',
  'coreLocation',
];

const parseDiscoverySources = (
  value: unknown
): BeaconDiscoverySource[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((entry) => String(entry))
    .filter((entry): entry is BeaconDiscoverySource =>
      (DISCOVERY_SOURCES as string[]).includes(entry)
    );
};

const parseRssiStats = (value: unknown): RssiStats | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  const payload = value as Record<string, unknown>;
  return {
    count: asNumber(payload.count),
    min: asNumber(payload.min),
    max: asNumber(payload.max),
    avg: asNumber(payload.avg),
    stdDev: asNumber(payload.stdDev),
    firstSeen: asNumber(payload.firstSeen),
    lastSeen: asNumber(payload.lastSeen),
  };
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

const parseBluetoothZoneEvent = (event: unknown): BluetoothZoneEvent => {
  const payload = asMap(event);
  const type = String(payload.type ?? '').toLowerCase();
  return { type: type === 'exit' ? 'exit' : 'enter' };
};

const parseBluetoothScanModeEvent = (
  event: unknown
): BluetoothScanModeEvent => {
  const payload = asMap(event);
  const mode: BluetoothScanMode =
    String(payload.mode ?? '').toLowerCase() === 'active' ? 'active' : 'idle';
  return {
    mode,
    nextIdleScanAt:
      payload.nextIdleScanAt === undefined
        ? undefined
        : asNumber(payload.nextIdleScanAt),
  };
};

export async function configure(config: SdkConfig) {
  const {
    businessToken,
    // Default aligned with the iOS native SDK (`.high`) for cross-platform
    // consistency. Override explicitly in `configure()` for lower-battery
    // duty cycles.
    scanPrecision = ScanPrecision.HIGH,
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

// --- Diagnostic / state accessors (parity with native public API) ---

export type AuthorizationStatus =
  | 'always'
  | 'whenInUse'
  | 'denied'
  | 'restricted'
  | 'notDetermined'
  | 'unknown'
  | string;

/** Native SDK version. **iOS** returns the SDK version; Android returns `''`. */
export async function getSdkVersion(): Promise<string> {
  return Native.getSdkVersion();
}

/** Active scan precision (`'high' | 'medium' | 'low'`), or `''` if not configured. */
export async function getCurrentScanPrecision(): Promise<string> {
  return Native.getCurrentScanPrecision();
}

/** BLE diagnostic string. **iOS-only**; Android returns `''`. */
export async function getBleDiagnosticInfo(): Promise<string> {
  return Native.getBleDiagnosticInfo();
}

/** Number of failed sync batches queued for retry. **iOS-only**; Android returns `0`. */
export async function getPendingBatchCount(): Promise<number> {
  return Native.getPendingBatchCount();
}

/** Whether `configure()` has run. */
export async function isConfigured(): Promise<boolean> {
  return Native.isConfigured();
}

/** Whether device location services are enabled. */
export async function isLocationAvailable(): Promise<boolean> {
  return Native.isLocationAvailable();
}

/**
 * Current location authorization. **iOS** returns one of {@link AuthorizationStatus};
 * Android returns its own permission-status string.
 */
export async function getAuthorizationStatus(): Promise<AuthorizationStatus> {
  return Native.getAuthorizationStatus();
}

/**
 * Current Bluetooth adapter state. The Bluetooth eye works whenever this is
 * `'poweredOn'` — independent of location authorization.
 */
export async function getBluetoothState(): Promise<BluetoothState> {
  return parseBluetoothState(await Native.getBluetoothState());
}

/**
 * App-state bucket recorded natively for each persisted log entry.
 *
 * - `foreground` — app active and on screen.
 * - `background` — app backgrounded, device screen unlocked.
 * - `backgroundLocked` — app backgrounded AND device screen locked
 *   (iOS: `isProtectedDataAvailable`; Android: `KeyguardManager`).
 * - `terminated` — event fired during a system-initiated relaunch
 *   (BLE/region wake-up) BEFORE the app's UI became active.
 */
export type PersistedLogState =
  | 'foreground'
  | 'background'
  | 'backgroundLocked'
  | 'terminated';

export type PersistedLogEntry = {
  id: string;
  timestamp: number;
  state: PersistedLogState;
  type: string;
  detail: string;
};

/**
 * Read the **native** detection log. Entries are persisted by the SDK on every
 * event — including while the app is backgrounded or **closed** (Android writes
 * them from a process-start listener), so JS can show what happened while it
 * wasn't running.
 */
export async function getPersistedLog(): Promise<PersistedLogEntry[]> {
  const raw = await Native.getPersistedLog();
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map((e) => ({
      id: String(e?.id ?? ''),
      timestamp: asNumber(e?.timestamp),
      state:
        e?.state === 'foreground' ||
        e?.state === 'backgroundLocked' ||
        e?.state === 'terminated'
          ? e.state
          : 'background',
      type: String(e?.type ?? ''),
      detail: String(e?.detail ?? ''),
    }));
  } catch {
    return [];
  }
}

/** Clear the native persisted detection log. */
export async function clearPersistedLog(): Promise<void> {
  await Native.clearPersistedLog();
}

/**
 * Request location authorization. **iOS-only** — unlocks the Location eye
 * (terminated-app wake-up with `'always'`). On Android this is a no-op; request
 * runtime permissions via {@link requestForegroundPermissions} instead.
 */
export async function requestLocationAuthorization(
  level: 'always' | 'whenInUse' = 'always'
): Promise<void> {
  await Native.requestLocationAuthorization(level);
}

// --- Foreground-service scanning (Android-only) ---

/**
 * Config for the Android foreground-service notification shown while scanning in
 * background. Keeps the process alive on aggressive OEMs (Xiaomi/Huawei/Samsung).
 */
export type ForegroundScanConfig = {
  notificationTitle?: string;
  notificationText?: string;
  notificationChannelId?: string;
  notificationChannelName?: string;
};

/** Contextual foreground-notification content. See {@link setForegroundNotificationContent}. */
export type NotificationContent = {
  title: string;
  text: string;
};

/**
 * Enable the Android foreground-service scan with a persistent notification.
 *
 * **Android-only.** iOS uses region monitoring / BGTaskScheduler and has no
 * persistent-notification foreground service — this is a no-op on iOS.
 */
export async function enableForegroundScanning(
  config: ForegroundScanConfig = {}
): Promise<void> {
  await Native.enableForegroundScanning(config as object);
}

/** Disable the Android foreground-service scan. **Android-only** (no-op on iOS). */
export async function disableForegroundScanning(): Promise<void> {
  await Native.disableForegroundScanning();
}

/** Whether the Android foreground-service scan is enabled. iOS always resolves `false`. */
export async function isForegroundScanningEnabled(): Promise<boolean> {
  return Native.isForegroundScanningEnabled();
}

/**
 * Set contextual content for the Android foreground-service notification. The native
 * SDK calls this back when beacons are detected; update it (e.g. from
 * {@link addBeaconsListener}) to show messages like "Offers nearby!".
 *
 * **Android-only** (no-op on iOS).
 */
export async function setForegroundNotificationContent(
  content: NotificationContent
): Promise<void> {
  await Native.setForegroundNotificationContent(content as object);
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
 * Subscribe to Bluetooth-zone enter/exit transitions (the "Bluetooth eye").
 *
 * **iOS-only.** Backed by the CBCentralManager BLE scan, independent of
 * CoreLocation region monitoring. Android has no equivalent — on Android this
 * listener is registered but never fires.
 */
export function addBluetoothZoneListener(
  listener: (event: BluetoothZoneEvent) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_BLUETOOTH_ZONE, (event) => {
    listener(parseBluetoothZoneEvent(event));
  });
}

/**
 * Subscribe to Bluetooth scanner duty-cycle mode changes (`idle` ↔ `active`).
 *
 * **iOS-only.** Android has no equivalent — on Android this listener is
 * registered but never fires.
 */
export function addBluetoothScanModeListener(
  listener: (event: BluetoothScanModeEvent) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_BLUETOOTH_SCAN_MODE, (event) => {
    listener(parseBluetoothScanModeEvent(event));
  });
}

/**
 * Subscribe to Bluetooth adapter state changes (poweredOn/Off/unauthorized/...).
 * Fires on both platforms — use it to gate the Bluetooth eye independently of
 * location.
 */
export function addBluetoothStateListener(
  listener: (state: BluetoothState) => void
): EmitterSubscription {
  return eventEmitter.addListener(EVENT_BLUETOOTH_STATE, (event) => {
    listener(parseBluetoothState(event));
  });
}

export * from './permissions';
