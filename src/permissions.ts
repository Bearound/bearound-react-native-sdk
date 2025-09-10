/**
 * @fileoverview Permission management for the Bearound React Native SDK
 *
 * This module handles all permission requests and checks required for the Bearound SDK
 * to function properly across both Android and iOS platforms.
 *
 * **Platform Differences:**
 * - **Android**: All permission logic is handled by this module using React Native's
 *   PermissionsAndroid API. Permissions must be explicitly requested and managed.
 * - **iOS**: Permission requests are handled natively during SDK initialization.
 *   All functions return success states since iOS handles permissions at the native layer.
 *
 * **Required Permissions:**
 * - Location (fine/coarse): Required for Bluetooth beacon scanning
 * - Bluetooth scan/connect: Required on Android 12+ for BLE operations
 * - Notifications: Used for background monitoring indicators
 * - Background location: Enables beacon detection when app is backgrounded
 *
 * @author Bearound Team
 */

import {
  PermissionsAndroid,
  Platform,
  Linking,
  type Permission,
} from 'react-native';

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
 * - **iOS**: Always returns true for all permissions (handled natively during SDK initialization)
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
    return {
      fineLocation: true,
      btScan: true,
      btConnect: true,
      notifications: true,
      backgroundLocation: true,
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
 * - **iOS**: No-op, returns current status (permissions handled natively during SDK initialization)
 *
 * **Permissions Requested (Android only):**
 * - Fine location (with fallback to coarse location)
 * - Bluetooth scan (Android 12+)
 * - Bluetooth connect (Android 12+)
 * - Post notifications (Android 13+)
 *
 * The function presents user-friendly dialogs in Portuguese with explanations
 * for why each permission is needed.
 *
 * @returns Promise<PermissionResult> Updated permission status after requests
 *
 * @example
 * ```typescript
 * const result = await requestForegroundPermissions();
 * if (result.fineLocation && result.btScan) {
 *   // Ready to start scanning for beacons
 * }
 * ```
 */
export async function requestForegroundPermissions(): Promise<PermissionResult> {
  if (!isAndroid) return checkPermissions();

  const req = async (p: Permission, title: string, msg: string) => {
    const res = await PermissionsAndroid.request(p, {
      title,
      message: msg,
      buttonPositive: 'OK',
      buttonNegative: 'Cancelar',
    });
    return res === PermissionsAndroid.RESULTS.GRANTED;
  };

  let fineGranted = await req(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    'Permissão de Localização',
    'Precisamos de localização para escanear beacons via Bluetooth.'
  );

  let coarseGranted = false;
  if (!fineGranted) {
    coarseGranted = await req(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      'Permissão de Localização Aproximada',
      'Se preferir, conceda localização aproximada para permitir o escaneamento.'
    );
  }

  const btScan =
    SDK_INT >= 31
      ? await req(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          'Permissão de Bluetooth',
          'Precisamos de acesso ao Bluetooth para escanear beacons.'
        )
      : true;

  const btConnect =
    SDK_INT >= 31
      ? await req(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          'Permissão de Conexão Bluetooth',
          'Necessário para interagir com dispositivos BLE.'
        )
      : true;

  const notifications =
    SDK_INT >= 33
      ? await req(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          'Permissão de Notificações',
          'Usamos notificações para indicar o monitoramento em andamento.'
        )
      : true;

  const current = await checkPermissions();
  return {
    ...current,
    fineLocation: current.fineLocation || fineGranted || coarseGranted,
    btScan: current.btScan || btScan,
    btConnect: current.btConnect || btConnect,
    notifications: current.notifications || notifications,
  };
}

/**
 * Requests background location permission for beacon detection when app is not active.
 *
 * **Platform Support:**
 * - **Android**: Shows system dialog for background location permission (Android 10+)
 * - **iOS**: No-op, always returns true (handled natively during SDK initialization)
 *
 * **Android Behavior:**
 * - Requires foreground location permission first (Android 10)
 * - On Android 12+, background location can be requested without foreground fine location
 * - If user selects "Never ask again", automatically opens app settings
 * - Only available on Android 10+ (API 29+)
 *
 * **Important:** Background location is essential for detecting beacons when the app
 * is backgrounded or closed, enabling geofencing and proximity features.
 *
 * @returns Promise<boolean> true if background location permission is granted
 *
 * @example
 * ```typescript
 * const hasBackground = await requestBackgroundLocation();
 * if (hasBackground) {
 *   // Can detect beacons in background
 * } else {
 *   // Limited to foreground detection only
 * }
 * ```
 */
export async function requestBackgroundLocation(): Promise<boolean> {
  if (!isAndroid || SDK_INT < 29) return true;

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

  if (res === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    await Linking.openSettings();
  }

  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/**
 * Convenience function to ensure all necessary permissions are requested and granted.
 *
 * **Platform Support:**
 * - **Android**: Requests foreground permissions and optionally background location
 * - **iOS**: No-op, returns current status (all permissions handled natively)
 *
 * This is the recommended function to call during app initialization to ensure
 * the Bearound SDK has all required permissions.
 *
 * **Flow:**
 * 1. Requests all foreground permissions (location, Bluetooth, notifications)
 * 2. Optionally requests background location permission
 * 3. Returns final permission status
 *
 * @param opts - Configuration options
 * @param opts.askBackground - Whether to request background location permission (default: true)
 * @returns Promise<PermissionResult> Final status of all permissions
 *
 * @example
 * ```typescript
 * // Request all permissions including background
 * const permissions = await ensurePermissions();
 *
 * // Skip background location request
 * const permissions = await ensurePermissions({ askBackground: false });
 * ```
 */
export async function ensurePermissions(opts = { askBackground: true }) {
  await requestForegroundPermissions();
  if (opts.askBackground) {
    await requestBackgroundLocation();
  }
  return checkPermissions();
}
