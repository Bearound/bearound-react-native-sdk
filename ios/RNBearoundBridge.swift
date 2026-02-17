import Foundation
import CoreLocation
import BearoundSDK

@objcMembers
@objc(RNBearoundBridge)
public class RNBearoundBridge: NSObject, CLLocationManagerDelegate, BeAroundSDKDelegate {
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

  public func configure(
    _ businessToken: String,
    foregroundScanInterval: Double,
    backgroundScanInterval: Double,
    maxQueuedPayloads: Double,
    enableBluetoothScanning: Bool,
    enablePeriodicScanning: Bool
  ) {
    DispatchQueue.main.async {
      let foregroundInterval = self.mapToForegroundScanInterval(Int(foregroundScanInterval))
      let backgroundInterval = self.mapToBackgroundScanInterval(Int(backgroundScanInterval))
      let maxQueued = self.mapToMaxQueuedPayloads(Int(maxQueuedPayloads))
      
      // FIX: If SDK was already scanning, stop it first so new config takes effect
      let wasScanning = self.sdk.isScanning
      if wasScanning {
        self.sdk.stopScanning()
      }
      
      self.sdk.configure(
        businessToken: businessToken,
        foregroundScanInterval: foregroundInterval,
        backgroundScanInterval: backgroundInterval,
        maxQueuedPayloads: maxQueued
      )
      self.sdk.delegate = self
      
      // If SDK was scanning before, restart with new configuration
      if wasScanning {
        // Force correct foreground state
        let appState = UIApplication.shared.applicationState
        if appState == .active {
          NotificationCenter.default.post(name: UIApplication.willEnterForegroundNotification, object: nil)
        }
        
        self.sdk.startScanning()
      }
    }
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

  public func setBluetoothScanning(_ enabled: Bool) {
    // v2.2.1: Bluetooth scanning is now automatic - method deprecated
    // Maintained for backward compatibility but does nothing
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

  public func checkPermissions() -> Bool {
    let status = currentAuthorizationStatus()
    return status == .authorizedAlways || status == .authorizedWhenInUse
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

  // BeAroundSDKDelegate callbacks (v2.2.1)
  
  public func didUpdateBeacons(_ beacons: [Beacon]) {
    let mapped = beacons.map { beacon -> [String: Any] in
      var payload: [String: Any] = [
        "uuid": beacon.uuid.uuidString,
        "major": beacon.major,
        "minor": beacon.minor,
        "rssi": beacon.rssi,
        "proximity": mapProximity(beacon.proximity),
        "accuracy": beacon.accuracy,
        "timestamp": Int(beacon.timestamp.timeIntervalSince1970 * 1000)
      ]

      if let metadata = beacon.metadata {
        payload["metadata"] = mapMetadata(metadata)
      }
      if let txPower = beacon.txPower {
        payload["txPower"] = txPower
      }

      return payload
    }

    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:beacons", body: ["beacons": mapped])
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
  }
  
  public func didDetectBeaconInBackground(beaconCount: Int) {
    let payload: [String: Any] = [
      "beaconCount": beaconCount
    ]
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:backgroundDetection", body: payload)
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

  private func mapToForegroundScanInterval(_ seconds: Int) -> ForegroundScanInterval {
    switch seconds {
    case 5: return .seconds5
    case 10: return .seconds10
    case 15: return .seconds15
    case 20: return .seconds20
    case 25: return .seconds25
    case 30: return .seconds30
    case 35: return .seconds35
    case 40: return .seconds40
    case 45: return .seconds45
    case 50: return .seconds50
    case 55: return .seconds55
    case 60: return .seconds60
    default: return .seconds15
    }
  }

  private func mapToBackgroundScanInterval(_ seconds: Int) -> BackgroundScanInterval {
    switch seconds {
    case 15: return .seconds15
    case 30: return .seconds30
    case 60: return .seconds60
    case 90: return .seconds90
    case 120: return .seconds120
    default: return .seconds30
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
