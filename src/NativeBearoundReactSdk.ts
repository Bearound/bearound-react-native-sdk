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

  // Push token (FCM on Android, APNs on iOS). Forwarded to the native SDK,
  // which associates it with the stable deviceId and sends it on the next sync.
  setPushToken(token: string): Promise<void>;

  // Silent-push wake-up. Forwards an FCM data-message payload to the native SDK,
  // which restarts the scan and syncs when it recognizes a Bearound wake. Returns
  // true when handled. Android-only in practice; on iOS the AppDelegate handles
  // the silent push and this resolves false for non-Bearound payloads.
  handleRemoteMessage(data: Object): Promise<boolean>;

  checkPermissions(): Promise<boolean>;
  requestPermissions(): Promise<boolean>;

  // Real notification-permission status. iOS: UNUserNotificationCenter
  // getNotificationSettings (authorized/provisional/ephemeral). Android:
  // NotificationManagerCompat.areNotificationsEnabled().
  checkNotificationPermission(): Promise<boolean>;

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

  // Background reliability (Android-only; the OEM/Doze kill mitigation from
  // native SDK 3.4.5). iOS has no user-facing equivalent — the "open" methods
  // resolve false and isIgnoringBatteryOptimizations resolves true.
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  openBatteryOptimizationSettings(): Promise<boolean>;
  isAutostartManageable(): Promise<boolean>;
  openManufacturerAutostartSettings(): Promise<boolean>;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BearoundReactSdk');
