#import "BearoundReactSdk.h"
#import "BearoundReactSdk-Swift.h"

@implementation BearoundReactSdk

RCT_EXPORT_MODULE();

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
  (const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeBearoundReactSdkSpecJSI>(params);
}

RCT_EXPORT_METHOD(addListener:(NSString *)eventName) {}
RCT_EXPORT_METHOD(removeListeners:(double)count) {}

- (void)configure:(NSString *)appId
       syncInterval:(double)syncInterval
enableBluetoothScanning:(BOOL)enableBluetoothScanning
enablePeriodicScanning:(BOOL)enablePeriodicScanning
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  NSString *rawAppId = appId ?: @"";
  NSString *trimmed = [rawAppId stringByTrimmingCharactersInSet:
                       [NSCharacterSet whitespaceAndNewlineCharacterSet]];
  NSString *fallback = [[NSBundle mainBundle] bundleIdentifier] ?: @"";
  NSString *resolvedAppId = trimmed.length > 0 ? trimmed : fallback;

  if (resolvedAppId.length == 0) {
    reject(@"CONFIG_ERROR", @"appId is required", nil);
    return;
  }

  [[RNBearoundBridge shared] configure:resolvedAppId
                          syncInterval:syncInterval
               enableBluetoothScanning:enableBluetoothScanning
               enablePeriodicScanning:enablePeriodicScanning];
  resolve(nil);
}

- (void)startScanning:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] startScanning];
  resolve(nil);
}

- (void)stopScanning:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] stopScanning];
  resolve(nil);
}

- (void)isScanning:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  BOOL scanning = [[RNBearoundBridge shared] isScanning];
  resolve(@(scanning));
}

- (void)setBluetoothScanning:(BOOL)enabled
                     resolve:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] setBluetoothScanning:enabled];
  resolve(nil);
}

- (void)setUserProperties:(NSDictionary *)properties
                  resolve:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  NSDictionary *payload = properties ?: @{};
  [[RNBearoundBridge shared] setUserProperties:payload];
  resolve(nil);
}

- (void)clearUserProperties:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] clearUserProperties];
  resolve(nil);
}

- (void)checkPermissions:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject
{
  BOOL granted = [[RNBearoundBridge shared] checkPermissions];
  resolve(@(granted));
}

- (void)requestPermissions:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] requestPermissions:^(BOOL granted) {
    resolve(@(granted));
  }];
}

@end
