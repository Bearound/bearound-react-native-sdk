#import "BearoundReactSdkEventEmitter.h"

static __weak BearoundReactSdkEventEmitter *sharedEmitter = nil;

@implementation BearoundReactSdkEventEmitter

RCT_EXPORT_MODULE(BearoundReactSdkEventEmitter)

+ (void)emit:(NSString *)name body:(id)body
{
  if (sharedEmitter == nil) {
    return;
  }
  [sharedEmitter sendEventWithName:name body:body];
}

- (instancetype)init
{
  self = [super init];
  if (self) {
    sharedEmitter = self;
  }
  return self;
}

- (NSArray<NSString *> *)supportedEvents
{
  return @[
    @"bearound:beacons",
    @"bearound:sync",
    @"bearound:scanning",
    @"bearound:error"
  ];
}

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

@end
