import Foundation
import BearoundSDK

@objc(RNBearoundBridge)
public class RNBearoundBridge: NSObject, BearoundEventDelegate {
  @objc public static let shared = RNBearoundBridge()
  private var sdk: Bearound?

  @objc public func initialize(_ clientToken: String, debug: Bool) {
    DispatchQueue.main.async {
         self.sdk = Bearound(clientToken: clientToken, isDebugEnable: debug)
         self.sdk?.eventDelegate = self
         self.sdk?.startServices()
       }
  }

  @objc public func stop() {
    DispatchQueue.main.async {
         self.sdk?.stopServices()
         self.sdk = nil
         NotificationCenter.default.post(name: .bearoundStopped, object: nil)
       }
  }

  public func didUpdateBeacon(_ beacon: Beacon) {
    let payload: [String: Any] = [
          "uuid": beacon.uuid.uuidString,
          "major": beacon.major,
          "minor": beacon.minor,
          "rssi": beacon.rssi,
          "bluetoothName": beacon.bluetoothName ?? "",
          "bluetoothAddress": beacon.bluetoothAddress ?? "",
          "distanceMeters": beacon.distanceMeters ?? 0.0
        ]
        NotificationCenter.default.post(
          name: .bearoundBeacon,
          object: nil,
          userInfo: ["beacon": payload]
        )
      }
  }

extension Notification.Name {
  static let bearoundBeacon  = Notification.Name("bearound:beacon")
  static let bearoundStopped = Notification.Name("bearound:stopped")
}
