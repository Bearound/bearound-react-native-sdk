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

- (void)configure:(NSString *)businessToken
    scanPrecision:(NSString *)scanPrecision
maxQueuedPayloads:(double)maxQueuedPayloads
          resolve:(RCTPromiseResolveBlock)resolve
           reject:(RCTPromiseRejectBlock)reject
{
  NSString *token = businessToken ?: @"";
  NSString *trimmed = [token stringByTrimmingCharactersInSet:
                       [NSCharacterSet whitespaceAndNewlineCharacterSet]];

  if (trimmed.length == 0) {
    reject(@"CONFIG_ERROR", @"Business token is required", nil);
    return;
  }

  [[RNBearoundBridge shared] configure:trimmed
                         scanPrecision:scanPrecision ?: @"medium"
                     maxQueuedPayloads:maxQueuedPayloads];
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
