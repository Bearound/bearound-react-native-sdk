import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  configure(
    businessToken: string,
    scanPrecision: string,
    maxQueuedPayloads: number
  ): Promise<void>;

  startScanning(): Promise<void>;
  stopScanning(): Promise<void>;
  isScanning(): Promise<boolean>;

  setUserProperties(properties: Object): Promise<void>;
  clearUserProperties(): Promise<void>;

  checkPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;

  // Diagnostic / state getters (parity with native public API).
  // Platform-divergent values resolve to a neutral default on the platform
  // that lacks the underlying native API (see index.tsx docs).
  getSdkVersion(): Promise<string>;
  getCurrentScanPrecision(): Promise<string>;
  getBleDiagnosticInfo(): Promise<string>;
  getPendingBatchCount(): Promise<number>;
  isConfigured(): Promise<boolean>;
  isLocationAvailable(): Promise<boolean>;
  getAuthorizationStatus(): Promise<string>;
  getBluetoothState(): Promise<string>;
  requestLocationAuthorization(level: string): Promise<void>;

  // Persistent detection log written natively (survives termination / captures
  // closed-state events). Returns a JSON string array of entries
  // (iOS-only; Android resolves '[]').
  getPersistedLog(): Promise<string>;
  clearPersistedLog(): Promise<void>;

  // Foreground-service scanning (Android-only; no-op on iOS).
  enableForegroundScanning(config: Object): Promise<void>;
  disableForegroundScanning(): Promise<void>;
  isForegroundScanningEnabled(): Promise<boolean>;
  setForegroundNotificationContent(content: Object): Promise<void>;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BearoundReactSdk');
