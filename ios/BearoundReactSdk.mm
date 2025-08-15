#import "BearoundReactSdk.h"
#import "BearoundReactSdk-Swift.h"

@implementation BearoundReactSdk {
  BOOL _hasListeners;
}

RCT_EXPORT_MODULE();

- (NSArray<NSString *> *)supportedEvents {
  return @[ @"bearound:beacon", @"bearound:stopped" ];
}

- (void)startObserving {
  _hasListeners = YES;
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(onBeacon:)
                                               name:@"bearound:beacon"
                                             object:nil];
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(onStopped)
                                               name:@"bearound:stopped"
                                             object:nil];
}

- (void)stopObserving {
  _hasListeners = NO;
  [[NSNotificationCenter defaultCenter] removeObserver:self name:@"bearound:beacon" object:nil];
  [[NSNotificationCenter defaultCenter] removeObserver:self name:@"bearound:stopped" object:nil];
}

RCT_EXPORT_METHOD(addListener:(NSString *)eventName) {
  [super addListener:eventName];
}

RCT_EXPORT_METHOD(removeListeners:(double)count) {
  [super removeListeners:(NSUInteger)count];
}

- (void)onBeacon:(NSNotification *)note {
  if (!_hasListeners) { NSLog(@"[RN ObjC] onBeacon: no listeners, dropping"); return; }
  dispatch_async(dispatch_get_main_queue(), ^{
    id body = note.userInfo[@"beacon"] ?: note.userInfo ?: @{};
    [self sendEventWithName:@"bearound:beacon" body:body];
  });
}

- (void)onStopped {
  if (!_hasListeners) { NSLog(@"[RN ObjC] onStopped: no listeners, dropping"); return; }
    dispatch_async(dispatch_get_main_queue(), ^{
      [self sendEventWithName:@"bearound:stopped" body:@{}];
    });
}

#pragma mark
- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
(const facebook::react::ObjCTurboModule::InitParams &)params {
  return std::make_shared<facebook::react::NativeBearoundReactSdkSpecJSI>(params);
}

#pragma mark

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
