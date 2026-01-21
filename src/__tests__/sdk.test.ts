/**
 * @fileoverview Tests for main SDK functions (configure, scanning, user properties)
 *
 * Tests the core SDK functionality exported from index.tsx
 */

import {
  mockNativeModule,
  sampleUserProperties,
  resetMocks,
  setPlatform,
} from './testUtils';

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
    addListener: jest.fn(
      (_eventName: string, _callback: (event: unknown) => void) => ({
        remove: jest.fn(),
      })
    ),
    removeAllListeners: jest.fn(),
  })),
  PermissionsAndroid: {
    PERMISSIONS: {
      ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
      ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
      ACCESS_BACKGROUND_LOCATION:
        'android.permission.ACCESS_BACKGROUND_LOCATION',
      BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
      BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
      POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
      NEVER_ASK_AGAIN: 'never_ask_again',
    },
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

describe('Bearound SDK Core Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    setPlatform('android', 31);
  });

  describe('configure()', () => {
    it('should throw error when businessToken is not provided', async () => {
      const { configure } = require('../index');

      await expect(configure({} as any)).rejects.toThrow(
        'Business token is required'
      );
    });

    it('should throw error when businessToken is empty', async () => {
      const { configure } = require('../index');

      await expect(configure({ businessToken: '' })).rejects.toThrow(
        'Business token is required'
      );
    });

    it('should throw error when businessToken is only whitespace', async () => {
      const { configure } = require('../index');

      await expect(configure({ businessToken: '   ' })).rejects.toThrow(
        'Business token is required'
      );
    });

    it('should call native configure with businessToken and default values', async () => {
      const { configure } = require('../index');

      await configure({ businessToken: 'test-token-123' });

      expect(mockNativeModule.configure).toHaveBeenCalledWith(
        'test-token-123',
        15, // ForegroundScanInterval.SECONDS_15
        30, // BackgroundScanInterval.SECONDS_30
        100, // MaxQueuedPayloads.MEDIUM
        false,
        true
      );
    });

    it('should call native configure with custom businessToken', async () => {
      const { configure } = require('../index');

      await configure({ businessToken: 'custom-token' });

      expect(mockNativeModule.configure).toHaveBeenCalledWith(
        'custom-token',
        15, // default foreground
        30, // default background
        100, // default max queued
        false,
        true
      );
    });

    it('should call native configure with custom foregroundScanInterval', async () => {
      const { configure, ForegroundScanInterval } = require('../index');

      await configure({
        businessToken: 'test-token',
        foregroundScanInterval: ForegroundScanInterval.SECONDS_60,
      });

      expect(mockNativeModule.configure).toHaveBeenCalledWith(
        'test-token',
        60,
        30, // default background
        100, // default max queued
        false,
        true
      );
    });

    it('should call native configure with bluetooth scanning enabled', async () => {
      const { configure } = require('../index');

      await configure({
        businessToken: 'test-token',
        enableBluetoothScanning: true,
      });

      expect(mockNativeModule.configure).toHaveBeenCalledWith(
        'test-token',
        15,
        30,
        100,
        true,
        true
      );
    });

    it('should call native configure with periodic scanning disabled', async () => {
      const { configure } = require('../index');

      await configure({
        businessToken: 'test-token',
        enablePeriodicScanning: false,
      });

      expect(mockNativeModule.configure).toHaveBeenCalledWith(
        'test-token',
        15,
        30,
        100,
        false,
        false
      );
    });

    it('should call native configure with all custom options', async () => {
      const {
        configure,
        ForegroundScanInterval,
        BackgroundScanInterval,
        MaxQueuedPayloads,
      } = require('../index');

      await configure({
        businessToken: 'my-business-token',
        foregroundScanInterval: ForegroundScanInterval.SECONDS_45,
        backgroundScanInterval: BackgroundScanInterval.SECONDS_60,
        maxQueuedPayloads: MaxQueuedPayloads.LARGE,
        enableBluetoothScanning: true,
        enablePeriodicScanning: false,
      });

      expect(mockNativeModule.configure).toHaveBeenCalledWith(
        'my-business-token',
        45,
        60,
        200,
        true,
        false
      );
    });

    it('should trim whitespace from businessToken', async () => {
      const { configure } = require('../index');

      await configure({ businessToken: '  my-token  ' });

      expect(mockNativeModule.configure).toHaveBeenCalledWith(
        'my-token',
        15,
        30,
        100,
        false,
        true
      );
    });
  });

  describe('startScanning()', () => {
    it('should call native startScanning', async () => {
      const { startScanning } = require('../index');

      await startScanning();

      expect(mockNativeModule.startScanning).toHaveBeenCalled();
    });

    it('should handle native errors', async () => {
      mockNativeModule.startScanning.mockRejectedValueOnce(
        new Error('SDK not configured')
      );
      const { startScanning } = require('../index');

      await expect(startScanning()).rejects.toThrow('SDK not configured');
    });
  });

  describe('stopScanning()', () => {
    it('should call native stopScanning', async () => {
      const { stopScanning } = require('../index');

      await stopScanning();

      expect(mockNativeModule.stopScanning).toHaveBeenCalled();
    });

    it('should handle native errors', async () => {
      mockNativeModule.stopScanning.mockRejectedValueOnce(
        new Error('Already stopped')
      );
      const { stopScanning } = require('../index');

      await expect(stopScanning()).rejects.toThrow('Already stopped');
    });
  });

  describe('isScanning()', () => {
    it('should return false when not scanning', async () => {
      mockNativeModule.isScanning.mockResolvedValueOnce(false);
      const { isScanning } = require('../index');

      const result = await isScanning();

      expect(result).toBe(false);
      expect(mockNativeModule.isScanning).toHaveBeenCalled();
    });

    it('should return true when scanning', async () => {
      mockNativeModule.isScanning.mockResolvedValueOnce(true);
      const { isScanning } = require('../index');

      const result = await isScanning();

      expect(result).toBe(true);
    });
  });

  describe('setBluetoothScanning()', () => {
    it('should enable bluetooth scanning', async () => {
      const { setBluetoothScanning } = require('../index');

      await setBluetoothScanning(true);

      expect(mockNativeModule.setBluetoothScanning).toHaveBeenCalledWith(true);
    });

    it('should disable bluetooth scanning', async () => {
      const { setBluetoothScanning } = require('../index');

      await setBluetoothScanning(false);

      expect(mockNativeModule.setBluetoothScanning).toHaveBeenCalledWith(false);
    });
  });

  describe('setUserProperties()', () => {
    it('should set user properties with all fields', async () => {
      const { setUserProperties } = require('../index');

      await setUserProperties(sampleUserProperties);

      expect(mockNativeModule.setUserProperties).toHaveBeenCalledWith(
        sampleUserProperties
      );
    });

    it('should set user properties with partial fields', async () => {
      const { setUserProperties } = require('../index');

      await setUserProperties({ email: 'test@example.com' });

      expect(mockNativeModule.setUserProperties).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });

    it('should set user properties with custom properties', async () => {
      const { setUserProperties } = require('../index');
      const props = {
        customProperties: {
          tier: 'gold',
          store: 'main-store',
        },
      };

      await setUserProperties(props);

      expect(mockNativeModule.setUserProperties).toHaveBeenCalledWith(props);
    });
  });

  describe('clearUserProperties()', () => {
    it('should call native clearUserProperties', async () => {
      const { clearUserProperties } = require('../index');

      await clearUserProperties();

      expect(mockNativeModule.clearUserProperties).toHaveBeenCalled();
    });
  });
});

describe('SDK Exports', () => {
  it('should export all required functions', () => {
    const SDK = require('../index');

    // Core functions
    expect(typeof SDK.configure).toBe('function');
    expect(typeof SDK.startScanning).toBe('function');
    expect(typeof SDK.stopScanning).toBe('function');
    expect(typeof SDK.isScanning).toBe('function');
    expect(typeof SDK.setBluetoothScanning).toBe('function');

    // User properties
    expect(typeof SDK.setUserProperties).toBe('function');
    expect(typeof SDK.clearUserProperties).toBe('function');

    // Event listeners
    expect(typeof SDK.addBeaconsListener).toBe('function');
    expect(typeof SDK.addSyncLifecycleListener).toBe('function');
    expect(typeof SDK.addBackgroundDetectionListener).toBe('function');
    expect(typeof SDK.addScanningListener).toBe('function');
    expect(typeof SDK.addErrorListener).toBe('function');

    // Permissions
    expect(typeof SDK.checkPermissions).toBe('function');
    expect(typeof SDK.ensurePermissions).toBe('function');
    expect(typeof SDK.requestForegroundPermissions).toBe('function');
    expect(typeof SDK.requestBackgroundLocation).toBe('function');
  });

  it('should export TypeScript types', () => {
    // TypeScript types are compile-time only, but we can verify
    // that the module structure is correct
    const SDK = require('../index');

    expect(SDK).toBeDefined();
  });
});
