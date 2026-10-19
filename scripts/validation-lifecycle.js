import { AppState } from 'react-native';
import * as SDK from '@bearound/react-native-sdk';

// Installed only by the validation app generator's explicit --smoke option.
// Wait for the app's real permission/configuration flow before probing lifecycle.
let running = false;
let attempts = 0;
const timer = setInterval(async () => {
  if (running || AppState.currentState !== 'active') return;
  running = true;
  try {
    if (!(await SDK.isScanning())) {
      if (++attempts >= 120) {
        clearInterval(timer);
        console.error(
          '[BearoundValidation] lifecycle timed out waiting for scan'
        );
      }
      return;
    }
    clearInterval(timer);
    console.info('[BearoundValidation] lifecycle initial scan confirmed');
    await new Promise((resolve) => setTimeout(resolve, 15000));
    await SDK.stopScanning();
    if (await SDK.isScanning())
      throw new Error('Scan remained active after stop');
    console.info('[BearoundValidation] lifecycle stop confirmed');
    await SDK.startScanning();
    if (!(await SDK.isScanning())) throw new Error('Scan did not restart');
    console.info('[BearoundValidation] lifecycle restart confirmed');
  } catch (error) {
    clearInterval(timer);
    console.error('[BearoundValidation] lifecycle failed', String(error));
  } finally {
    running = false;
  }
}, 1000);
