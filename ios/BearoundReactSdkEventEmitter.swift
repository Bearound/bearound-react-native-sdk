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
      // v2.4 — region + location capture lifecycle
      "bearound:beaconRegion",
      "bearound:activeScan",
      "bearound:locationCapture",
    ]
  }

  @objc public override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
