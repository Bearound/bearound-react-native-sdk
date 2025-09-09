/**
 * @fileoverview Main entry point for the Bearound React Native SDK
 *
 * This module provides the primary API for integrating Bearound's BLE beacon detection
 * capabilities into React Native applications. The SDK has been simplified to remove
 * event listeners - all beacon detection and processing now happens natively.
 *
 * **Platform Support:**
 * - **Android**: Full native integration with permission management
 * - **iOS**: Native framework integration with automatic permission handling
 *
 * **Key Features:**
 * - Simple initialize/stop lifecycle
 * - Cross-platform BLE beacon detection
 * - Background monitoring capabilities
 * - Automatic native processing (no JavaScript callbacks)
 * - Built-in permission management (Android)
 *
 * @author Bearound Team
 * @version 2.0.0
 */

import Native from './NativeBearoundReactSdk';

/**
 * Event constants for the Bearound SDK (legacy - no longer used)
 *
 * @deprecated These events are no longer emitted. All beacon processing
 * happens natively without JavaScript callbacks.
 */
export const EVENTS = {
  BEACON: 'bearound:beacon',
  STOPPED: 'bearound:stopped',
} as const;

/**
 * Initializes the Bearound SDK and starts beacon monitoring.
 *
 * **Platform Behavior:**
 * - **Android**: Requires permissions to be granted before calling this function.
 *   Use `ensurePermissions()` first to request all required permissions.
 * - **iOS**: Automatically requests permissions during initialization.
 *   Info.plist must be properly configured with usage descriptions.
 *
 * **Important Notes:**
 * - Only call this once per app lifecycle
 * - Always call `stop()` before calling `initialize()` again
 * - Beacon detection happens entirely in native code
 * - Background monitoring is enabled automatically if permissions allow
 *
 * @param clientToken - Your Bearound client authentication token
 * @param debug - Enable debug logging in native SDKs (default: false)
 * @returns Promise that resolves when SDK is successfully initialized
 *
 * @throws {Error} If SDK fails to initialize (invalid token, missing permissions, etc.)
 *
 * @example
 * ```typescript
 * import { initialize, ensurePermissions } from 'bearound-react-native-sdk';
 * import { Platform } from 'react-native';
 *
 * async function startBeaconMonitoring() {
 *   try {
 *     // Request permissions on Android
 *     if (Platform.OS === 'android') {
 *       const permissions = await ensurePermissions({ askBackground: true });
 *       if (!permissions.fineLocation || !permissions.btScan) {
 *         throw new Error('Required permissions not granted');
 *       }
 *     }
 *
 *     // Initialize SDK (iOS handles permissions automatically)
 *     await initialize('your-client-token', __DEV__);
 *     console.log('Bearound SDK started successfully');
 *   } catch (error) {
 *     console.error('Failed to start SDK:', error);
 *   }
 * }
 * ```
 */
export async function initialize(clientToken: string, debug = false) {
  await Native.initialize(clientToken, debug);
}

/**
 * Stops the Bearound SDK and cleans up all native resources.
 *
 * **Behavior:**
 * - Stops all beacon scanning immediately
 * - Terminates background monitoring
 * - Releases BLE scanner resources
 * - Stops foreground service (Android)
 * - Cleans up native SDK instances
 *
 * **Important Notes:**
 * - Safe to call multiple times
 * - Always call before app termination for proper cleanup
 * - Required before calling `initialize()` again
 * - Does not reset permissions (they remain granted)
 *
 * @returns Promise that resolves when SDK is completely stopped
 *
 * @example
 * ```typescript
 * import { stop } from 'bearound-react-native-sdk';
 *
 * async function stopBeaconMonitoring() {
 *   try {
 *     await stop();
 *     console.log('Bearound SDK stopped successfully');
 *   } catch (error) {
 *     console.error('Error stopping SDK:', error);
 *   }
 * }
 *
 * // Stop SDK when app goes to background (optional)
 * import { AppState } from 'react-native';
 *
 * AppState.addEventListener('change', (nextAppState) => {
 *   if (nextAppState === 'background') {
 *     stopBeaconMonitoring();
 *   }
 * });
 * ```
 */
export async function stop() {
  await Native.stop();
}

/**
 * Re-export all permission-related functions and types.
 *
 * **Available exports:**
 * - `ensurePermissions(opts?)` - Request all required permissions (Android)
 * - `checkPermissions()` - Check current permission status (Android)
 * - `requestForegroundPermissions()` - Request foreground permissions only (Android)
 * - `requestBackgroundLocation()` - Request background location permission (Android)
 * - `PermissionResult` - Type definition for permission status
 *
 * **Note:** All permission functions are no-ops on iOS since permissions
 * are handled natively during SDK initialization.
 */
export * from './permissions';
