/**
 * @fileoverview Native TurboModule interface for Bearound React Native SDK
 *
 * This module defines the TypeScript interface for the native Bearound SDK
 * implementation using React Native's TurboModule architecture. It provides
 * the bridge between JavaScript and native Android/iOS SDKs.
 *
 * **TurboModule Benefits:**
 * - Type-safe native method calls
 * - Better performance than legacy bridge
 * - Compatible with New Architecture
 * - Backward compatible with Classic Architecture
 * - Lazy initialization of native modules
 *
 * **Native Implementation:**
 * - **Android**: BearoundReactSdkModule.kt - Kotlin implementation
 * - **iOS**: BearoundReactSdk.mm/.h - Objective-C++ implementation
 *
 * **Module Registration:**
 * The native module is registered as 'BearoundReactSdk' and provides
 * the core SDK functionality through async method calls.
 *
 * @author Bearound Team
 * @since 2.0.0
 */

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * TurboModule specification for the Bearound SDK native interface.
 *
 * This interface defines the contract between JavaScript and native code,
 * ensuring type safety and proper method signatures across platforms.
 *
 * **Method Lifecycle:**
 * 1. `initialize()` - Starts the native SDK and beacon scanning
 * 2. `stop()` - Stops scanning and cleans up native resources
 *
 * **Error Handling:**
 * All methods return Promise<void> and will reject with descriptive
 * error messages if the native operation fails.
 *
 * @interface Spec
 * @extends TurboModule
 */
export interface Spec extends TurboModule {
  /**
   * Initializes the native Bearound SDK and starts beacon monitoring.
   *
   * **Native Behavior:**
   * - **Android**:
   *   - Verifies runtime permissions before starting
   *   - Starts foreground service for background scanning
   *   - Initializes BLE scanner with beacon filters
   *   - Sets up native beacon processing pipeline
   *
   * - **iOS**:
   *   - Requests location/Bluetooth permissions if needed
   *   - Configures Core Location and Core Bluetooth managers
   *   - Sets up beacon region monitoring
   *   - Enables background beacon detection
   *
   * **Important Notes:**
   * - Must be called only once per app lifecycle
   * - Android requires permissions to be granted first
   * - iOS handles permissions automatically
   * - Beacon processing happens entirely in native code
   *
   * @param clientToken - Authentication token for Bearound services
   * @param debug - Optional debug mode flag (default: false)
   * @returns Promise that resolves when SDK is initialized successfully
   *
   * @throws {Error} When initialization fails due to:
   * - Invalid or expired client token
   * - Missing required permissions (Android)
   * - Bluetooth/Location services disabled
   * - Native SDK initialization errors
   *
   * @example
   * ```typescript
   * try {
   *   await NativeModule.initialize('your-token', true);
   * } catch (error) {
   *   console.error('SDK initialization failed:', error.message);
   * }
   * ```
   */
  initialize(clientToken: string, debug?: boolean): Promise<void>;

  /**
   * Stops the native Bearound SDK and cleans up all resources.
   *
   * **Native Behavior:**
   * - **Android**:
   *   - Stops BLE scanner immediately
   *   - Terminates foreground service
   *   - Cleans up scanner callbacks and listeners
   *   - Releases wake locks and system resources
   *
   * - **iOS**:
   *   - Stops Core Location beacon monitoring
   *   - Stops Core Bluetooth central manager
   *   - Cleans up delegate callbacks
   *   - Releases native SDK instance
   *
   * **Important Notes:**
   * - Safe to call multiple times (idempotent)
   * - Should be called before app termination
   * - Required before calling `initialize()` again
   * - Does not affect previously granted permissions
   * - Stops background monitoring immediately
   *
   * @returns Promise that resolves when SDK is completely stopped
   *
   * @throws {Error} Rarely throws, but may fail if:
   * - Native resources are already released
   * - System is in inconsistent state
   *
   * @example
   * ```typescript
   * try {
   *   await NativeModule.stop();
   *   console.log('SDK stopped successfully');
   * } catch (error) {
   *   console.warn('Error during SDK stop:', error.message);
   * }
   * ```
   */
  stop(): Promise<void>;
}

/**
 * Native module instance for Bearound SDK.
 *
 * This is the main interface to the native Bearound SDK implementation.
 * The module is lazily loaded and enforces the Spec interface for type safety.
 *
 * **Module Resolution:**
 * - Looks for native module registered as 'BearoundReactSdk'
 * - Throws if module is not found (indicates linking issues)
 * - Returns typed interface matching the Spec definition
 *
 * **Usage:**
 * This default export should not be used directly. Instead, use the
 * higher-level functions from the main index file that provide better
 * error handling and developer experience.
 *
 * @throws {Error} If native module 'BearoundReactSdk' is not properly linked
 */
export default TurboModuleRegistry.getEnforcing<Spec>('BearoundReactSdk');
