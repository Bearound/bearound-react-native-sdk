/**
 * @fileoverview Tests for SDK permission management
 *
 * Tests checkPermissions, ensurePermissions, requestForegroundPermissions, requestBackgroundLocation
 * for both Android and iOS platforms.
 */

import { mockNativeModule, resetMocks } from './testUtils';

// Create mock references that can be modified in tests
let mockPlatformOS = 'android';
let mockPlatformVersion = 31;

const mockPermissionsAndroid = {
  PERMISSIONS: {
    ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION',
    ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION',
    ACCESS_BACKGROUND_LOCATION: 'android.permission.ACCESS_BACKGROUND_LOCATION',
    BLUETOOTH_SCAN: 'android.permission.BLUETOOTH_SCAN',
    BLUETOOTH_CONNECT: 'android.permission.BLUETOOTH_CONNECT',
    POST_NOTIFICATIONS: 'android.permission.POST_NOTIFICATIONS',
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    NEVER_ASK_AGAIN: 'never_ask_again',
  },
  check: jest.fn((_permission?: string) => Promise.resolve(true)),
  request: jest.fn((_permission?: string, _options?: any) =>
    Promise.resolve('granted')
  ),
};

const mockLinking = {
  openSettings: jest.fn(() => Promise.resolve()),
};

// Mock React Native with getters for Platform
jest.mock('react-native', () => ({
  get Platform() {
    return {
      get OS() {
        return mockPlatformOS;
      },
      get Version() {
        return mockPlatformVersion;
      },
    };
  },
  NativeModules: {
    BearoundReactSdk: {},
  },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  })),
  PermissionsAndroid: mockPermissionsAndroid,
  Linking: mockLinking,
  TurboModuleRegistry: {
    getEnforcing: jest.fn(() => mockNativeModule),
  },
}));

// Mock native module
jest.mock('../NativeBearoundReactSdk', () => ({
  __esModule: true,
  default: mockNativeModule,
}));

describe('Permission Management', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
    // Reset to Android defaults
    mockPlatformOS = 'android';
    mockPlatformVersion = 31;
    // Reset default mock behavior
    mockPermissionsAndroid.check.mockResolvedValue(true);
    mockPermissionsAndroid.request.mockResolvedValue('granted');
  });

  describe('checkPermissions()', () => {
    describe('Android', () => {
      beforeEach(() => {
        mockPlatformOS = 'android';
        mockPlatformVersion = 31;
      });

      it('should return all true when all permissions granted', async () => {
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

      it('should check fine location permission', async () => {
        mockPermissionsAndroid.check.mockImplementation(
          (_permission?: string) => {
            return Promise.resolve(true);
          }
        );
        const { checkPermissions } = require('../permissions');

        await checkPermissions();

        expect(mockPermissionsAndroid.check).toHaveBeenCalled();
      });

      it('should return false for fineLocation when both fine and coarse denied', async () => {
        mockPermissionsAndroid.check.mockImplementation(
          (_permission?: string) => {
            if (_permission?.includes('FINE_LOCATION'))
              return Promise.resolve(false);
            if (_permission?.includes('COARSE_LOCATION'))
              return Promise.resolve(false);
            return Promise.resolve(true);
          }
        );
        const { checkPermissions } = require('../permissions');

        const result = await checkPermissions();

        expect(result.fineLocation).toBe(false);
      });

      it('should return true for fineLocation if coarse is granted', async () => {
        mockPermissionsAndroid.check.mockImplementation(
          (_permission?: string) => {
            if (_permission?.includes('FINE_LOCATION'))
              return Promise.resolve(false);
            if (_permission?.includes('COARSE_LOCATION'))
              return Promise.resolve(true);
            return Promise.resolve(true);
          }
        );
        const { checkPermissions } = require('../permissions');

        const result = await checkPermissions();

        expect(result.fineLocation).toBe(true);
      });

      it('should return btScan true on Android < 31', async () => {
        mockPlatformVersion = 30;
        jest.resetModules();
        mockPlatformOS = 'android';

        // Re-mock the modules after reset
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 30;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));

        const { checkPermissions } = require('../permissions');
        const result = await checkPermissions();

        expect(result.btScan).toBe(true);
        expect(result.btConnect).toBe(true);
      });

      it('should return backgroundLocation true on Android < 29', async () => {
        jest.resetModules();

        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 28;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));

        const { checkPermissions } = require('../permissions');
        const result = await checkPermissions();

        expect(result.backgroundLocation).toBe(true);
      });
    });

    describe('iOS', () => {
      beforeEach(() => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'ios';
              },
              get Version() {
                return 17;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
      });

      it('should call native checkPermissions on iOS', async () => {
        mockNativeModule.checkPermissions.mockResolvedValue(true);
        const { checkPermissions } = require('../permissions');

        await checkPermissions();

        expect(mockNativeModule.checkPermissions).toHaveBeenCalled();
      });

      it('should return all true when native returns true', async () => {
        mockNativeModule.checkPermissions.mockResolvedValue(true);
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

      it('should return false fields when native returns false', async () => {
        mockNativeModule.checkPermissions.mockResolvedValue(false);
        const { checkPermissions } = require('../permissions');

        const result = await checkPermissions();

        expect(result).toEqual({
          fineLocation: false,
          btScan: false,
          btConnect: false,
          notifications: true,
          backgroundLocation: false,
        });
      });
    });
  });

  describe('requestForegroundPermissions()', () => {
    describe('Android', () => {
      it('should request fine location permission on Android', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 31;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));

        const { requestForegroundPermissions } = require('../permissions');
        await requestForegroundPermissions();

        expect(mockPermissionsAndroid.request).toHaveBeenCalled();
      });

      it('should request coarse location if fine is denied', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 31;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));

        mockPermissionsAndroid.request.mockImplementation(
          (_permission?: string) => {
            if (_permission?.includes('FINE_LOCATION'))
              return Promise.resolve('denied');
            return Promise.resolve('granted');
          }
        );

        const { requestForegroundPermissions } = require('../permissions');
        await requestForegroundPermissions();

        // Should have made multiple requests: fine, coarse, bt_scan, bt_connect
        // (notifications only on API 33+)
        expect(mockPermissionsAndroid.request).toHaveBeenCalledTimes(4);
      });

      it('should return permission result', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 31;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
        mockPermissionsAndroid.request.mockResolvedValue('granted');
        mockPermissionsAndroid.check.mockResolvedValue(true);

        const { requestForegroundPermissions } = require('../permissions');
        const result = await requestForegroundPermissions();

        expect(result).toHaveProperty('fineLocation');
        expect(result).toHaveProperty('btScan');
        expect(result).toHaveProperty('btConnect');
        expect(result).toHaveProperty('notifications');
        expect(result).toHaveProperty('backgroundLocation');
      });

      it('should skip BT permissions on Android < 31', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 30;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));

        const { requestForegroundPermissions } = require('../permissions');
        const result = await requestForegroundPermissions();

        expect(result.btScan).toBe(true);
        expect(result.btConnect).toBe(true);
      });
    });

    describe('iOS', () => {
      beforeEach(() => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'ios';
              },
              get Version() {
                return 17;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
      });

      it('should call native requestPermissions on iOS', async () => {
        mockNativeModule.requestPermissions.mockResolvedValue(true);
        const { requestForegroundPermissions } = require('../permissions');

        await requestForegroundPermissions();

        expect(mockNativeModule.requestPermissions).toHaveBeenCalled();
      });

      it('should return all true when native returns true', async () => {
        mockNativeModule.requestPermissions.mockResolvedValue(true);
        const { requestForegroundPermissions } = require('../permissions');

        const result = await requestForegroundPermissions();

        expect(result).toEqual({
          fineLocation: true,
          btScan: true,
          btConnect: true,
          notifications: true,
          backgroundLocation: true,
        });
      });
    });
  });

  describe('requestBackgroundLocation()', () => {
    describe('Android', () => {
      beforeEach(() => {
        mockPlatformOS = 'android';
        mockPlatformVersion = 31;
      });

      it('should return true on Android < 29', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 28;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));

        const { requestBackgroundLocation } = require('../permissions');
        const result = await requestBackgroundLocation();

        expect(result).toBe(true);
      });

      it('should request background location on Android 29+', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 29;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
        mockPermissionsAndroid.check.mockResolvedValue(true);
        mockPermissionsAndroid.request.mockResolvedValue('granted');

        const { requestBackgroundLocation } = require('../permissions');
        await requestBackgroundLocation();

        expect(mockPermissionsAndroid.request).toHaveBeenCalled();
      });

      it('should return true when granted', async () => {
        mockPermissionsAndroid.check.mockResolvedValue(true);
        mockPermissionsAndroid.request.mockResolvedValue('granted');
        const { requestBackgroundLocation } = require('../permissions');

        const result = await requestBackgroundLocation();

        expect(result).toBe(true);
      });

      it('should return false when denied', async () => {
        mockPermissionsAndroid.check.mockResolvedValue(true);
        mockPermissionsAndroid.request.mockResolvedValue('denied');
        const { requestBackgroundLocation } = require('../permissions');

        const result = await requestBackgroundLocation();

        expect(result).toBe(false);
      });

      it('should open settings when NEVER_ASK_AGAIN', async () => {
        mockPermissionsAndroid.check.mockResolvedValue(true);
        mockPermissionsAndroid.request.mockResolvedValue('never_ask_again');
        const { requestBackgroundLocation } = require('../permissions');

        await requestBackgroundLocation();

        expect(mockLinking.openSettings).toHaveBeenCalled();
      });

      it('should return false if foreground location not granted on Android 29-30', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 30;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
        // Mock no fine/coarse location granted
        mockPermissionsAndroid.check.mockResolvedValue(false);

        const { requestBackgroundLocation } = require('../permissions');
        const result = await requestBackgroundLocation();

        expect(result).toBe(false);
      });
    });

    describe('iOS', () => {
      beforeEach(() => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'ios';
              },
              get Version() {
                return 17;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
      });

      it('should call native requestPermissions on iOS', async () => {
        mockNativeModule.requestPermissions.mockResolvedValue(true);
        const { requestBackgroundLocation } = require('../permissions');

        await requestBackgroundLocation();

        expect(mockNativeModule.requestPermissions).toHaveBeenCalled();
      });

      it('should return native result on iOS', async () => {
        mockNativeModule.requestPermissions.mockResolvedValue(false);
        const { requestBackgroundLocation } = require('../permissions');

        const result = await requestBackgroundLocation();

        expect(result).toBe(false);
      });
    });
  });

  describe('ensurePermissions()', () => {
    describe('Android', () => {
      it('should request foreground permissions', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 31;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
        mockPermissionsAndroid.request.mockResolvedValue('granted');

        const { ensurePermissions } = require('../permissions');
        await ensurePermissions();

        expect(mockPermissionsAndroid.request).toHaveBeenCalled();
      });

      it('should request background location by default', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 31;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
        mockPermissionsAndroid.check.mockResolvedValue(true);
        mockPermissionsAndroid.request.mockResolvedValue('granted');

        const { ensurePermissions } = require('../permissions');
        await ensurePermissions();

        // Should have requested background location
        const calls = mockPermissionsAndroid.request.mock.calls.map(
          (c: unknown[]) => c[0]
        );
        expect(calls).toContain(
          'android.permission.ACCESS_BACKGROUND_LOCATION'
        );
      });

      it('should skip background location when askBackground is false', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 31;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
        mockPermissionsAndroid.request.mockResolvedValue('granted');

        const { ensurePermissions } = require('../permissions');
        await ensurePermissions({ askBackground: false });

        const calls = mockPermissionsAndroid.request.mock.calls.map(
          (c: unknown[]) => c[0]
        );
        expect(calls).not.toContain(
          'android.permission.ACCESS_BACKGROUND_LOCATION'
        );
      });

      it('should return final permission status', async () => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'android';
              },
              get Version() {
                return 31;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
        mockPermissionsAndroid.check.mockResolvedValue(true);
        mockPermissionsAndroid.request.mockResolvedValue('granted');

        const { ensurePermissions } = require('../permissions');
        const result = await ensurePermissions();

        expect(result).toHaveProperty('fineLocation');
        expect(result).toHaveProperty('btScan');
        expect(result).toHaveProperty('btConnect');
        expect(result).toHaveProperty('notifications');
        expect(result).toHaveProperty('backgroundLocation');
      });
    });

    describe('iOS', () => {
      beforeEach(() => {
        jest.resetModules();
        jest.doMock('react-native', () => ({
          get Platform() {
            return {
              get OS() {
                return 'ios';
              },
              get Version() {
                return 17;
              },
            };
          },
          NativeModules: { BearoundReactSdk: {} },
          NativeEventEmitter: jest.fn(() => ({
            addListener: jest.fn(() => ({ remove: jest.fn() })),
          })),
          PermissionsAndroid: mockPermissionsAndroid,
          Linking: mockLinking,
          TurboModuleRegistry: {
            getEnforcing: jest.fn(() => mockNativeModule),
          },
        }));
        jest.doMock('../NativeBearoundReactSdk', () => ({
          __esModule: true,
          default: mockNativeModule,
        }));
      });

      it('should call native requestPermissions on iOS', async () => {
        mockNativeModule.requestPermissions.mockResolvedValue(true);
        mockNativeModule.checkPermissions.mockResolvedValue(true);
        const { ensurePermissions } = require('../permissions');

        await ensurePermissions();

        expect(mockNativeModule.requestPermissions).toHaveBeenCalled();
      });

      it('should return checkPermissions result', async () => {
        mockNativeModule.requestPermissions.mockResolvedValue(true);
        mockNativeModule.checkPermissions.mockResolvedValue(true);
        const { ensurePermissions } = require('../permissions');

        const result = await ensurePermissions();

        expect(result).toEqual({
          fineLocation: true,
          btScan: true,
          btConnect: true,
          notifications: true,
          backgroundLocation: true,
        });
      });
    });
  });
});

describe('Permission API Exports', () => {
  it('should export all permission functions', () => {
    const permissions = require('../permissions');

    expect(typeof permissions.checkPermissions).toBe('function');
    expect(typeof permissions.ensurePermissions).toBe('function');
    expect(typeof permissions.requestForegroundPermissions).toBe('function');
    expect(typeof permissions.requestBackgroundLocation).toBe('function');
  });

  it('should export PermissionResult type (compile-time)', () => {
    const permissions = require('../permissions');
    expect(permissions).toBeDefined();
  });
});
