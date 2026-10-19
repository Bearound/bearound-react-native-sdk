import Foundation
import React

@objc(BearoundReactSdkEventEmitter)
public class BearoundReactSdkEventEmitter: RCTEventEmitter {
  private static var shared: BearoundReactSdkEventEmitter?

  public override init() {
    super.init()
    BearoundReactSdkEventEmitter.shared = self
  }

  @objc public static func emit(_ name: String, body: Any) {
    shared?.sendEvent(withName: name, body: body)
  }

  public override func supportedEvents() -> [String]! {
    return [
      "bearound:beacons",
      "bearound:syncLifecycle",
      "bearound:backgroundDetection",
      "bearound:scanning",
      "bearound:error",
      // v2.4 — beacon region lifecycle
      "bearound:beaconRegion",
      "bearound:activeScan",
      // v2.5 — Bluetooth "two eyes" zone (iOS-only)
      "bearound:bluetoothZone",
      "bearound:bluetoothScanMode",
      // Bluetooth adapter state (poweredOn/off/unauthorized/...)
      "bearound:bluetoothState",
    ]
  }

  @objc public override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
