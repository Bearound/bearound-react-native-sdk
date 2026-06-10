/**
 * @fileoverview Contract test — locks the JS↔native event catalog.
 *
 * This is the guard against silent drift: when a native SDK update adds, renames
 * or removes an event, the bridge and this catalog must change together. If the
 * public listener surface changes without updating this list, the test fails.
 *
 * Note: the cross-platform compile contract (method signatures against the real
 * native pods/aars) is enforced by the example-app builds in CI. This test owns
 * the JS-side event names + payload shapes.
 */

import {
  mockNativeModule,
  resetMocks,
  sampleBeaconIOS,
  sampleBeaconAndroid,
} from './testUtils';

const eventCallbacks: Record<string, (event: unknown) => void> = {};

const mockAddListener = jest.fn(
  (eventName: string, callback: (event: unknown) => void) => {
    eventCallbacks[eventName] = callback;
    return { remove: jest.fn() };
  }
);

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: 17 },
  NativeModules: { BearoundReactSdk: {} },
  NativeEventEmitter: jest.fn(() => ({
    addListener: mockAddListener,
    removeAllListeners: jest.fn(),
  })),
  TurboModuleRegistry: { getEnforcing: jest.fn(() => mockNativeModule) },
}));

jest.mock('../NativeBearoundReactSdk', () => ({
  __esModule: true,
  default: mockNativeModule,
}));

// The full event catalog. Each listener MUST register exactly the listed event.
// Adding/removing a native event without updating this list breaks the build.
const EVENT_CATALOG: Array<{
  listener: string;
  event: string;
  platform: 'both' | 'ios' | 'android';
}> = [
  {
    listener: 'addBeaconsListener',
    event: 'bearound:beacons',
    platform: 'both',
  },
  {
    listener: 'addSyncLifecycleListener',
    event: 'bearound:syncLifecycle',
    platform: 'both',
  },
  {
    listener: 'addBackgroundDetectionListener',
    event: 'bearound:backgroundDetection',
    platform: 'both',
  },
  {
    listener: 'addScanningListener',
    event: 'bearound:scanning',
    platform: 'both',
  },
  { listener: 'addErrorListener', event: 'bearound:error', platform: 'both' },
  {
    listener: 'addBeaconRegionListener',
    event: 'bearound:beaconRegion',
    platform: 'both',
  },
  {
    listener: 'addActiveScanListener',
    event: 'bearound:activeScan',
    platform: 'both',
  },
  // iOS-only: Bluetooth "two eyes" zone (v2.5); Android has no equivalent
  {
    listener: 'addBluetoothZoneListener',
    event: 'bearound:bluetoothZone',
    platform: 'ios',
  },
  {
    listener: 'addBluetoothScanModeListener',
    event: 'bearound:bluetoothScanMode',
    platform: 'ios',
  },
  // Bluetooth adapter state — both platforms
  {
    listener: 'addBluetoothStateListener',
    event: 'bearound:bluetoothState',
    platform: 'both',
  },
];

describe('Event catalog contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    Object.keys(eventCallbacks).forEach((key) => delete eventCallbacks[key]);
  });

  it.each(EVENT_CATALOG)(
    '$listener registers "$event" ($platform)',
    ({ listener, event }) => {
      const mod = require('../index');
      expect(typeof mod[listener]).toBe('function');

      mod[listener](jest.fn());

      expect(mockAddListener).toHaveBeenCalledWith(event, expect.any(Function));
    }
  );

  it('exposes exactly the catalogued listeners (no orphans)', () => {
    const mod = require('../index');
    const exportedListeners = Object.keys(mod).filter(
      (k) => k.startsWith('add') && k.endsWith('Listener')
    );
    expect(exportedListeners.sort()).toEqual(
      EVENT_CATALOG.map((c) => c.listener).sort()
    );
  });
});

describe('Bluetooth zone parsing (iOS-only, v2.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    Object.keys(eventCallbacks).forEach((key) => delete eventCallbacks[key]);
  });

  it('parses enter transition', () => {
    const { addBluetoothZoneListener } = require('../index');
    const cb = jest.fn();
    addBluetoothZoneListener(cb);

    eventCallbacks['bearound:bluetoothZone']!({ type: 'enter' });

    expect(cb).toHaveBeenCalledWith({ type: 'enter' });
  });

  it('parses exit transition', () => {
    const { addBluetoothZoneListener } = require('../index');
    const cb = jest.fn();
    addBluetoothZoneListener(cb);

    eventCallbacks['bearound:bluetoothZone']!({ type: 'exit' });

    expect(cb).toHaveBeenCalledWith({ type: 'exit' });
  });

  it('defaults to enter for an unknown type', () => {
    const { addBluetoothZoneListener } = require('../index');
    const cb = jest.fn();
    addBluetoothZoneListener(cb);

    eventCallbacks['bearound:bluetoothZone']!({});

    expect(cb).toHaveBeenCalledWith({ type: 'enter' });
  });
});

describe('Bluetooth scan mode parsing (iOS-only, v2.5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    Object.keys(eventCallbacks).forEach((key) => delete eventCallbacks[key]);
  });

  it('parses active mode without nextIdleScanAt', () => {
    const { addBluetoothScanModeListener } = require('../index');
    const cb = jest.fn();
    addBluetoothScanModeListener(cb);

    eventCallbacks['bearound:bluetoothScanMode']!({ mode: 'active' });

    expect(cb).toHaveBeenCalledWith({
      mode: 'active',
      nextIdleScanAt: undefined,
    });
  });

  it('parses idle mode with nextIdleScanAt epoch ms', () => {
    const { addBluetoothScanModeListener } = require('../index');
    const cb = jest.fn();
    addBluetoothScanModeListener(cb);

    eventCallbacks['bearound:bluetoothScanMode']!({
      mode: 'idle',
      nextIdleScanAt: 1717000000000,
    });

    expect(cb).toHaveBeenCalledWith({
      mode: 'idle',
      nextIdleScanAt: 1717000000000,
    });
  });

  it('defaults to idle for an unknown mode', () => {
    const { addBluetoothScanModeListener } = require('../index');
    const cb = jest.fn();
    addBluetoothScanModeListener(cb);

    eventCallbacks['bearound:bluetoothScanMode']!({ mode: 'weird' });

    expect(cb).toHaveBeenCalledWith({
      mode: 'idle',
      nextIdleScanAt: undefined,
    });
  });
});

describe('Beacon platform-divergent field parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    Object.keys(eventCallbacks).forEach((key) => delete eventCallbacks[key]);
  });

  it('parses iOS discoverySources (two-eyes) and drops unknown tokens', () => {
    const { addBeaconsListener } = require('../index');
    const cb = jest.fn();
    addBeaconsListener(cb);

    eventCallbacks['bearound:beacons']!([
      { ...sampleBeaconIOS, discoverySources: ['coreLocation', 'bogus'] },
    ]);

    const beacon = cb.mock.calls[0][0][0];
    expect(beacon.discoverySources).toEqual(['coreLocation']);
    expect(beacon.alreadySynced).toBe(false);
  });

  it('parses Android rssiSamples + rssiRaw + isStale', () => {
    const { addBeaconsListener } = require('../index');
    const cb = jest.fn();
    addBeaconsListener(cb);

    eventCallbacks['bearound:beacons']!([sampleBeaconAndroid]);

    const beacon = cb.mock.calls[0][0][0];
    expect(beacon.rssiRaw).toBe(-61);
    expect(beacon.isStale).toBe(false);
    expect(beacon.rssiSamples).toEqual({
      count: 5,
      min: -64,
      max: -55,
      avg: -59.2,
      stdDev: 3.1,
      firstSeen: 1717000000000,
      lastSeen: 1717000005000,
    });
  });

  it('leaves platform-specific fields undefined when absent', () => {
    const { addBeaconsListener } = require('../index');
    const cb = jest.fn();
    addBeaconsListener(cb);

    eventCallbacks['bearound:beacons']!([
      {
        uuid: 'X',
        major: 1,
        minor: 2,
        rssi: -50,
        proximity: 'near',
        accuracy: 1,
        timestamp: 0,
      },
    ]);

    const beacon = cb.mock.calls[0][0][0];
    expect(beacon.discoverySources).toBeUndefined();
    expect(beacon.rssiSamples).toBeUndefined();
    expect(beacon.isStale).toBeUndefined();
  });
});

describe('Diagnostic accessors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  it.each([
    ['getSdkVersion', '3.0.0'],
    ['getCurrentScanPrecision', 'medium'],
    ['isConfigured', true],
    ['isLocationAvailable', true],
    ['getAuthorizationStatus', 'always'],
  ] as const)('%s delegates to the native module', async (fn, expected) => {
    const mod = require('../index');
    await expect(mod[fn]()).resolves.toBe(expected);
  });
});

describe('Foreground scanning (Android-only)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  it('enableForegroundScanning forwards the config to native', async () => {
    const { enableForegroundScanning } = require('../index');
    await enableForegroundScanning({ notificationText: 'Perto de você' });
    expect(mockNativeModule.enableForegroundScanning).toHaveBeenCalledWith({
      notificationText: 'Perto de você',
    });
  });

  it('enableForegroundScanning defaults to an empty config', async () => {
    const { enableForegroundScanning } = require('../index');
    await enableForegroundScanning();
    expect(mockNativeModule.enableForegroundScanning).toHaveBeenCalledWith({});
  });

  it('setForegroundNotificationContent forwards title/text', async () => {
    const { setForegroundNotificationContent } = require('../index');
    await setForegroundNotificationContent({ title: 'Loja', text: 'Ofertas!' });
    expect(
      mockNativeModule.setForegroundNotificationContent
    ).toHaveBeenCalledWith({ title: 'Loja', text: 'Ofertas!' });
  });

  it('isForegroundScanningEnabled resolves the native value', async () => {
    const { isForegroundScanningEnabled } = require('../index');
    await expect(isForegroundScanningEnabled()).resolves.toBe(false);
  });
});

describe('Bluetooth state (two-eyes anyOf gating)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    Object.keys(eventCallbacks).forEach((key) => delete eventCallbacks[key]);
  });

  it('getBluetoothState normalizes the native value', async () => {
    const { getBluetoothState } = require('../index');
    await expect(getBluetoothState()).resolves.toBe('poweredOn');
  });

  it('getBluetoothState falls back to "unknown" for a bogus value', async () => {
    mockNativeModule.getBluetoothState.mockResolvedValueOnce('garbage');
    const { getBluetoothState } = require('../index');
    await expect(getBluetoothState()).resolves.toBe('unknown');
  });

  it('addBluetoothStateListener parses {state} payloads', () => {
    const { addBluetoothStateListener } = require('../index');
    const cb = jest.fn();
    addBluetoothStateListener(cb);

    eventCallbacks['bearound:bluetoothState']!({ state: 'poweredOff' });
    expect(cb).toHaveBeenCalledWith('poweredOff');

    eventCallbacks['bearound:bluetoothState']!({ state: 'nope' });
    expect(cb).toHaveBeenCalledWith('unknown');
  });
});
