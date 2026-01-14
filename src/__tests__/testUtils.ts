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
      _foregroundScanInterval: number,
      _backgroundScanInterval: number,
      _maxQueuedPayloads: number,
      _enableBluetoothScanning: boolean,
      _enablePeriodicScanning: boolean
    ) => Promise.resolve()
  ),
  startScanning: jest.fn(() => Promise.resolve()),
  stopScanning: jest.fn(() => Promise.resolve()),
  isScanning: jest.fn(() => Promise.resolve(false)),
  setBluetoothScanning: jest.fn(() => Promise.resolve()),
  setUserProperties: jest.fn(() => Promise.resolve()),
  clearUserProperties: jest.fn(() => Promise.resolve()),
  checkPermissions: jest.fn(() => Promise.resolve(true)),
  requestPermissions: jest.fn(() => Promise.resolve(true)),
  addListener: jest.fn(),
  removeListeners: jest.fn(),
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

// Mock subscription
export const createMockSubscription = () => ({
  remove: jest.fn(),
});

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
    firmwareVersion: '4.1.0',
    batteryLevel: 95,
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

export const sampleSyncStatus = {
  secondsUntilNextSync: 30,
  isRanging: true,
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
