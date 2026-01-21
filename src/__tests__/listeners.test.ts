/**
 * @fileoverview Tests for SDK event listeners and data parsing
 *
 * Tests addBeaconsListener, addSyncStatusListener, addScanningListener, addErrorListener
 * and the parsing functions for beacon data, sync status, and errors.
 */

import {
  mockNativeModule,
  sampleBeaconData,
  sampleBeaconDataMinimal,
  resetMocks,
} from './testUtils';

// Store event callbacks for testing
const eventCallbacks: Record<string, (event: unknown) => void> = {};

const mockAddListener = jest.fn(
  (eventName: string, callback: (event: unknown) => void) => {
    eventCallbacks[eventName] = callback;
    return { remove: jest.fn() };
  }
);

// Mock React Native
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 31,
  },
  NativeModules: {
    BearoundReactSdk: {},
  },
  NativeEventEmitter: jest.fn(() => ({
    addListener: mockAddListener,
    removeAllListeners: jest.fn(),
  })),
  PermissionsAndroid: {
    PERMISSIONS: {},
    RESULTS: { GRANTED: 'granted' },
    check: jest.fn(() => Promise.resolve(true)),
    request: jest.fn(() => Promise.resolve('granted')),
  },
  Linking: {
    openSettings: jest.fn(() => Promise.resolve()),
  },
  TurboModuleRegistry: {
    getEnforcing: jest.fn(() => mockNativeModule),
  },
}));

// Mock native module
jest.mock('../NativeBearoundReactSdk', () => ({
  __esModule: true,
  default: mockNativeModule,
}));

describe('Event Listeners', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    Object.keys(eventCallbacks).forEach((key) => delete eventCallbacks[key]);
  });

  describe('addBeaconsListener()', () => {
    it('should register listener for bearound:beacons event', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);

      expect(mockAddListener).toHaveBeenCalledWith(
        'bearound:beacons',
        expect.any(Function)
      );
    });

    it('should return subscription with remove function', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      const subscription = addBeaconsListener(callback);

      expect(subscription).toHaveProperty('remove');
      expect(typeof subscription.remove).toBe('function');
    });

    it('should parse beacons from array event', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);

      // Simulate native event
      const event = [sampleBeaconData, sampleBeaconDataMinimal];
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!(event);

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            uuid: sampleBeaconData.uuid,
            major: sampleBeaconData.major,
            minor: sampleBeaconData.minor,
            rssi: sampleBeaconData.rssi,
            proximity: 'near',
          }),
        ])
      );
    });

    it('should parse beacons from object with beacons property', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);

      const event = { beacons: [sampleBeaconData] };
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!(event);

      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            uuid: sampleBeaconData.uuid,
          }),
        ])
      );
    });

    it('should return empty array for invalid event', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!(null);

      expect(callback).toHaveBeenCalledWith([]);
    });

    it('should return empty array for non-object event', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!('invalid');

      expect(callback).toHaveBeenCalledWith([]);
    });

    it('should parse beacon metadata correctly', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([sampleBeaconData]);

      const beacons = callback.mock.calls[0][0];
      expect(beacons[0].metadata).toEqual({
        firmwareVersion: '4.1.0',
        batteryLevel: 95,
        movements: 120,
        temperature: 22.5,
        txPower: -12,
        rssiFromBLE: -60,
        isConnectable: true,
      });
    });

    it('should handle beacon without metadata', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([sampleBeaconDataMinimal]);

      const beacons = callback.mock.calls[0][0];
      expect(beacons[0].metadata).toBeUndefined();
    });
  });

  describe('addSyncLifecycleListener()', () => {
    it('should register listener for bearound:syncLifecycle event', () => {
      const { addSyncLifecycleListener } = require('../index');
      const callback = jest.fn();

      addSyncLifecycleListener(callback);

      expect(mockAddListener).toHaveBeenCalledWith(
        'bearound:syncLifecycle',
        expect.any(Function)
      );
    });

    it('should parse sync started event correctly', () => {
      const { addSyncLifecycleListener } = require('../index');
      const callback = jest.fn();

      addSyncLifecycleListener(callback);
      const syncCallback = eventCallbacks['bearound:syncLifecycle'];
      expect(syncCallback).toBeDefined();
      syncCallback!({ type: 'started', beaconCount: 5 });

      expect(callback).toHaveBeenCalledWith({
        type: 'started',
        beaconCount: 5,
        success: undefined,
        error: undefined,
      });
    });

    it('should parse sync completed success event correctly', () => {
      const { addSyncLifecycleListener } = require('../index');
      const callback = jest.fn();

      addSyncLifecycleListener(callback);
      const syncCallback = eventCallbacks['bearound:syncLifecycle'];
      expect(syncCallback).toBeDefined();
      syncCallback!({ type: 'completed', beaconCount: 5, success: true });

      expect(callback).toHaveBeenCalledWith({
        type: 'completed',
        beaconCount: 5,
        success: true,
        error: undefined,
      });
    });

    it('should parse sync completed failure event correctly', () => {
      const { addSyncLifecycleListener } = require('../index');
      const callback = jest.fn();

      addSyncLifecycleListener(callback);
      const syncCallback = eventCallbacks['bearound:syncLifecycle'];
      expect(syncCallback).toBeDefined();
      syncCallback!({
        type: 'completed',
        beaconCount: 5,
        success: false,
        error: 'Network error',
      });

      expect(callback).toHaveBeenCalledWith({
        type: 'completed',
        beaconCount: 5,
        success: false,
        error: 'Network error',
      });
    });
  });

  describe('addBackgroundDetectionListener()', () => {
    it('should register listener for bearound:backgroundDetection event', () => {
      const { addBackgroundDetectionListener } = require('../index');
      const callback = jest.fn();

      addBackgroundDetectionListener(callback);

      expect(mockAddListener).toHaveBeenCalledWith(
        'bearound:backgroundDetection',
        expect.any(Function)
      );
    });

    it('should parse background detection event correctly', () => {
      const { addBackgroundDetectionListener } = require('../index');
      const callback = jest.fn();

      addBackgroundDetectionListener(callback);
      const bgCallback = eventCallbacks['bearound:backgroundDetection'];
      expect(bgCallback).toBeDefined();
      bgCallback!({ beaconCount: 3 });

      expect(callback).toHaveBeenCalledWith({
        beaconCount: 3,
      });
    });

    it('should handle missing beaconCount with default', () => {
      const { addBackgroundDetectionListener } = require('../index');
      const callback = jest.fn();

      addBackgroundDetectionListener(callback);
      const bgCallback = eventCallbacks['bearound:backgroundDetection'];
      expect(bgCallback).toBeDefined();
      bgCallback!({});

      expect(callback).toHaveBeenCalledWith({
        beaconCount: 0,
      });
    });
  });

  describe('addScanningListener()', () => {
    it('should register listener for bearound:scanning event', () => {
      const { addScanningListener } = require('../index');
      const callback = jest.fn();

      addScanningListener(callback);

      expect(mockAddListener).toHaveBeenCalledWith(
        'bearound:scanning',
        expect.any(Function)
      );
    });

    it('should handle boolean event directly', () => {
      const { addScanningListener } = require('../index');
      const callback = jest.fn();

      addScanningListener(callback);
      const scanningCallback = eventCallbacks['bearound:scanning'];
      expect(scanningCallback).toBeDefined();
      scanningCallback!(true);

      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should handle boolean false event', () => {
      const { addScanningListener } = require('../index');
      const callback = jest.fn();

      addScanningListener(callback);
      const scanningCallback = eventCallbacks['bearound:scanning'];
      expect(scanningCallback).toBeDefined();
      scanningCallback!(false);

      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should parse isScanning from object event', () => {
      const { addScanningListener } = require('../index');
      const callback = jest.fn();

      addScanningListener(callback);
      const scanningCallback = eventCallbacks['bearound:scanning'];
      expect(scanningCallback).toBeDefined();
      scanningCallback!({ isScanning: true });

      expect(callback).toHaveBeenCalledWith(true);
    });

    it('should handle empty object as false', () => {
      const { addScanningListener } = require('../index');
      const callback = jest.fn();

      addScanningListener(callback);
      const scanningCallback = eventCallbacks['bearound:scanning'];
      expect(scanningCallback).toBeDefined();
      scanningCallback!({});

      expect(callback).toHaveBeenCalledWith(false);
    });
  });

  describe('addErrorListener()', () => {
    it('should register listener for bearound:error event', () => {
      const { addErrorListener } = require('../index');
      const callback = jest.fn();

      addErrorListener(callback);

      expect(mockAddListener).toHaveBeenCalledWith(
        'bearound:error',
        expect.any(Function)
      );
    });

    it('should handle string error event', () => {
      const { addErrorListener } = require('../index');
      const callback = jest.fn();

      addErrorListener(callback);
      const errorCallback = eventCallbacks['bearound:error'];
      expect(errorCallback).toBeDefined();
      errorCallback!('Bluetooth disabled');

      expect(callback).toHaveBeenCalledWith({
        message: 'Bluetooth disabled',
      });
    });

    it('should parse message from object event', () => {
      const { addErrorListener } = require('../index');
      const callback = jest.fn();

      addErrorListener(callback);
      const errorCallback = eventCallbacks['bearound:error'];
      expect(errorCallback).toBeDefined();
      errorCallback!({ message: 'Permission denied' });

      expect(callback).toHaveBeenCalledWith({
        message: 'Permission denied',
      });
    });

    it('should handle empty object with default message', () => {
      const { addErrorListener } = require('../index');
      const callback = jest.fn();

      addErrorListener(callback);
      const errorCallback = eventCallbacks['bearound:error'];
      expect(errorCallback).toBeDefined();
      errorCallback!({});

      expect(callback).toHaveBeenCalledWith({
        message: 'Unknown error',
      });
    });

    it('should handle null event with default message', () => {
      const { addErrorListener } = require('../index');
      const callback = jest.fn();

      addErrorListener(callback);
      const errorCallback = eventCallbacks['bearound:error'];
      expect(errorCallback).toBeDefined();
      errorCallback!(null);

      expect(callback).toHaveBeenCalledWith({
        message: 'Unknown error',
      });
    });
  });
});

describe('Data Parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    Object.keys(eventCallbacks).forEach((key) => delete eventCallbacks[key]);
  });

  describe('Beacon proximity parsing', () => {
    it('should parse "immediate" proximity', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, proximity: 'immediate' }]);

      expect(callback.mock.calls[0][0][0].proximity).toBe('immediate');
    });

    it('should parse "near" proximity', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, proximity: 'near' }]);

      expect(callback.mock.calls[0][0][0].proximity).toBe('near');
    });

    it('should parse "far" proximity', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, proximity: 'far' }]);

      expect(callback.mock.calls[0][0][0].proximity).toBe('far');
    });

    it('should default to "unknown" for invalid proximity', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, proximity: 'invalid' }]);

      expect(callback.mock.calls[0][0][0].proximity).toBe('unknown');
    });

    it('should handle case-insensitive proximity', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, proximity: 'NEAR' }]);

      expect(callback.mock.calls[0][0][0].proximity).toBe('near');
    });
  });

  describe('Number parsing', () => {
    it('should parse string numbers', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, rssi: '-65', major: '100' }]);

      const beacon = callback.mock.calls[0][0][0];
      expect(beacon.rssi).toBe(-65);
      expect(beacon.major).toBe(100);
    });

    it('should handle invalid numbers with fallback', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, rssi: 'invalid', major: null }]);

      const beacon = callback.mock.calls[0][0][0];
      expect(beacon.rssi).toBe(0);
      expect(beacon.major).toBe(0);
    });

    it('should handle NaN values', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, rssi: NaN }]);

      const beacon = callback.mock.calls[0][0][0];
      expect(beacon.rssi).toBe(0);
    });

    it('should handle Infinity values', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, rssi: Infinity }]);

      const beacon = callback.mock.calls[0][0][0];
      expect(beacon.rssi).toBe(0);
    });
  });

  describe('Metadata parsing', () => {
    it('should handle undefined metadata', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([sampleBeaconDataMinimal]);

      const beacon = callback.mock.calls[0][0][0];
      expect(beacon.metadata).toBeUndefined();
    });

    it('should handle null metadata', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, metadata: null }]);

      const beacon = callback.mock.calls[0][0][0];
      expect(beacon.metadata).toBeUndefined();
    });

    it('should handle array as invalid metadata', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([{ ...sampleBeaconData, metadata: [] }]);

      const beacon = callback.mock.calls[0][0][0];
      expect(beacon.metadata).toBeUndefined();
    });

    it('should handle partial metadata', () => {
      const { addBeaconsListener } = require('../index');
      const callback = jest.fn();

      addBeaconsListener(callback);
      const beaconsCallback = eventCallbacks['bearound:beacons'];
      expect(beaconsCallback).toBeDefined();
      beaconsCallback!([
        {
          ...sampleBeaconData,
          metadata: { firmwareVersion: '4.0.0', batteryLevel: 50 },
        },
      ]);

      const beacon = callback.mock.calls[0][0][0];
      expect(beacon.metadata).toEqual({
        firmwareVersion: '4.0.0',
        batteryLevel: 50,
        movements: 0,
        temperature: 0,
        txPower: undefined,
        rssiFromBLE: undefined,
        isConnectable: undefined,
      });
    });
  });
});
