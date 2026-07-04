/**
 * @fileoverview Tests for the JS-layer error telemetry (src/errorReporter.ts).
 *
 * Locks the golden-rule behaviors: package-scoped filtering (never reports host
 * errors), dedupe + rate-limit, and never throwing when the transport fails.
 */

import { mockNativeModule } from './testUtils';

// react-native is imported transitively via ./permissions. Provide the minimal
// surface the reporter + permissions modules touch.
jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: 17 },
  NativeModules: { BearoundReactSdk: {} },
  NativeEventEmitter: jest.fn(() => ({
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    removeAllListeners: jest.fn(),
  })),
  PermissionsAndroid: {
    PERMISSIONS: {},
    RESULTS: { GRANTED: 'granted' },
    check: jest.fn(() => Promise.resolve(true)),
    request: jest.fn(() => Promise.resolve('granted')),
  },
  TurboModuleRegistry: { getEnforcing: jest.fn(() => mockNativeModule) },
}));

jest.mock('../NativeBearoundReactSdk', () => ({
  __esModule: true,
  default: mockNativeModule,
}));

import {
  __getBusinessToken,
  __resetForTest,
  __setTransport,
  computeHash,
  install,
  isFromSdk,
  report,
  setEnabled,
  shouldReport,
} from '../errorReporter';

/** An Error whose stack references this package (passes the SDK filter). */
const sdkError = (message = 'boom'): Error => {
  const err = new Error(message);
  err.stack = [
    `Error: ${message}`,
    '    at startScanning (@bearound/react-native-sdk/src/index.tsx:407:9)',
    '    at Object.<anonymous> (app/App.tsx:42:3)',
  ].join('\n');
  return err;
};

/** An Error whose stack is entirely host-app code (must be ignored). */
const hostError = (message = 'host boom'): Error => {
  const err = new Error(message);
  err.stack = [
    `Error: ${message}`,
    '    at doThing (app/src/checkout.tsx:12:5)',
    '    at Object.<anonymous> (app/App.tsx:42:3)',
  ].join('\n');
  return err;
};

describe('errorReporter', () => {
  let sent: Array<{ body: string; token: string | null }>;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetForTest();
    install('biz-token-123');
    sent = [];
    __setTransport((body, token) => {
      sent.push({ body, token });
      return Promise.resolve();
    });
  });

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  describe('package-scoped filtering', () => {
    it('reports an error whose stack references the SDK package', async () => {
      report(sdkError(), 'uncaught');
      await flush();

      expect(sent).toHaveLength(1);
      const payload = JSON.parse(sent[0]!.body);
      expect(payload.error.context).toBe('uncaught');
      expect(payload.error.type).toBe('Error');
      expect(payload.sdk.platform).toBe('react-native');
      expect(sent[0]!.token).toBe('biz-token-123');
    });

    it('ignores an error that comes only from host-app frames', async () => {
      report(hostError(), 'uncaught');
      await flush();

      expect(sent).toHaveLength(0);
    });

    it('ignores an error with no stack at all', async () => {
      const err = new Error('no stack');
      err.stack = undefined;
      report(err, 'uncaught');
      await flush();

      expect(sent).toHaveLength(0);
    });

    it('isFromSdk excludes stacks whose only SDK frame is the telemetry module', () => {
      const telemetryOnly = [
        'Error: internal',
        '    at report (@bearound/react-native-sdk/src/errorReporter.ts:170:5)',
        '    at doThing (app/App.tsx:1:1)',
      ].join('\n');
      expect(isFromSdk(telemetryOnly)).toBe(false);
    });

    it('isFromSdk accepts stacks that also touch the SDK outside telemetry', () => {
      const mixed = [
        'Error: internal',
        '    at report (@bearound/react-native-sdk/src/errorReporter.ts:170:5)',
        '    at startScanning (@bearound/react-native-sdk/src/index.tsx:407:9)',
      ].join('\n');
      expect(isFromSdk(mixed)).toBe(true);
    });
  });

  describe('dedupe', () => {
    it('suppresses a duplicate error within the dedupe window', async () => {
      report(sdkError('dup'), 'uncaught');
      report(sdkError('dup'), 'uncaught');
      await flush();

      expect(sent).toHaveLength(1);
    });

    it('reports again once the dedupe window has passed', () => {
      const type = 'Error';
      const context = 'uncaught';
      const stack = 'at x (@bearound/react-native-sdk/src/index.tsx:1:1)';
      const hash = computeHash(type, context, stack);

      const t0 = 1_000_000;
      expect(shouldReport(hash, t0)).toBe(true);
      // within 5 min → suppressed
      expect(shouldReport(hash, t0 + 4 * 60 * 1000)).toBe(false);
      // after 5 min → allowed
      expect(shouldReport(hash, t0 + 6 * 60 * 1000)).toBe(true);
    });

    it('does not dedupe distinct errors (different first stack line)', async () => {
      const a = sdkError('a');
      a.stack =
        'Error: a\n    at foo (@bearound/react-native-sdk/src/index.tsx:1:1)';
      const b = sdkError('b');
      b.stack =
        'Error: b\n    at bar (@bearound/react-native-sdk/src/index.tsx:2:2)';

      report(a, 'uncaught');
      report(b, 'uncaught');
      await flush();

      expect(sent).toHaveLength(2);
    });
  });

  describe('rate-limit', () => {
    it('allows at most 20 reports per rolling hour for distinct hashes', () => {
      const now = 5_000_000;
      let allowed = 0;
      for (let i = 0; i < 25; i++) {
        const hash = computeHash('Error', 'uncaught', `line-${i}`);
        if (shouldReport(hash, now)) allowed++;
      }
      expect(allowed).toBe(20);
    });

    it('replenishes the budget after the rolling hour', () => {
      const t0 = 6_000_000;
      for (let i = 0; i < 20; i++) {
        shouldReport(computeHash('Error', 'uncaught', `l-${i}`), t0);
      }
      // 21st in the same window is dropped
      expect(shouldReport(computeHash('Error', 'uncaught', 'l-20'), t0)).toBe(
        false
      );
      // more than an hour later, the budget is free again
      expect(
        shouldReport(computeHash('Error', 'uncaught', 'l-21'), t0 + 3_600_001)
      ).toBe(true);
    });
  });

  describe('never throws', () => {
    it('does not throw when the transport rejects', async () => {
      __setTransport(() => Promise.reject(new Error('network down')));
      expect(() => report(sdkError('net'), 'uncaught')).not.toThrow();
      await flush();
      // no assertion needed beyond "did not throw / did not reject"
    });

    it('does not throw when the transport throws synchronously', () => {
      __setTransport(() => {
        throw new Error('sync explode');
      });
      expect(() => report(sdkError('sync'), 'uncaught')).not.toThrow();
    });

    it('report is a no-op (and does not throw) when disabled', async () => {
      setEnabled(false);
      report(sdkError('off'), 'uncaught');
      await flush();
      expect(sent).toHaveLength(0);
      setEnabled(true);
    });
  });

  describe('install', () => {
    it('is idempotent and stores the trimmed token', () => {
      install('  spaced-token  ');
      expect(__getBusinessToken()).toBe('spaced-token');
    });

    it('stores null for an empty token', () => {
      __resetForTest();
      install('   ');
      expect(__getBusinessToken()).toBeNull();
    });
  });

  describe('payload shape', () => {
    it('caps the stack trace at 8000 chars', async () => {
      const err = sdkError('big');
      err.stack =
        'at x (@bearound/react-native-sdk/src/index.tsx:1:1)\n' +
        'x'.repeat(20_000);
      report(err, 'uncaught');
      await flush();

      const payload = JSON.parse(sent[0]!.body);
      expect(payload.error.stackTrace.length).toBeLessThanOrEqual(8000);
    });

    it('includes device + sdk sections with occurredAt', async () => {
      report(sdkError(), 'async');
      await flush();

      const payload = JSON.parse(sent[0]!.body);
      expect(payload.device).toBeDefined();
      expect(payload.device.permissions).toBeDefined();
      expect(payload.sdk.version).toEqual(expect.any(String));
      expect(payload.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
