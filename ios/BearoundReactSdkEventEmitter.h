#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface BearoundReactSdkEventEmitter : RCTEventEmitter <RCTBridgeModule>
+ (void)emit:(NSString *)name body:(id)body;
@end
