/**
 * @fileoverview App presence bridge: configuration, typed parsing of native snapshots,
 * replay for late subscribers, snapshotId dedupe between event and replay, removal,
 * isolated errors and the untouched legacy configure() contract.
 */

import { mockNativeModule, resetMocks } from './testUtils';

type Handler = (event: unknown) => void;

const handlers: Array<{ event: string; handler: Handler; removed: boolean }> =
  [];

const mockAddListener = jest.fn((event: string, handler: Handler) => {
  const entry = { event, handler, removed: false };
  handlers.push(entry);
  return {
    remove: jest.fn(() => {
      entry.removed = true;
    }),
  };
});

const emit = (event: string, payload: unknown) => {
  handlers
    .filter((entry) => entry.event === event && !entry.removed)
    .forEach((entry) => entry.handler(payload));
};

const mockAppPresenceNative = {
  ...mockNativeModule,
  configureAppPresence: jest.fn((_json: string) => Promise.resolve()),
  getLastAppPresenceSnapshot: jest.fn(() => Promise.resolve('null')),
};

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: 17 },
  NativeModules: { BearoundReactSdk: {} },
  NativeEventEmitter: jest.fn(() => ({
    addListener: mockAddListener,
    removeAllListeners: jest.fn(),
  })),
  TurboModuleRegistry: { getEnforcing: jest.fn(() => mockAppPresenceNative) },
}));

jest.mock('../NativeBearoundReactSdk', () => ({
  __esModule: true,
  default: mockAppPresenceNative,
}));

const EVENT = 'bearound:appPresence';

// Exactly what the native SDKs serialize: explicit nulls, ISO 8601 UTC with milliseconds.
const nativeSnapshot = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  snapshotId: '8f0c2a4e-1b6d-4c9e-9a51-3f7d2e8b6c10',
  configurationFingerprint:
    '3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b',
  checkedAt: '2026-10-09T12:34:56.789Z',
  cached: false,
  results: [
    {
      targetId: 'fixture',
      state: 'present',
      present: true,
      reason: null,
      checkedAt: '2026-10-09T12:34:56.700Z',
      detectionMethod: 'ios_url_scheme',
    },
    {
      targetId: 'fixture.absent',
      state: 'absent',
      present: false,
      reason: null,
      checkedAt: '2026-10-09T12:34:56.701Z',
      detectionMethod: 'ios_url_scheme',
    },
    {
      targetId: 'android-only',
      state: 'unknown',
      present: null,
      reason: 'unsupported_platform',
      checkedAt: '2026-10-09T12:34:56.702Z',
      detectionMethod: 'none',
    },
  ],
  ...overrides,
});

const flush = () => new Promise((resolve) => setImmediate(resolve));

const load = () => require('../index') as typeof import('../index');

describe('App presence', () => {
  beforeEach(() => {
    resetMocks();
    handlers.length = 0;
    mockAddListener.mockClear();
    mockAppPresenceNative.configureAppPresence.mockReset();
    mockAppPresenceNative.configureAppPresence.mockImplementation(() =>
      Promise.resolve()
    );
    mockAppPresenceNative.getLastAppPresenceSnapshot.mockReset();
    mockAppPresenceNative.getLastAppPresenceSnapshot.mockImplementation(() =>
      Promise.resolve('null')
    );
  });

  describe('configureAppPresence()', () => {
    it('sends the configuration as one JSON object string', async () => {
      const { configureAppPresence } = load();
      await configureAppPresence({
        enabled: true,
        targets: [
          {
            id: 'fixture',
            iosScheme: 'bearound-presence-fixture',
            androidPackageName: 'io.bearound.fixture.presence',
          },
        ],
      });

      const [json] = mockAppPresenceNative.configureAppPresence.mock
        .calls[0] as [string];
      expect(JSON.parse(json)).toEqual({
        enabled: true,
        targets: [
          {
            id: 'fixture',
            iosScheme: 'bearound-presence-fixture',
            androidPackageName: 'io.bearound.fixture.presence',
          },
        ],
      });
    });

    it('defaults a missing configuration to the opt-in defaults', async () => {
      const { configureAppPresence } = load();
      await configureAppPresence(
        undefined as unknown as Parameters<typeof configureAppPresence>[0]
      );

      const [json] = mockAppPresenceNative.configureAppPresence.mock
        .calls[0] as [string];
      expect(JSON.parse(json)).toEqual({ enabled: false, targets: [] });
    });

    it('rejects with the native invalid-configuration code', async () => {
      const error = Object.assign(
        new Error(
          'app_presence_invalid_configuration: duplicate target id "a"'
        ),
        { code: 'app_presence_invalid_configuration' }
      );
      mockAppPresenceNative.configureAppPresence.mockImplementation(() =>
        Promise.reject(error)
      );
      const { configureAppPresence, APP_PRESENCE_INVALID_CONFIGURATION } =
        load();

      await expect(
        configureAppPresence({
          enabled: true,
          targets: [{ id: 'a' }, { id: 'a' }],
        })
      ).rejects.toMatchObject({ code: APP_PRESENCE_INVALID_CONFIGURATION });
    });
  });

  describe('getLastAppPresenceSnapshot()', () => {
    it('resolves null for the native literal "null"', async () => {
      const { getLastAppPresenceSnapshot } = load();
      await expect(getLastAppPresenceSnapshot()).resolves.toBeNull();
    });

    it('preserves unknown/null, UTC times, target order and cached', async () => {
      mockAppPresenceNative.getLastAppPresenceSnapshot.mockImplementation(() =>
        Promise.resolve(JSON.stringify(nativeSnapshot({ cached: true })))
      );
      const { getLastAppPresenceSnapshot } = load();

      const snapshot = await getLastAppPresenceSnapshot();

      expect(snapshot).toEqual(nativeSnapshot({ cached: true }));
      expect(snapshot?.results.map((r) => r.targetId)).toEqual([
        'fixture',
        'fixture.absent',
        'android-only',
      ]);
      const unknown = snapshot!.results[2]!;
      expect(unknown.present).toBeNull();
      expect(unknown.reason).toBe('unsupported_platform');
      expect(snapshot!.results[1]!.present).toBe(false);
      expect(snapshot!.results[0]!.reason).toBeNull();
      expect(snapshot!.checkedAt).toBe('2026-10-09T12:34:56.789Z');
    });

    it('resolves null for malformed JSON instead of fabricating results', async () => {
      mockAppPresenceNative.getLastAppPresenceSnapshot.mockImplementation(() =>
        Promise.resolve('{not json')
      );
      const { getLastAppPresenceSnapshot } = load();
      await expect(getLastAppPresenceSnapshot()).resolves.toBeNull();
    });
  });

  describe('addAppPresenceListener()', () => {
    it('delivers live snapshots typed, with explicit nulls kept', async () => {
      const { addAppPresenceListener } = load();
      const listener = jest.fn();
      addAppPresenceListener(listener);
      await flush();

      emit(EVENT, nativeSnapshot());

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(nativeSnapshot());
    });

    it('replays the cached snapshot to a late subscriber without a new round', async () => {
      mockAppPresenceNative.getLastAppPresenceSnapshot.mockImplementation(() =>
        Promise.resolve(JSON.stringify(nativeSnapshot({ cached: true })))
      );
      const { addAppPresenceListener } = load();
      const listener = jest.fn();

      addAppPresenceListener(listener);
      await flush();

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0]).toMatchObject({
        snapshotId: nativeSnapshot().snapshotId,
        checkedAt: nativeSnapshot().checkedAt,
        cached: true,
      });
      expect(mockAppPresenceNative.configureAppPresence).not.toHaveBeenCalled();
    });

    it('registers the event before reading the replay', () => {
      const { addAppPresenceListener } = load();
      addAppPresenceListener(jest.fn());

      expect(mockAddListener.mock.invocationCallOrder[0]).toBeLessThan(
        mockAppPresenceNative.getLastAppPresenceSnapshot.mock
          .invocationCallOrder[0]!
      );
    });

    it('does not duplicate a snapshotId between the event and the replay', async () => {
      let resolveReplay: (value: string) => void = () => {};
      mockAppPresenceNative.getLastAppPresenceSnapshot.mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveReplay = resolve;
          })
      );
      const { addAppPresenceListener } = load();
      const listener = jest.fn();
      addAppPresenceListener(listener);

      // The round lands while the replay read is in flight.
      emit(EVENT, nativeSnapshot());
      resolveReplay(JSON.stringify(nativeSnapshot({ cached: true })));
      await flush();
      // Native replay on listener reassignment carries the same id again.
      emit(EVENT, nativeSnapshot({ cached: true }));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].cached).toBe(false);
    });

    it('delivers a new round with the same content under a new snapshotId', async () => {
      const { addAppPresenceListener } = load();
      const listener = jest.fn();
      addAppPresenceListener(listener);
      await flush();

      emit(EVENT, nativeSnapshot());
      emit(EVENT, nativeSnapshot({ snapshotId: 'second-round' }));

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('dedupes per subscription: each subscriber gets its own replay', async () => {
      mockAppPresenceNative.getLastAppPresenceSnapshot.mockImplementation(() =>
        Promise.resolve(JSON.stringify(nativeSnapshot({ cached: true })))
      );
      const { addAppPresenceListener } = load();
      const first = jest.fn();
      const second = jest.fn();

      addAppPresenceListener(first);
      await flush();
      addAppPresenceListener(second);
      await flush();

      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('stops all deliveries after remove(), including a pending replay', async () => {
      let resolveReplay: (value: string) => void = () => {};
      mockAppPresenceNative.getLastAppPresenceSnapshot.mockImplementation(
        () =>
          new Promise<string>((resolve) => {
            resolveReplay = resolve;
          })
      );
      const { addAppPresenceListener } = load();
      const listener = jest.fn();
      const subscription = addAppPresenceListener(listener);

      subscription.remove();
      subscription.remove();
      resolveReplay(JSON.stringify(nativeSnapshot({ cached: true })));
      await flush();
      emit(EVENT, nativeSnapshot({ snapshotId: 'after-remove' }));

      expect(listener).not.toHaveBeenCalled();
      expect(handlers.filter((h) => h.event === EVENT && !h.removed)).toEqual(
        []
      );
    });

    it('contains a throwing callback and keeps delivering later rounds', async () => {
      const { addAppPresenceListener } = load();
      const listener = jest.fn(() => {
        throw new Error('host callback failure');
      });
      addAppPresenceListener(listener);
      await flush();

      expect(() => emit(EVENT, nativeSnapshot())).not.toThrow();
      emit(EVENT, nativeSnapshot({ snapshotId: 'second-round' }));

      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('drops a malformed delivery without affecting the next one', async () => {
      const { addAppPresenceListener } = load();
      const listener = jest.fn();
      addAppPresenceListener(listener);
      await flush();

      emit(EVENT, { results: [] });
      emit(EVENT, nativeSnapshot({ results: [{ targetId: 'x' }] }));
      emit(EVENT, nativeSnapshot());

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].snapshotId).toBe(
        nativeSnapshot().snapshotId
      );
    });

    it('keeps live events when the replay read fails', async () => {
      mockAppPresenceNative.getLastAppPresenceSnapshot.mockImplementation(() =>
        Promise.reject(new Error('native not ready'))
      );
      const { addAppPresenceListener } = load();
      const listener = jest.fn();
      addAppPresenceListener(listener);
      await flush();

      emit(EVENT, nativeSnapshot());

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('legacy integrations', () => {
    it('configure() keeps its positional native contract and never touches app presence', async () => {
      const { configure } = load();
      await configure({ businessToken: 'token' });

      expect(mockAppPresenceNative.configure).toHaveBeenCalledTimes(1);
      expect(
        (mockAppPresenceNative.configure.mock.calls[0] as unknown[]).length
      ).toBe(11);
      expect(mockAppPresenceNative.configureAppPresence).not.toHaveBeenCalled();
      expect(
        mockAppPresenceNative.getLastAppPresenceSnapshot
      ).not.toHaveBeenCalled();
    });

    it('subscribing on a native module without the getter still receives events', async () => {
      const getter = mockAppPresenceNative.getLastAppPresenceSnapshot;
      (
        mockAppPresenceNative as Record<string, unknown>
      ).getLastAppPresenceSnapshot = undefined;
      try {
        const { addAppPresenceListener } = load();
        const listener = jest.fn();
        expect(() => addAppPresenceListener(listener)).not.toThrow();
        emit(EVENT, nativeSnapshot());
        expect(listener).toHaveBeenCalledTimes(1);
      } finally {
        mockAppPresenceNative.getLastAppPresenceSnapshot = getter;
      }
    });
  });
});
