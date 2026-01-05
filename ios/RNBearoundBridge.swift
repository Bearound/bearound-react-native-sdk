import Foundation
import CoreLocation
import BearoundSDK

@objcMembers
@objc(RNBearoundBridge)
public class RNBearoundBridge: NSObject, CLLocationManagerDelegate, BeAroundSDKDelegate {
  @objc public static let shared = RNBearoundBridge()
  private let sdk = BeAroundSDK.shared

  private var permissionManager: CLLocationManager?
  private var permissionCompletion: ((Bool) -> Void)?

  public func configure(
    _ appId: String,
    syncInterval: Double,
    enableBluetoothScanning: Bool,
    enablePeriodicScanning: Bool
  ) {
    DispatchQueue.main.async {
      self.sdk.configure(
        appId: appId,
        syncInterval: syncInterval,
        enableBluetoothScanning: enableBluetoothScanning,
        enablePeriodicScanning: enablePeriodicScanning
      )
      self.sdk.delegate = self
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
    return sdk.isScanning
  }

  public func setBluetoothScanning(_ enabled: Bool) {
    DispatchQueue.main.async {
      self.sdk.setBluetoothScanning(enabled: enabled)
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

  public func didUpdateSyncStatus(secondsUntilNextSync: Int, isRanging: Bool) {
    let payload: [String: Any] = [
      "secondsUntilNextSync": secondsUntilNextSync,
      "isRanging": isRanging
    ]
    DispatchQueue.main.async {
      BearoundReactSdkEventEmitter.emit("bearound:sync", body: payload)
    }
  }

  private func mapProximity(_ proximity: CLProximity) -> String {
    switch proximity {
    case .immediate:
      return "immediate"
    case .near:
      return "near"
    case .far:
      return "far"
    case .unknown:
      return "unknown"
    @unknown default:
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
}
