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

- (void)initialize:(NSString *)clientToken
             debug:(NSNumber *)debug
           resolve:(RCTPromiseResolveBlock)resolve
            reject:(RCTPromiseRejectBlock)reject
{
  BOOL dbg = debug ? [debug boolValue] : NO;
  [[RNBearoundBridge shared] initialize:clientToken debug:dbg];
  resolve(nil);
}

- (void)stop:(RCTPromiseResolveBlock)resolve
      reject:(RCTPromiseRejectBlock)reject
{
  [[RNBearoundBridge shared] stop];
  resolve(nil);
}

@end
