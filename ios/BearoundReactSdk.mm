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
                         scanPrecision:scanPrecision ?: @"high"
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

- (void)checkNotificationPermission:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] checkNotificationPermission:^(BOOL granted) {
    resolve(@(granted));
  }];
}

- (void)getSdkVersion:(RCTPromiseResolveBlock)resolve
               reject:(RCTPromiseRejectBlock)reject
{
  resolve([[RNBearoundBridge shared] getSdkVersion]);
}

- (void)getCurrentScanPrecision:(RCTPromiseResolveBlock)resolve
                         reject:(RCTPromiseRejectBlock)reject
{
  resolve([[RNBearoundBridge shared] getCurrentScanPrecision]);
}

- (void)getBleDiagnosticInfo:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  resolve([[RNBearoundBridge shared] getBleDiagnosticInfo]);
}

- (void)getPendingBatchCount:(RCTPromiseResolveBlock)resolve
                      reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[RNBearoundBridge shared] getPendingBatchCount]));
}

- (void)isConfigured:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[RNBearoundBridge shared] isConfigured]));
}

- (void)isLocationAvailable:(RCTPromiseResolveBlock)resolve
                     reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[RNBearoundBridge shared] isLocationAvailable]));
}

- (void)getAuthorizationStatus:(RCTPromiseResolveBlock)resolve
                        reject:(RCTPromiseRejectBlock)reject
{
  resolve([[RNBearoundBridge shared] getAuthorizationStatus]);
}

- (void)getBluetoothState:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  resolve([[RNBearoundBridge shared] getBluetoothState]);
}

- (void)getPersistedLog:(RCTPromiseResolveBlock)resolve
                 reject:(RCTPromiseRejectBlock)reject
{
  resolve([[RNBearoundBridge shared] getPersistedLog]);
}

- (void)clearPersistedLog:(RCTPromiseResolveBlock)resolve
                   reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] clearPersistedLog];
  resolve(nil);
}

- (void)requestLocationAuthorization:(NSString *)level
                             resolve:(RCTPromiseResolveBlock)resolve
                              reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] requestLocationAuthorization:level ?: @"always"];
  resolve(nil);
}

- (void)enableForegroundScanning:(NSDictionary *)config
                         resolve:(RCTPromiseResolveBlock)resolve
                          reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] enableForegroundScanning:config ?: @{}];
  resolve(nil);
}

- (void)disableForegroundScanning:(RCTPromiseResolveBlock)resolve
                           reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] disableForegroundScanning];
  resolve(nil);
}

- (void)isForegroundScanningEnabled:(RCTPromiseResolveBlock)resolve
                             reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[RNBearoundBridge shared] isForegroundScanningEnabled]));
}

- (void)setForegroundNotificationContent:(NSDictionary *)content
                                 resolve:(RCTPromiseResolveBlock)resolve
                                  reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] setForegroundNotificationContent:content ?: @{}];
  resolve(nil);
}

// Forwards the device push token (raw APNs on iOS) to the native SDK, which
// associates it with the deviceId and sends it on the next sync. Declared in
// the codegen spec and implemented by RNBearoundBridge, but the TurboModule
// bridge method was missing — calling it on iOS raised an unrecognized-selector
// crash, breaking the manual-APNs-token path (needed when Firebase intercepts
// the swizzle). See RNBearoundBridge.setPushToken.
- (void)setPushToken:(NSString *)token
             resolve:(RCTPromiseResolveBlock)resolve
              reject:(RCTPromiseRejectBlock)reject
{
  NSString *value = token ?: @"";
  if (value.length == 0) {
    reject(@"INVALID_ARGUMENT", @"token is required", nil);
    return;
  }
  [[RNBearoundBridge shared] setPushToken:value];
  resolve(nil);
}

- (void)isIgnoringBatteryOptimizations:(RCTPromiseResolveBlock)resolve
                                reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[RNBearoundBridge shared] isIgnoringBatteryOptimizations]));
}

- (void)openBatteryOptimizationSettings:(RCTPromiseResolveBlock)resolve
                                 reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[RNBearoundBridge shared] openBatteryOptimizationSettings]));
}

- (void)isAutostartManageable:(RCTPromiseResolveBlock)resolve
                       reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[RNBearoundBridge shared] isAutostartManageable]));
}

- (void)openManufacturerAutostartSettings:(RCTPromiseResolveBlock)resolve
                                   reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([[RNBearoundBridge shared] openManufacturerAutostartSettings]));
}

@end
