import Foundation
import BearoundSDK

@objc(RNBearoundBridge)
public class RNBearoundBridge: NSObject {
  @objc public static let shared = RNBearoundBridge()
  private var sdk: Bearound?

  @objc public func initialize(_ clientToken: String, debug: Bool) {
    DispatchQueue.main.async {
      self.sdk = Bearound.configure(clientToken: clientToken, isDebugEnable: debug)
      self.sdk?.requestPermissions()
      self.sdk?.startServices()
    }
  }

  @objc public func stop() {
    DispatchQueue.main.async {
      self.sdk?.stopServices()
      self.sdk = nil
    }
  }
}
