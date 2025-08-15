import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type Beacon = {
  uuid: string;
  major: string;
  minor: string;
  rssi: number;
  bluetoothName?: string;
  bluetoothAddress?: string;
  distanceMeters?: number;
};

export interface Spec extends TurboModule {
  initialize(clientToken: string, debug?: boolean): Promise<void>;
  stop(): Promise<void>;

  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('BearoundReactSdk');
