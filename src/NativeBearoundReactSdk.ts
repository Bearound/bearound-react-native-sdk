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

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BearoundReactSdk');
