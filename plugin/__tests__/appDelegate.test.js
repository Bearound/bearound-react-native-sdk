/**
 * The fixtures are the verbatim `AppDelegate.swift` files from
 * `expo-template-bare-minimum` — what `expo prebuild` actually generates, one per
 * supported Expo SDK.
 */
const fs = require('fs');
const path = require('path');

const { withBearoundAppDelegate } = require('../appDelegate');

const readFixture = (sdk) =>
  fs.readFileSync(
    path.join(__dirname, '__fixtures__', `ExpoAppDelegate.sdk${sdk}.swift`),
    'utf8'
  );

const SUPPORTED_SDKS = [53, 54, 55, 56, 57];

// The detailed assertions run against the newest template; every supported SDK
// gets the structural pass below.
const FIXTURE = readFixture(57);

const countOf = (haystack, needle) => haystack.split(needle).length - 1;

describe('withBearoundAppDelegate', () => {
  const output = withBearoundAppDelegate(FIXTURE);

  it('imports both Bearound modules exactly once', () => {
    expect(countOf(output, '\nimport BearoundSDK')).toBe(1);
    expect(countOf(output, '\nimport BearoundReactSdk')).toBe(1);
  });

  it('arms the SDK before the React Native bootstrap', () => {
    const sdk = output.indexOf(
      'BeAroundSDK.shared.delegate = RNBearoundBridge.shared'
    );
    const bootstrap = output.indexOf('let delegate = ReactNativeDelegate()');
    expect(sdk).toBeGreaterThan(-1);
    expect(sdk).toBeLessThan(bootstrap);
  });

  it('registers background tasks and remote notifications on launch', () => {
    expect(output).toContain('BeAroundSDK.shared.registerBackgroundTasks()');
    expect(output).toContain('application.registerForRemoteNotifications()');
  });

  it('overrides every ExpoAppDelegate method it touches', () => {
    for (const method of [
      'performFetchWithCompletionHandler completionHandler',
      'didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data',
      'didFailToRegisterForRemoteNotificationsWithError error: Error',
      'didReceiveRemoteNotification userInfo',
      'handleEventsForBackgroundURLSession identifier: String',
    ]) {
      const index = output.indexOf(method);
      expect(index).toBeGreaterThan(-1);
      // The `public override func application(` opening the method it belongs to.
      expect(
        output.lastIndexOf('public override func application(', index)
      ).toBeGreaterThan(-1);
    }
  });

  it('always calls super, so the other Expo modules keep their callbacks', () => {
    // One super call per injected override (didReceiveRemoteNotification and
    // handleEventsForBackgroundURLSession call it in their non-Bearound branch).
    expect(countOf(output, 'super.application(')).toBe(
      countOf(FIXTURE, 'super.application(') + 5
    );
  });

  it('does not hand the system fetch handler to super twice', () => {
    expect(output).toContain(
      'super.application(application, performFetchWithCompletionHandler: { _ in })'
    );
  });

  it('only claims the background URLSession the SDK owns', () => {
    expect(output).toContain(
      'guard identifier == BeAroundSDK.backgroundURLSessionIdentifier else {'
    );
  });

  it('leaves non-Bearound silent pushes to Expo', () => {
    expect(output).toContain('guard userInfo["bearound"] != nil else {');
  });

  it('never touches the UNUserNotificationCenter delegate', () => {
    // expo-notifications owns it; reassigning it steals the host app's push routing.
    expect(output).not.toContain('UNUserNotificationCenter.current().delegate');
  });

  it('keeps the app-owned code intact', () => {
    expect(output).toContain(
      'RCTLinkingManager.application(app, open: url, options: options)'
    );
    expect(output).toContain(
      'class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {'
    );
    expect(output).toContain('withModuleName: "main"');
  });

  it('closes the class body it injected into', () => {
    const braces = countOf(output, '{') - countOf(output, '}');
    expect(braces).toBe(countOf(FIXTURE, '{') - countOf(FIXTURE, '}'));
  });

  it('is idempotent — a second prebuild does not duplicate the block', () => {
    expect(withBearoundAppDelegate(output)).toBe(output);
  });

  it('fails loudly on an AppDelegate it does not recognise', () => {
    expect(() =>
      withBearoundAppDelegate('import UIKit\n\nclass Other {}\n')
    ).toThrow(/React Native bootstrap/);
  });

  it.each(SUPPORTED_SDKS)('handles the Expo SDK %s template', (sdk) => {
    const source = readFixture(sdk);
    const result = withBearoundAppDelegate(source);

    expect(countOf(result, '\nimport BearoundSDK')).toBe(1);
    expect(result).toContain('BeAroundSDK.shared.registerBackgroundTasks()');
    expect(countOf(result, '@generated begin')).toBe(2);
    expect(countOf(result, '{') - countOf(result, '}')).toBe(
      countOf(source, '{') - countOf(source, '}')
    );
    expect(withBearoundAppDelegate(result)).toBe(result);
  });
});
