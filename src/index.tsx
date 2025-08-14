import { NativeEventEmitter } from 'react-native';
import Native from './NativeBearoundReactSdk';

const emitter = new NativeEventEmitter(Native as any);

export const EVENTS = {
  BEACON: 'bearound:beacon',
  STOPPED: 'bearound:stopped',
} as const;

export type { Beacon } from './NativeBearoundReactSdk';

export async function initialize(clientToken: string, debug = false) {
  await Native.initialize(clientToken, debug);
}

export async function stop() {
  await Native.stop();
}

export function addBeaconListener(fn: (b: any) => void) {
  return emitter.addListener(EVENTS.BEACON, fn);
}

export function addStoppedListener(fn: () => void) {
  return emitter.addListener(EVENTS.STOPPED, fn);
}

export * from './permissions';
