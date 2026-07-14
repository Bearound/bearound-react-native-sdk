import Foundation
import CoreLocation
import CoreBluetooth
import UserNotifications
import BearoundSDK

@objcMembers
@objc(RNBearoundBridge)
public class RNBearoundBridge: NSObject, CLLocationManagerDelegate, CBCentralManagerDelegate, BeAroundSDKDelegate {
  @objc public static let shared = RNBearoundBridge()
  private lazy var sdk: BeAroundSDK = {
    if Thread.isMainThread {
      return BeAroundSDK.shared
    }
    var instance: BeAroundSDK!
    DispatchQueue.main.sync {
      instance = BeAroundSDK.shared
    }
    return instance
  }()

  private var permissionManager: CLLocationManager?
  private var permissionCompletion: ((Bool) -> Void)?
  private var configured = false

  // Bluetooth eye state — mirrors the iOS native demo's CBCentralManager status.
  // The two eyes (Location / Bluetooth) are independent: the SDK works with either.
  private var btManager: CBCentralManager?
  private var btState: String = "unknown"

  public func configure(
    _ businessToken: String,
    scanPrecision: String,
    maxQueuedPayloads: Double
  ) {
    DispatchQueue.main.async {
      let precision = self.mapToScanPrecision(scanPrecision)
      let maxQueued = self.mapToMaxQueuedPayloads(Int(maxQueuedPayloads))

      let wasScanning = self.sdk.isScanning
      if wasScanning {
        self.sdk.stopScanning()
      }

      self.sdk.configure(
        businessToken: businessToken,
        scanPrecision: precision,
        maxQueuedPayloads: maxQueued,
        technology: "react-native"
      )
      self.sdk.delegate = self
      self.configured = true

      if wasScanning {
        self.sdk.startScanning()
      }
    }
  }

  // MARK: - Diagnostic / state getters (parity with native public API)

  public func getSdkVersion() -> String {
    return BeAroundSDK.version
  }

  public func getCurrentScanPrecision() -> String {
    return mainThreadSync { self.sdk.currentScanPrecision?.rawValue ?? "" }
  }

  public func getBleDiagnosticInfo() -> String {
    return mainThreadSync { self.sdk.bleDiagnosticInfo }
  }

  public func getPendingBatchCount() -> Int {
    return mainThreadSync { self.sdk.pendingBatchCount }
  }

  public func isConfigured() -> Bool {
    return configured
  }

  public func isLocationAvailable() -> Bool {
    return BeAroundSDK.isLocationAvailable()
  }

  public func getAuthorizationStatus() -> String {
    switch BeAroundSDK.authorizationStatus() {
    case .authorizedAlways: return "always"
    case .authorizedWhenInUse: return "whenInUse"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "unknown"
    }
  }

  public func requestLocationAuthorization(_ level: String) {
    let mapped: BeAroundLocationAuthorization =
      level.lowercased() == "wheninuse" ? .whenInUse : .always
    DispatchQueue.main.async {
      self.sdk.requestLocationAuthorization(mapped)
    }
  }

  // Bluetooth eye — current CBCentralManager state. Independent of Location.

  public func getBluetoothState() -> String {
    ensureBluetoothManager()
    return mainThreadSync { self.btState }
  }

  private func ensureBluetoothManager() {
    if btManager != nil { return }
    let make = {
      self.btManager = CBCentralManager(
        delegate: self,
        queue: nil,
        options: [CBCentralManagerOptionShowPowerAlertKey: false]
      )
    }
    if Thread.isMainThread {
      make()
    } else {
      DispatchQueue.main.sync { make() }
    }
  }

  public func centralManagerDidUpdateState(_ central: CBCentralManager) {
    btState = mapBluetoothState(central.state)
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit(
        "bearound:bluetoothState",
        body: ["state": self.btState]
      )
    }
  }

  private func mapBluetoothState(_ state: CBManagerState) -> String {
    switch state {
    case .poweredOn: return "poweredOn"
    case .poweredOff: return "poweredOff"
    case .unauthorized: return "unauthorized"
    case .unsupported: return "unsupported"
    case .resetting: return "resetting"
    case .unknown: return "unknown"
    @unknown default: return "unknown"
    }
  }

  // Persistent detection log is owned by the native SDK (survives app restarts
  // and captures background/closed activity). The bridge just delegates.
  public func getPersistedLog() -> String {
    return mainThreadSync { self.sdk.getDetectionLogJson() }
  }

  public func clearPersistedLog() {
    DispatchQueue.main.async { self.sdk.clearDetectionLog() }
  }

  // Foreground-service scanning is Android-only — iOS uses BGTaskScheduler/region
  // monitoring, with no persistent-notification foreground service. These are no-ops.

  public func enableForegroundScanning(_ config: NSDictionary) {}

  public func disableForegroundScanning() {}

  public func isForegroundScanningEnabled() -> Bool {
    return false
  }

  public func setForegroundNotificationContent(_ content: NSDictionary) {}

  // Background reliability (Android-only; no-op on iOS). iOS has no user-facing
  // battery-optimization / autostart exemption like Android's Doze / OEM killers.
  // Report "already ignoring optimizations" so hosts don't prompt, and false for
  // the Android-only open-settings / autostart methods.

  public func isIgnoringBatteryOptimizations() -> Bool {
    return true
  }

  public func openBatteryOptimizationSettings() -> Bool {
    return false
  }

  public func isAutostartManageable() -> Bool {
    return false
  }

  public func openManufacturerAutostartSettings() -> Bool {
    return false
  }

  public func startScanning() {
    DispatchQueue.main.async {
      self.sdk.delegate = self
      self.sdk.startScanning()
    }
  }

  public func stopScanning() {
    DispatchQueue.main.async {
      self.sdk.stopScanning()
    }
  }

  public func isScanning() -> Bool {
    return mainThreadSync {
      self.sdk.isScanning
    }
  }

  public func setUserProperties(_ properties: NSDictionary) {
    let internalId = properties["internalId"] as? String
    let email = properties["email"] as? String
    let name = properties["name"] as? String
    let customRaw = properties["customProperties"] as? [String: Any] ?? [:]
    var custom: [String: String] = [:]
    customRaw.forEach { key, value in
      if let stringValue = value as? String {
        custom[key] = stringValue
      }
    }

    let userProperties = UserProperties(
      internalId: internalId,
      email: email,
      name: name,
      customProperties: custom
    )

    DispatchQueue.main.async {
      self.sdk.setUserProperties(userProperties)
    }
  }

  public func clearUserProperties() {
    DispatchQueue.main.async {
      self.sdk.clearUserProperties()
    }
  }

  public func setPushToken(_ token: String) {
    DispatchQueue.main.async {
      self.sdk.setPushToken(token)
    }
  }

  // Silent-push wake-up. On iOS the AppDelegate already handles the `bearound`
  // silent push directly, so this exists mainly for cross-platform parity with
  // Android: it triggers the same background BLE refresh + sync when the payload
  // is a Bearound wake, and ignores anything else.
  public func handleRemoteMessage(_ data: [String: Any]) -> Bool {
    guard data["bearound"] != nil else { return false }
    DispatchQueue.main.async {
      self.sdk.performBackgroundBLERefreshAndSync(
        bleScanDuration: 10,
        trigger: "silent_push"
      ) { _ in }
    }
    return true
  }

  public func checkPermissions() -> Bool {
    let status = currentAuthorizationStatus()
    return status == .authorizedAlways || status == .authorizedWhenInUse
  }

  // Real notification-permission check (UNUserNotificationCenter). Backs the
  // `notifications` field of the JS PermissionResult — previously hardcoded true.
  public func checkNotificationPermission(_ completion: @escaping (Bool) -> Void) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      let granted =
        settings.authorizationStatus == .authorized
        || settings.authorizationStatus == .provisional
        || settings.authorizationStatus == .ephemeral
      completion(granted)
    }
  }

  public func requestPermissions(_ completion: @escaping (Bool) -> Void) {
    DispatchQueue.main.async {
      guard CLLocationManager.locationServicesEnabled() else {
        completion(false)
        return
      }

      let status = self.currentAuthorizationStatus()
      if status == .authorizedAlways || status == .authorizedWhenInUse {
        completion(true)
        return
      }

      guard status == .notDetermined else {
        completion(false)
        return
      }

      self.permissionCompletion = completion
      let manager = CLLocationManager()
      self.permissionManager = manager
      manager.delegate = self
      manager.requestAlwaysAuthorization()
    }
  }

  @available(iOS 14.0, *)
  public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
    handleAuthorizationChange(manager.authorizationStatus)
  }

  public func locationManager(
    _ manager: CLLocationManager,
    didChangeAuthorization status: CLAuthorizationStatus
  ) {
    handleAuthorizationChange(status)
  }

  private func handleAuthorizationChange(_ status: CLAuthorizationStatus) {
    guard status != .notDetermined else { return }

    let granted = status == .authorizedAlways || status == .authorizedWhenInUse
    permissionCompletion?(granted)
    permissionCompletion = nil
    permissionManager?.delegate = nil
    permissionManager = nil
  }

  private func currentAuthorizationStatus() -> CLAuthorizationStatus {
    if #available(iOS 14.0, *) {
      return CLLocationManager().authorizationStatus
    }
    return CLLocationManager.authorizationStatus()
  }

  // BeAroundSDKDelegate callbacks (native 3.3.1)
  
  public func didUpdateBeacons(_ beacons: [Beacon]) {
    let mapped = beacons.map { mapBeacon($0) }
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:beacons", body: ["beacons": mapped])
    }
  }

  private func mapBeacon(_ beacon: Beacon) -> [String: Any] {
    var payload: [String: Any] = [
      "uuid": beacon.uuid.uuidString,
      "major": beacon.major,
      "minor": beacon.minor,
      "rssi": beacon.rssi,
      "proximity": mapProximity(beacon.proximity),
      "accuracy": beacon.accuracy,
      "timestamp": Int(beacon.timestamp.timeIntervalSince1970 * 1000),
      // iOS-only: which detector(s) saw this beacon — drives the "two eyes" model.
      "discoverySources": beacon.discoverySources.map { mapDiscoverySource($0) },
      "alreadySynced": beacon.alreadySynced
    ]

    if let metadata = beacon.metadata {
      payload["metadata"] = mapMetadata(metadata)
    }
    if let txPower = beacon.txPower {
      payload["txPower"] = txPower
    }
    if let syncedAt = beacon.syncedAt {
      payload["syncedAt"] = Int(syncedAt.timeIntervalSince1970 * 1000)
    }

    return payload
  }

  private func mapDiscoverySource(_ source: BeaconDiscoverySource) -> String {
    switch source {
    case .serviceUUID: return "serviceUUID"
    case .name: return "name"
    case .coreLocation: return "coreLocation"
    }
  }

  public func didFailWithError(_ error: Error) {
    let payload: [String: Any] = [
      "message": error.localizedDescription
    ]
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:error", body: payload)
    }
  }

  public func didChangeScanning(isScanning: Bool) {
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:scanning", body: ["isScanning": isScanning])
    }
  }
  
  public func willStartSync(beaconCount: Int) {
    let payload: [String: Any] = [
      "type": "started",
      "beaconCount": beaconCount
    ]
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:syncLifecycle", body: payload)
    }
  }
  
  public func didCompleteSync(beaconCount: Int, success: Bool, error: Error?) {
    let payload: [String: Any] = [
      "type": "completed",
      "beaconCount": beaconCount,
      "success": success,
      "error": error?.localizedDescription as Any
    ]
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:syncLifecycle", body: payload)
    }
    // Persisted log handled by the SDK's DetectionLogStore — no duplication.
    // The SDK posts no user-facing notifications; the host app decides.
  }

  // v3.0: native changed the signature from (beaconCount: Int) to (beacons: [Beacon]).
  // The JS event keeps the {beaconCount} shape for cross-platform parity with Android.
  public func didDetectBeaconInBackground(beacons: [Beacon]) {
    let payload: [String: Any] = [
      "beaconCount": beacons.count
    ]
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:backgroundDetection", body: payload)
    }
    // Persisted log handled by the SDK.
  }

  // v2.5 — Beacon region lifecycle (bridge only forwards the event; host app owns any notification).

  public func didEnterBeaconRegion() {
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:beaconRegion", body: ["type": "enter"])
    }
  }

  public func didExitBeaconRegion() {
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:beaconRegion", body: ["type": "exit"])
    }
  }

  public func didChangeActiveScanState(isActive: Bool) {
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:activeScan", body: ["isActive": isActive])
    }
  }

  // v2.5 — Bluetooth "two eyes" zone (iOS-only; Android has no equivalent).

  public func didEnterBluetoothZone() {
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:bluetoothZone", body: ["type": "enter"])
    }
  }

  public func didExitBluetoothZone() {
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:bluetoothZone", body: ["type": "exit"])
    }
  }

  public func didChangeBluetoothScanMode(_ mode: BluetoothScanMode, nextIdleScanAt: Date?) {
    var payload: [String: Any] = [
      "mode": mode.rawValue
    ]
    if let nextIdleScanAt = nextIdleScanAt {
      payload["nextIdleScanAt"] = Int(nextIdleScanAt.timeIntervalSince1970 * 1000)
    }
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:bluetoothScanMode", body: payload)
    }
  }

  private func mapProximity(_ proximity: BeaconProximity) -> String {
    switch proximity {
    case .immediate:
      return "immediate"
    case .near:
      return "near"
    case .far:
      return "far"
    case .bt:
      return "bt"
    case .unknown:
      return "unknown"
    }
  }

  private func mapMetadata(_ metadata: BeaconMetadata) -> [String: Any] {
    var payload: [String: Any] = [
      "firmwareVersion": metadata.firmwareVersion,
      "batteryLevel": metadata.batteryLevel,
      "movements": metadata.movements,
      "temperature": metadata.temperature
    ]

    if let txPower = metadata.txPower {
      payload["txPower"] = txPower
    }
    if let rssiFromBLE = metadata.rssiFromBLE {
      payload["rssiFromBLE"] = rssiFromBLE
    }
    if let isConnectable = metadata.isConnectable {
      payload["isConnectable"] = isConnectable
    }

    return payload
  }

  private func mainThreadSync<T>(_ work: () -> T) -> T {
    if Thread.isMainThread {
      return work()
    }
    var result: T!
    DispatchQueue.main.sync {
      result = work()
    }
    return result
  }

  private func mapToScanPrecision(_ value: String) -> ScanPrecision {
    switch value.lowercased() {
    case "high": return .high
    case "medium": return .medium
    case "low": return .low
    default: return .high
    }
  }

  private func mapToMaxQueuedPayloads(_ value: Int) -> MaxQueuedPayloads {
    switch value {
    case 50: return .small
    case 100: return .medium
    case 200: return .large
    case 500: return .xlarge
    default: return .medium
    }
  }
}
