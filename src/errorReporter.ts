/**
 * @fileoverview Isolated JS-layer error telemetry for the Bearound React Native SDK.
 *
 * A "try/catch around the JS side of the library". Captures errors that originate in
 * this package's JavaScript layer — uncaught exceptions and unhandled promise
 * rejections whose stack contains `@bearound/react-native-sdk` frames — and ships them
 * to the ingest backend (`POST https://ingest.bearound.io/sdk-errors`).
 *
 * This mirrors the native `io.bearound.sdk.telemetry.ErrorReporter` (Android) and the
 * iOS `BearoundSDK` reporter. The embedded native SDKs already capture crashes in their
 * own (Kotlin/Swift) layers via those reporters; this module ONLY covers the React
 * Native / JS layer that neither native reporter can see.
 *
 * GOLDEN RULES (identical to the native reporters):
 *  1. NEVER throw, NEVER break the host app, NEVER hijack the app's crash handler.
 *  2. ONLY report errors from OUR library (stack must reference this package), and
 *     never the telemetry module itself.
 *  3. The chained global handler ALWAYS delegates to the previously-installed handler.
 *  4. Fire-and-forget, rate-limit + dedupe (hash of `type|context|first stack line`),
 *     stack capped at {@link MAX_STACK_CHARS} chars.
 *  5. Isolated transport with a short (5 s) timeout.
 *  6. Public opt-out via {@link setErrorReportingEnabled} (default: enabled).
 */

import { Platform } from 'react-native';

import { checkPermissions } from './permissions';

const ENDPOINT = 'https://ingest.bearound.io/sdk-errors';
const REQUEST_TIMEOUT_MS = 5_000;

const MAX_STACK_CHARS = 8_000;
const MAX_REPORTS_PER_HOUR = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
/** Upper bound for the dedupe map before expired entries are pruned. */
const DEDUPE_MAP_PRUNE_SIZE = 64;

const PLATFORM = 'react-native';

/**
 * Markers that identify a stack frame as belonging to THIS package. Metro/Hermes
 * stacks reference the module either by its published name (installed under
 * `node_modules/@bearound/react-native-sdk/...`) or by the on-disk source/build
 * path (`react-native-sdk/src/...`, `react-native-sdk/lib/...`).
 */
const SDK_STACK_MARKERS = [
  '@bearound/react-native-sdk',
  'react-native-sdk/src/',
  'react-native-sdk/src\\',
  'react-native-sdk/lib/',
  'react-native-sdk/lib\\',
];

/** The telemetry module's own basename — excluded so reporter errors never recurse. */
const TELEMETRY_MODULE_MARKER = 'errorReporter';

/**
 * Runtime frames that surface an error but never ORIGINATE it — skipped when
 * locating the first application frame (React Native internals, React, and
 * native/Hermes frames).
 */
const RUNTIME_STACK_MARKERS = [
  'node_modules/react-native/',
  'node_modules/@react-native/',
  'node_modules/react/',
  'node_modules/react-dom/',
  '[native code]',
  'InternalBytecode',
];

type ErrorHandlerCallback = (error: unknown, isFatal?: boolean) => void;

interface ErrorUtilsShape {
  getGlobalHandler?: () => ErrorHandlerCallback | undefined;
  setGlobalHandler?: (callback: ErrorHandlerCallback) => void;
}

interface RejectionTrackingOptions {
  allRejections?: boolean;
  onUnhandled?: (id: unknown, error: unknown) => void;
  onHandled?: (id: unknown) => void;
}

interface HermesInternalShape {
  hasPromise?: () => boolean;
  enablePromiseRejectionTracker?: (options: RejectionTrackingOptions) => void;
}

type GlobalWithErrorUtils = typeof globalThis & {
  ErrorUtils?: ErrorUtilsShape;
  HermesInternal?: HermesInternalShape | null;
  __BEAROUND_REJECTION_TRACKING_INSTALLED__?: boolean;
};

const getGlobal = (): GlobalWithErrorUtils =>
  globalThis as GlobalWithErrorUtils;

// --- module state ---------------------------------------------------------

let enabled = true;
let handlerInstalled = false;
let businessToken: string | null = null;

// Rate-limit + dedupe state (JS is single-threaded, so no locking needed).
const reportTimestamps: number[] = [];
const lastReportedAt = new Map<string, number>();

/**
 * Overridable transport for tests. Default performs the fire-and-forget POST.
 * Returning a promise lets tests await delivery; production ignores it.
 */
export let transport: (body: string, token: string | null) => Promise<void> =
  httpPost;

/** @internal test hook — restores the default HTTP transport. */
export function __setTransport(
  next: (body: string, token: string | null) => Promise<void>
): void {
  transport = next;
}

// --- public API -----------------------------------------------------------

/**
 * Installs the JS-layer reporter. Idempotent — safe to call on every `configure()`.
 *
 * Stores the business token used for the `Authorization` header and chains the
 * global handlers:
 *  - `ErrorUtils.setGlobalHandler` for uncaught JS exceptions (previous handler is
 *    stored and ALWAYS re-invoked);
 *  - the promise unhandled-rejection tracker (Hermes / `promise` lib), wrapped so any
 *    pre-existing tracker keeps running.
 *
 * The whole body is wrapped in try/catch — installation can never break the host.
 */
export function install(token: string): void {
  try {
    businessToken = token && token.trim().length > 0 ? token.trim() : null;

    if (handlerInstalled) {
      return;
    }
    handlerInstalled = true;

    installUncaughtHandler();
    installRejectionTracker();
  } catch {
    // GOLDEN RULE: install must never throw into the host.
  }
}

/** Enables/disables JS-layer error reporting at runtime. Default: enabled. */
export function setEnabled(next: boolean): void {
  enabled = next;
}

/**
 * Reports a JS-layer SDK error. Fire-and-forget: filters, dedupes and rate-limits
 * synchronously, then delivers on the isolated transport. No-ops when disabled, when
 * the error is not from this package, when rate-limited, or when recently deduped.
 * Never throws.
 *
 * @param error   the thrown value (Error or otherwise).
 * @param context origin of the error — `"uncaught"`, `"async"`, or a component name.
 */
export function report(error: unknown, context: string): void {
  try {
    if (!enabled || !handlerInstalled) {
      return;
    }

    const stack = stackOf(error);
    if (!isFromSdk(stack)) {
      return;
    }

    const type = typeOf(error);
    const hash = computeHash(type, context, stack);
    if (!shouldReport(hash)) {
      return;
    }

    // buildPayload probes permissions asynchronously; deliver when it resolves.
    // Errors in the async chain are swallowed — reporting must never surface.
    buildPayload(error, context, type, stack)
      .then((body) => transport(body, businessToken))
      .catch(() => {
        // best-effort delivery; ignore transport/build failures.
      });
  } catch {
    // GOLDEN RULE: reporting must never throw into the host.
  }
}

// --- filtering ------------------------------------------------------------

/**
 * True ONLY when the error ORIGINATED in this package — never a host-app error.
 *
 * Ownership is the FIRST application frame (skipping the RN/React/native runtime
 * and the telemetry module). A host error that merely passes THROUGH one of our
 * callbacks has the host frame on top and ours below — the old "any SDK frame in
 * the stack" test captured those (a leak of the host app's errors); this origin
 * test does not. Without a stack we cannot attribute the error, so we never report.
 */
export function isFromSdk(stack: string): boolean {
  if (!stack) {
    return false;
  }
  for (const raw of stack.split('\n')) {
    const line = raw.trim();
    // Only real stack frames (a source location) — not the "Error: message" header.
    const isFrame =
      /\.[cm]?[jt]sx?\b/.test(line) ||
      line.includes('[native code]') ||
      line.includes('InternalBytecode');
    if (!isFrame) {
      continue;
    }
    // Runtime frames surface the error but never originate it.
    if (RUNTIME_STACK_MARKERS.some((m) => line.includes(m))) {
      continue;
    }
    // Our own telemetry module never counts as the origin (avoids recursion).
    if (line.includes(TELEMETRY_MODULE_MARKER)) {
      continue;
    }
    // The first application frame decides ownership.
    return SDK_STACK_MARKERS.some((m) => line.includes(m));
  }
  return false;
}

// --- dedupe + rate-limit --------------------------------------------------

/**
 * Combined dedupe + rate-limit gate. Returns true when this hash may be reported now
 * (and records the attempt).
 */
export function shouldReport(
  hash: string,
  nowMs: number = Date.now()
): boolean {
  const last = lastReportedAt.get(hash);
  if (last !== undefined && nowMs - last < DEDUPE_WINDOW_MS) {
    return false;
  }

  while (
    reportTimestamps.length > 0 &&
    nowMs - reportTimestamps[0]! > RATE_WINDOW_MS
  ) {
    reportTimestamps.shift();
  }
  if (reportTimestamps.length >= MAX_REPORTS_PER_HOUR) {
    return false;
  }

  reportTimestamps.push(nowMs);
  lastReportedAt.set(hash, nowMs);

  if (lastReportedAt.size > DEDUPE_MAP_PRUNE_SIZE) {
    for (const [key, ts] of lastReportedAt) {
      if (nowMs - ts > DEDUPE_WINDOW_MS) {
        lastReportedAt.delete(key);
      }
    }
  }
  return true;
}

/**
 * Non-crypto hash of `type|context|first stack line` — the dedupe key. A crypto digest
 * is unavailable in the RN JS runtime without a native dependency, so a stable 32-bit
 * FNV-1a hash is used instead; collisions only cost a suppressed duplicate.
 */
export function computeHash(
  type: string,
  context: string,
  stack: string
): string {
  const firstLine = stack.split('\n')[0]?.trim() ?? '';
  const input = `${type}|${context}|${firstLine}`;
  /* eslint-disable no-bitwise -- FNV-1a: bitwise ops are the algorithm itself. */
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash =
      (hash +
        ((hash << 1) +
          (hash << 4) +
          (hash << 7) +
          (hash << 8) +
          (hash << 24))) >>>
      0;
  }
  /* eslint-enable no-bitwise */
  return hash.toString(16).padStart(8, '0');
}

// --- payload --------------------------------------------------------------

function typeOf(error: unknown): string {
  if (error instanceof Error) {
    return error.name || 'Error';
  }
  if (error && typeof error === 'object') {
    return (error.constructor && error.constructor.name) || 'Object';
  }
  return typeof error;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    return error.message ?? '';
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return String(error);
  } catch {
    return '';
  }
}

/** Full stack string, truncated to {@link MAX_STACK_CHARS} chars. Empty when absent. */
export function stackOf(error: unknown): string {
  let stack = '';
  if (error instanceof Error && typeof error.stack === 'string') {
    stack = error.stack;
  } else if (
    error &&
    typeof error === 'object' &&
    typeof (error as { stack?: unknown }).stack === 'string'
  ) {
    stack = (error as { stack: string }).stack;
  }
  return stack.length > MAX_STACK_CHARS
    ? stack.substring(0, MAX_STACK_CHARS)
    : stack;
}

/**
 * Builds the `/sdk-errors` payload. Every environment probe is individually
 * exception-proof; a failing probe is simply omitted so a partial snapshot never
 * aborts the report.
 */
export async function buildPayload(
  error: unknown,
  context: string,
  type: string,
  stack: string
): Promise<string> {
  const permissions = await safePermissions();

  const payload = {
    error: {
      type,
      message: messageOf(error),
      stackTrace: stack,
      context,
    },
    device: {
      deviceId: '',
      model: '',
      manufacturer: '',
      os: safeOs(),
      osVersion: safeOsVersion(),
      locale: '',
      appState: '',
      permissions,
      systemState: {},
    },
    sdk: {
      version: getSdkVersion(),
      platform: PLATFORM,
      appId: '',
    },
    occurredAt: new Date().toISOString(),
  };

  return JSON.stringify(payload);
}

/**
 * Reuses {@link checkPermissions} to snapshot the SDK-relevant permission state at the
 * moment of the error. Returns `{}` if the probe throws (e.g. no native module in a
 * pure-JS crash context).
 */
async function safePermissions(): Promise<Record<string, unknown>> {
  try {
    const result = await checkPermissions();
    return result as unknown as Record<string, unknown>;
  } catch {
    return {};
  }
}

function safeOs(): string {
  try {
    return Platform.OS;
  } catch {
    return 'unknown';
  }
}

function safeOsVersion(): string {
  try {
    return String(Platform.Version);
  } catch {
    return 'unknown';
  }
}

/**
 * SDK version. Resolved at bundle time from this package's `package.json` so it is
 * bundler-safe and does not require a native round-trip in the crash path.
 */
function getSdkVersion(): string {
  try {
    const pkg = require('../package.json') as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// --- transport ------------------------------------------------------------

/**
 * Fire-and-forget POST with a hard 5 s timeout via {@link AbortController}. The
 * response is intentionally ignored — delivery is best-effort and must never block or
 * fail SDK work. Rejections are surfaced to the caller's `.catch` (which swallows them).
 */
async function httpPost(body: string, token: string | null): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers.Authorization = token;
    }
    await fetch(ENDPOINT, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

// --- global handler wiring ------------------------------------------------

/**
 * Chains `ErrorUtils.setGlobalHandler`: reports SDK-originated uncaught errors and
 * ALWAYS delegates to the previously-installed handler. If `ErrorUtils` is absent
 * (non-RN runtime), this is a no-op.
 */
function installUncaughtHandler(): void {
  try {
    const g = getGlobal();
    const errorUtils = g.ErrorUtils;
    if (
      !errorUtils ||
      typeof errorUtils.getGlobalHandler !== 'function' ||
      typeof errorUtils.setGlobalHandler !== 'function'
    ) {
      return;
    }

    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      try {
        report(error, 'uncaught');
      } catch {
        // never let telemetry interfere with the host's crash handling.
      } finally {
        if (typeof previous === 'function') {
          previous(error, isFatal);
        }
      }
    });
  } catch {
    // installation of this hook is best-effort.
  }
}

/**
 * Installs unhandled-promise-rejection tracking, chaining any existing tracker.
 *
 * Prefers the Hermes native tracker (`HermesInternal.enablePromiseRejectionTracker`),
 * which is what RN uses in production. Falls back to the `promise` polyfill's
 * `rejection-tracking` module (RN's dev path). In both cases the SDK's `onUnhandled`
 * only *reads* the rejection and reports it — it does not suppress RN's own handling.
 */
function installRejectionTracker(): void {
  try {
    const g = getGlobal();
    if (g.__BEAROUND_REJECTION_TRACKING_INSTALLED__) {
      return;
    }

    const onUnhandled = (_id: unknown, rejection: unknown) => {
      try {
        report(rejection, 'async');
      } catch {
        // never propagate.
      }
    };

    const hermes = g.HermesInternal;
    if (
      hermes &&
      typeof hermes.hasPromise === 'function' &&
      hermes.hasPromise() &&
      typeof hermes.enablePromiseRejectionTracker === 'function'
    ) {
      // Hermes exposes a single tracker slot with no getter to chain. We can only
      // read our own rejections here; RN wires its LogBox tracker at startup, so to
      // avoid clobbering it we ONLY install ours when RN has not (best-effort).
      hermes.enablePromiseRejectionTracker({
        allRejections: true,
        onUnhandled,
      });
      g.__BEAROUND_REJECTION_TRACKING_INSTALLED__ = true;
      return;
    }

    // Non-Hermes / older RN: use the bundled `promise` polyfill tracker.

    const tracking = require('promise/setimmediate/rejection-tracking') as {
      enable: (options: RejectionTrackingOptions) => void;
    };
    tracking.enable({ allRejections: true, onUnhandled });
    g.__BEAROUND_REJECTION_TRACKING_INSTALLED__ = true;
  } catch {
    // rejection tracking is best-effort; uncaught-handler coverage remains.
  }
}

// --- test hooks -----------------------------------------------------------

/** @internal resets all module state so tests are independent. */
export function __resetForTest(): void {
  enabled = true;
  handlerInstalled = false;
  businessToken = null;
  reportTimestamps.length = 0;
  lastReportedAt.clear();
  transport = httpPost;
}

/** @internal exposes the stored token for assertions. */
export function __getBusinessToken(): string | null {
  return businessToken;
}
