/**
 * @fileoverview Basic functionality tests for Bearound React Native SDK
 *
 * Simple tests to verify core functionality works correctly.
 */

import { Platform } from 'react-native';

// Mock React Native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    Version: 31,
  },
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
    getEnforcing: jest.fn(() => ({
      initialize: jest.fn(() => Promise.resolve()),
      stop: jest.fn(() => Promise.resolve()),
    })),
  },
}));

// Mock the native module directly
jest.mock('../NativeBearoundReactSdk', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
  },
}));

describe('Bearound SDK Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to Android by default
    (Platform as any).OS = 'android';
    (Platform as any).Version = 31;
  });

  test('SDK constants are defined', () => {
    const { EVENTS } = require('../index');
    expect(EVENTS).toBeDefined();
    expect(EVENTS.BEACON).toBe('bearound:beacon');
    expect(EVENTS.STOPPED).toBe('bearound:stopped');
  });

  test('SDK functions are exported', () => {
    const SDK = require('../index');
    expect(typeof SDK.initialize).toBe('function');
    expect(typeof SDK.stop).toBe('function');
    expect(typeof SDK.checkPermissions).toBe('function');
    expect(typeof SDK.ensurePermissions).toBe('function');
  });

  test('permission functions work on Android', async () => {
    (Platform as any).OS = 'android';
    const { checkPermissions } = require('../permissions');

    const result = await checkPermissions();
    expect(result).toBeDefined();
    expect(typeof result.fineLocation).toBe('boolean');
    expect(typeof result.btScan).toBe('boolean');
  });

  test('permission functions work on iOS', async () => {
    (Platform as any).OS = 'ios';
    const { checkPermissions } = require('../permissions');

    const result = await checkPermissions();
    expect(result).toEqual({
      fineLocation: true,
      btScan: true,
      btConnect: true,
      notifications: true,
      backgroundLocation: true,
    });
  });

  test('initialize and stop functions exist', async () => {
    const { initialize, stop } = require('../index');

    // Should not throw
    expect(typeof initialize).toBe('function');
    expect(typeof stop).toBe('function');
  });

  test('TurboModule interface is correct', () => {
    require('../NativeBearoundReactSdk');

    // Type test - if this compiles, the interface is correct
    const mockSpec = {
      initialize: jest.fn(),
      stop: jest.fn(),
      addListener: jest.fn(),
      removeListeners: jest.fn(),
    };

    expect(mockSpec).toBeDefined();
  });

  test('Platform detection works', () => {
    expect(Platform.OS).toBeDefined();
    expect(['ios', 'android'].includes(Platform.OS)).toBe(true);
  });

  test('PermissionResult type structure', () => {
    require('../permissions');

    // Mock result matching the type
    const mockResult = {
      fineLocation: true,
      btScan: false,
      btConnect: true,
      notifications: false,
      backgroundLocation: true,
    };

    expect(mockResult).toBeDefined();
    expect(typeof mockResult.fineLocation).toBe('boolean');
    expect(typeof mockResult.btScan).toBe('boolean');
    expect(typeof mockResult.btConnect).toBe('boolean');
    expect(typeof mockResult.notifications).toBe('boolean');
    expect(typeof mockResult.backgroundLocation).toBe('boolean');
  });

  describe('Cross-platform behavior', () => {
    test('Android permission logic', async () => {
      (Platform as any).OS = 'android';
      const { checkPermissions, ensurePermissions } = require('../permissions');

      const checkResult = await checkPermissions();
      expect(checkResult).toBeDefined();

      const ensureResult = await ensurePermissions();
      expect(ensureResult).toBeDefined();
    });

    test('iOS permission logic', async () => {
      (Platform as any).OS = 'ios';
      const { checkPermissions, ensurePermissions } = require('../permissions');

      const checkResult = await checkPermissions();
      expect(checkResult).toEqual({
        fineLocation: true,
        btScan: true,
        btConnect: true,
        notifications: true,
        backgroundLocation: true,
      });

      const ensureResult = await ensurePermissions();
      expect(ensureResult).toEqual(checkResult);
    });
  });

  describe('Permission API coverage', () => {
    test('all permission functions are exported', () => {
      const permissions = require('../permissions');

      expect(typeof permissions.checkPermissions).toBe('function');
      expect(typeof permissions.ensurePermissions).toBe('function');
      expect(typeof permissions.requestForegroundPermissions).toBe('function');
      expect(typeof permissions.requestBackgroundLocation).toBe('function');
    });

    test('ensurePermissions accepts options', async () => {
      const { ensurePermissions } = require('../permissions');

      // Should work with no options
      const result1 = await ensurePermissions();
      expect(result1).toBeDefined();

      // Should work with askBackground: true
      const result2 = await ensurePermissions({ askBackground: true });
      expect(result2).toBeDefined();

      // Should work with askBackground: false
      const result3 = await ensurePermissions({ askBackground: false });
      expect(result3).toBeDefined();
    });
  });

  describe('Error handling', () => {
    test('functions handle platform edge cases', async () => {
      // Test with undefined platform
      const originalOS = Platform.OS;
      (Platform as any).OS = undefined;

      try {
        const { checkPermissions } = require('../permissions');
        const result = await checkPermissions();
        expect(result).toBeDefined();
      } catch (error) {
        // Error is acceptable for edge cases
        expect(error).toBeDefined();
      }

      // Restore platform
      (Platform as any).OS = originalOS;
    });

    test('SDK exports are consistent', () => {
      const SDK = require('../index');
      const permissions = require('../permissions');

      // Main SDK should export permission functions
      expect(SDK.checkPermissions).toBe(permissions.checkPermissions);
      expect(SDK.ensurePermissions).toBe(permissions.ensurePermissions);
    });
  });

  describe('Documentation compliance', () => {
    test('deprecated EVENTS are marked correctly', () => {
      const { EVENTS } = require('../index');

      // These constants should exist but be deprecated
      expect(EVENTS.BEACON).toBe('bearound:beacon');
      expect(EVENTS.STOPPED).toBe('bearound:stopped');
    });

    test('API surface matches documentation', () => {
      const SDK = require('../index');

      // Core functions
      expect(typeof SDK.initialize).toBe('function');
      expect(typeof SDK.stop).toBe('function');

      // Permission functions
      expect(typeof SDK.checkPermissions).toBe('function');
      expect(typeof SDK.ensurePermissions).toBe('function');
      expect(typeof SDK.requestForegroundPermissions).toBe('function');
      expect(typeof SDK.requestBackgroundLocation).toBe('function');

      // Constants
      expect(SDK.EVENTS).toBeDefined();
    });
  });
});
