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
 * 1. `configure()` - Configure native SDK settings
 * 2. `startScanning()` - Starts beacon scanning
 * 3. `stopScanning()` - Stops scanning and cleans up native resources
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
   * Configures the native Bearound SDK before starting scans.
   *
   * **Important Notes:**
   * - Must be called before `startScanning()`
   * - Business token is required
   * - Sync interval is expressed in seconds (5-60)
   *
   * @param businessToken - Business token for authentication (required)
   * @param syncInterval - Sync interval in seconds
   * @param enableBluetoothScanning - Enables BLE metadata scanning
   * @param enablePeriodicScanning - Enables periodic scanning mode
   */
  configure(
    businessToken: string,
    syncInterval: number,
    enableBluetoothScanning: boolean,
    enablePeriodicScanning: boolean
  ): Promise<void>;

  /**
   * Starts beacon scanning after `configure()`.
   */
  startScanning(): Promise<void>;

  /**
   * Stops beacon scanning and cleans up native resources.
   */
  stopScanning(): Promise<void>;

  /**
   * Returns whether the SDK is currently scanning.
   */
  isScanning(): Promise<boolean>;

  /**
   * Enables or disables Bluetooth metadata scanning.
   */
  setBluetoothScanning(enabled: boolean): Promise<void>;

  /**
   * Sets user properties associated with beacon events.
   */
  setUserProperties(properties: Object): Promise<void>;

  /**
   * Clears user properties.
   */
  clearUserProperties(): Promise<void>;

  /**
   * Checks whether location permission is granted on iOS.
   */
  checkPermissions(): Promise<boolean>;

  /**
   * Requests location permission on iOS.
   */
  requestPermissions(): Promise<boolean>;

  /**
   * Event subscription management for NativeEventEmitter.
   */
  addListener(eventName: string): void;

  /**
   * Event subscription management for NativeEventEmitter.
   */
  removeListeners(count: number): void;
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
