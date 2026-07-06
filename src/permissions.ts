/**
 * @fileoverview Permission management for the Bearound React Native SDK
 *
 * This module handles all permission requests and checks required for the Bearound SDK
 * to function properly across both Android and iOS platforms.
 *
 * **Platform Differences:**
 * - **Android**: All permission logic is handled by this module using React Native's
 *   PermissionsAndroid API. Permissions must be explicitly requested and managed.
 * - **iOS**: Permission requests are handled via native helper methods.
 *
 * **What actually gates the scan (Android):**
 * - **Android 12+ (API 31+):** `BLUETOOTH_SCAN` (declared `neverForLocation`).
 *   Location does NOT unlock the BLE scan on these releases.
 * - **Android ≤ 11 (API ≤ 30):** fine/coarse location gates the BLE scan.
 * - `POST_NOTIFICATIONS` (Android 13+): optional, for foreground-service /
 *   monitoring indicators — not required to scan.
 * - `ACCESS_BACKGROUND_LOCATION`: NOT a scan requirement; requested only via the
 *   explicit {@link requestBackgroundLocation} opt-in.
 *
 * @author Bearound Team
 */

import { PermissionsAndroid, Platform, type Permission } from 'react-native';

import Native from './NativeBearoundReactSdk';
/**
 * Result of permission checks/requests
 *
 * @interface PermissionResult
 * @property {boolean} fineLocation - Fine or coarse location permission status
 * @property {boolean} btScan - Bluetooth scan permission status (Android 12+)
 * @property {boolean} btConnect - Bluetooth connect permission status (Android 12+)
 * @property {boolean} notifications - Post notifications permission status (Android 13+)
 * @property {boolean} backgroundLocation - Background location permission status (Android 10+)
 */
export type PermissionResult = {
  fineLocation: boolean;
  btScan: boolean;
  btConnect: boolean;
  notifications: boolean;
  backgroundLocation: boolean;
};

const isAndroid = Platform.OS === 'android';
const SDK_INT = isAndroid ? Number(Platform.Version) : 0;

/**
 * Helper function to check if a permission is granted
 * @param p - Android permission to check
 * @returns Promise<boolean> - true if granted or undefined permission
 */
const has = async (p?: Permission) =>
  p ? (await PermissionsAndroid.check(p)) === true : true;

/**
 * Checks the current status of all required permissions for the Bearound SDK.
 *
 * **Platform Support:**
 * - **Android**: Checks actual permission status using PermissionsAndroid
 * - **iOS**: Checks location permission status via native helper
 *
 * **Android Version Requirements:**
 * - Location: All versions
 * - Bluetooth scan/connect: Android 12+ (API 31+)
 * - Notifications: Android 13+ (API 33+)
 * - Background location: Android 10+ (API 29+)
 *
 * @returns Promise<PermissionResult> Object containing status of all permissions
 *
 * @example
 * ```typescript
 * const permissions = await checkPermissions();
 * if (!permissions.fineLocation) {
 *   // Handle missing location permission
 * }
 * ```
 */
export async function checkPermissions(): Promise<PermissionResult> {
  if (!isAndroid) {
    // iOS: fineLocation/btScan/btConnect mirror the single location boolean the
    // native bridge exposes (authorizedAlways OR authorizedWhenInUse). For the
    // real Bluetooth permission use getBluetoothState() ('unauthorized' = denied).
    const [granted, notifications, authStatus] = await Promise.all([
      Native.checkPermissions(),
      // Real UNUserNotificationCenter check (authorized/provisional/ephemeral).
      Native.checkNotificationPermission(),
      Native.getAuthorizationStatus(),
    ]);
    return {
      fineLocation: granted,
      btScan: granted,
      btConnect: granted,
      notifications,
      // Only authorizedAlways counts — When-In-Use does not allow the
      // terminated-app wake-up that "background location" implies.
      backgroundLocation: authStatus === 'always',
    };
  }

  const hasFine = await has(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
  );
  const hasCoarse = await has(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
  );
  const fineOrCoarse = hasFine || hasCoarse;

  const btScan =
    SDK_INT >= 31
      ? await has(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN)
      : true;

  const btConnect =
    SDK_INT >= 31
      ? await has(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT)
      : true;

  const notifications =
    SDK_INT >= 33
      ? await has(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
      : true;

  const backgroundLocation =
    SDK_INT >= 29
      ? await has(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION)
      : true;

  return {
    fineLocation: fineOrCoarse,
    btScan,
    btConnect,
    notifications,
    backgroundLocation,
  };
}

/**
 * Requests all foreground permissions required for the Bearound SDK to function.
 *
 * **Platform Support:**
 * - **Android**: Shows system permission dialogs and requests permissions interactively
 * - **iOS**: Requests location permission via native helper
 *
 * **Permissions Requested (Android only), gated by API level:**
 * - **Android 12+ (API 31+):** `BLUETOOTH_SCAN` (+ `BLUETOOTH_CONNECT`) and,
 *   on 13+, the optional `POST_NOTIFICATIONS`. Location is **not** requested —
 *   the SDK declares `BLUETOOTH_SCAN` with `neverForLocation`, so location does
 *   not unlock the BLE scan and asking for it only risks a Play review flag.
 * - **Android < 12 (API ≤ 30):** fine location (with coarse fallback), which is
 *   what gates the BLE scan on those releases.
 *
 * Background location is **never** requested here — it is not a scan requirement
 * and, undeclared, resolves to `NEVER_ASK_AGAIN`. Request it explicitly via
 * {@link requestBackgroundLocation} only if the host app truly needs it.
 *
 * @returns Promise<PermissionResult> Updated permission status after requests
 *
 * @example
 * ```typescript
 * const result = await requestForegroundPermissions();
 * // Android 12+: gate on btScan. Android ≤ 11: gate on fineLocation.
 * if (result.btScan || result.fineLocation) {
 *   // Ready to start scanning for beacons
 * }
 * ```
 */
export async function requestForegroundPermissions(): Promise<PermissionResult> {
  if (!isAndroid) {
    // iOS: requests location authorization (Always) while notDetermined; the
    // remaining fields are read back honestly (see checkPermissions).
    const granted = await Native.requestPermissions();
    const [notifications, authStatus] = await Promise.all([
      Native.checkNotificationPermission(),
      Native.getAuthorizationStatus(),
    ]);
    return {
      fineLocation: granted,
      btScan: granted,
      btConnect: granted,
      notifications,
      backgroundLocation: authStatus === 'always',
    };
  }

  const req = async (p: Permission, title: string, msg: string) => {
    const res = await PermissionsAndroid.request(p, {
      title,
      message: msg,
      buttonPositive: 'OK',
      buttonNegative: 'Cancelar',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  };

  if (SDK_INT >= 31) {
    // Android 12+: the scan is unlocked by BLUETOOTH_SCAN (neverForLocation),
    // not by location. Request only Bluetooth (+ optional notifications).
    await req(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      'Permissão de Bluetooth',
      'Precisamos de acesso ao Bluetooth para escanear beacons.'
    );
    await req(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      'Permissão de Conexão Bluetooth',
      'Necessário para interagir com dispositivos BLE.'
    );
    if (SDK_INT >= 33) {
      await req(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        'Permissão de Notificações',
        'Usamos notificações para indicar o monitoramento em andamento.'
      );
    }
    return checkPermissions();
  }

  // Android ≤ 11: fine location (with coarse fallback) gates the BLE scan.
  const fineGranted = await req(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    'Permissão de Localização',
    'Precisamos de localização para escanear beacons via Bluetooth.'
  );
  if (!fineGranted) {
    await req(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      'Permissão de Localização Aproximada',
      'Se preferir, conceda localização aproximada para permitir o escaneamento.'
    );
  }

  return checkPermissions();
}

/**
 * Requests background location permission for beacon detection when app is not active.
 *
 * **Platform Support:**
 * - **Android**: Shows system dialog for background location permission (Android 10+)
 * - **iOS**: Requests location permission via native helper
 *
 * **Android Behavior:**
 * - Requires foreground location permission first (Android 10)
 * - On Android 12+, background location can be requested without foreground fine location
 * - Only available on Android 10+ (API 29+)
 *
 * **Not a scan requirement.** The Bearound BLE scan does not need background
 * location; on 12+ it is gated by `BLUETOOTH_SCAN` (`neverForLocation`). Only
 * call this if the host app has its own reason to hold background location, and
 * make sure `ACCESS_BACKGROUND_LOCATION` is declared in the app manifest —
 * otherwise the request resolves to `NEVER_ASK_AGAIN`.
 *
 * This never opens app Settings on your behalf; if the return value indicates
 * a permanent denial the host app decides whether to route the user there.
 *
 * @returns Promise<boolean> true if background location permission is granted
 *
 * @example
 * ```typescript
 * const hasBackground = await requestBackgroundLocation();
 * if (!hasBackground) {
 *   // Denied — the host app decides whether to open Settings (Linking.openSettings()).
 * }
 * ```
 */
export async function requestBackgroundLocation(): Promise<boolean> {
  if (!isAndroid) {
    return Native.requestPermissions();
  }

  if (SDK_INT < 29) return true;

  const fg = await checkPermissions();
  if (!fg.fineLocation && SDK_INT < 31) {
    return false;
  }

  const res = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
    {
      title: 'Permissão de Localização em Segundo Plano',
      message:
        'Para detectar beacons enquanto o app não está em uso, permita localização "sempre".',
      buttonPositive: 'Permitir',
      buttonNegative: 'Agora não',
    }
  );

  // Intentionally does NOT open Settings on NEVER_ASK_AGAIN — opening Settings
  // is a host-app decision. The caller inspects the boolean and acts.
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Convenience function to ensure all necessary permissions are requested and granted.
 *
 * **Platform Support:**
 * - **Android**: Requests foreground permissions and optionally background location
 * - **iOS**: Requests location permission via native helper
 *
 * This is the recommended function to call during app initialization to ensure
 * the Bearound SDK has the permissions it needs to scan.
 *
 * **Flow:**
 * 1. Requests the foreground scan permissions for the running API level
 *    (Android 12+: Bluetooth + optional notifications; ≤ 11: location).
 * 2. Returns final permission status.
 *
 * Background location is **not** requested by default — it is not a scan
 * requirement and, undeclared, resolves to `NEVER_ASK_AGAIN`. Opt in with
 * `{ askBackground: true }` only if the host app has declared
 * `ACCESS_BACKGROUND_LOCATION` and truly needs it. This function never opens
 * app Settings on your behalf.
 *
 * @param opts - Configuration options
 * @param opts.askBackground - Whether to also request background location
 *   (Android-only opt-in; default: `false`)
 * @returns Promise<PermissionResult> Final status of all permissions
 *
 * @example
 * ```typescript
 * // Basic flow — foreground scan permissions only (recommended)
 * const permissions = await ensurePermissions();
 *
 * // Explicit opt-in for background location (must be declared in the manifest)
 * const permissions = await ensurePermissions({ askBackground: true });
 * ```
 */
export async function ensurePermissions(opts = { askBackground: false }) {
  await requestForegroundPermissions();
  if (opts.askBackground && isAndroid) {
    await requestBackgroundLocation();
  }
  return checkPermissions();
}
