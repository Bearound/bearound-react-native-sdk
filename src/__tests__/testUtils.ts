/**
 * @fileoverview Test setup and shared mocks for Bearound React Native SDK tests
 *
 * This file provides reusable mock implementations for native modules and
 * React Native APIs used across all test files.
 */

// Mock native module functions
export const mockNativeModule = {
  configure: jest.fn(
    (
      _businessToken: string,
      _scanPrecision: string,
      _maxQueuedPayloads: number
    ) => Promise.resolve()
  ),
  startScanning: jest.fn(() => Promise.resolve()),
  stopScanning: jest.fn(() => Promise.resolve()),
  isScanning: jest.fn(() => Promise.resolve(false)),
  setUserProperties: jest.fn(() => Promise.resolve()),
  clearUserProperties: jest.fn(() => Promise.resolve()),
  checkPermissions: jest.fn(() => Promise.resolve(true)),
  requestPermissions: jest.fn(() => Promise.resolve(true)),
  checkNotificationPermission: jest.fn(() => Promise.resolve(true)),
  getSdkVersion: jest.fn(() => Promise.resolve('3.0.0')),
  getCurrentScanPrecision: jest.fn(() => Promise.resolve('medium')),
  getBleDiagnosticInfo: jest.fn(() => Promise.resolve('')),
  getPendingBatchCount: jest.fn(() => Promise.resolve(0)),
  isConfigured: jest.fn(() => Promise.resolve(true)),
  isLocationAvailable: jest.fn(() => Promise.resolve(true)),
  getAuthorizationStatus: jest.fn(() => Promise.resolve('always')),
  getBluetoothState: jest.fn(() => Promise.resolve('poweredOn')),
  getPersistedLog: jest.fn(() => Promise.resolve('[]')),
  clearPersistedLog: jest.fn(() => Promise.resolve()),
  requestLocationAuthorization: jest.fn(() => Promise.resolve()),
  enableForegroundScanning: jest.fn(() => Promise.resolve()),
  disableForegroundScanning: jest.fn(() => Promise.resolve()),
  isForegroundScanningEnabled: jest.fn(() => Promise.resolve(false)),
  setForegroundNotificationContent: jest.fn(() => Promise.resolve()),
  isIgnoringBatteryOptimizations: jest.fn(() => Promise.resolve(true)),
  openBatteryOptimizationSettings: jest.fn(() => Promise.resolve(true)),
  isAutostartManageable: jest.fn(() => Promise.resolve(false)),
  openManufacturerAutostartSettings: jest.fn(() => Promise.resolve(false)),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
};

// Sample beacon with iOS-only two-eyes fields (discoverySources).
export const sampleBeaconIOS = {
  uuid: 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
  major: 200,
  minor: 75,
  rssi: -58,
  proximity: 'near',
  accuracy: 1.2,
  timestamp: Date.now(),
  discoverySources: ['coreLocation', 'serviceUUID'],
  alreadySynced: false,
};

// Sample beacon with Android-only fields (rssiSamples / isStale).
export const sampleBeaconAndroid = {
  uuid: 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
  major: 200,
  minor: 75,
  rssi: -58,
  proximity: 'near',
  accuracy: 1.2,
  timestamp: Date.now(),
  rssiRaw: -61,
  isStale: false,
  rssiSamples: {
    count: 5,
    min: -64,
    max: -55,
    avg: -59.2,
    stdDev: 3.1,
    firstSeen: 1717000000000,
    lastSeen: 1717000005000,
  },
};

// Mock event emitter
export const mockEventEmitter = {
  addListener: jest.fn(
    (_eventName: string, _callback: (event: unknown) => void) => ({
      remove: jest.fn(),
    })
  ),
  removeAllListeners: jest.fn(),
  removeSubscription: jest.fn(),
};

// Helper to setup platform mock
export const setPlatform = (os: 'android' | 'ios', version: number = 31) => {
  const Platform = require('react-native').Platform;
  Platform.OS = os;
  Platform.Version = version;
};

// Reset all mocks
export const resetMocks = () => {
  Object.values(mockNativeModule).forEach((mock) => {
    if (typeof mock === 'function' && 'mockClear' in mock) {
      (mock as jest.Mock).mockClear();
    }
  });
  mockEventEmitter.addListener.mockClear();
  mockEventEmitter.removeAllListeners.mockClear();
};

// Sample test data
export const sampleBeaconData = {
  uuid: 'B9407F30-F5F8-466E-AFF9-25556B57FE6D',
  major: 100,
  minor: 50,
  rssi: -65,
  proximity: 'near',
  accuracy: 1.5,
  timestamp: Date.now(),
  metadata: {
    firmwareVersion: '4',
    batteryLevel: 3269,
    movements: 120,
    temperature: 22.5,
    txPower: -12,
    rssiFromBLE: -60,
    isConnectable: true,
  },
  txPower: -12,
};

export const sampleBeaconDataMinimal = {
  uuid: 'A0B13730-3A9A-11E8-8D21-6F8F8A8F8F8F',
  major: 1,
  minor: 1,
  rssi: -90,
  proximity: 'far',
  accuracy: 10.0,
  timestamp: Date.now(),
};

export const sampleUserProperties = {
  internalId: 'user-123',
  email: 'test@bearound.com',
  name: 'Test User',
  customProperties: {
    plan: 'premium',
    region: 'brazil',
  },
};
