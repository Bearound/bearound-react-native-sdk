/**
 * @fileoverview AppDelegate.swift transformation used by the Bearound Expo config plugin.
 *
 * Kept as a pure string-in/string-out function so it can be unit-tested against the
 * real Expo template AppDelegate without running `expo prebuild`.
 *
 * The Expo AppDelegate is NOT the bare React Native one: it subclasses
 * `ExpoAppDelegate`, which already implements `performFetchWithCompletionHandler`,
 * `handleEventsForBackgroundURLSession`, `didRegisterForRemoteNotificationsWithDeviceToken`,
 * `didFailToRegisterForRemoteNotificationsWithError` and
 * `didReceiveRemoteNotification:fetchCompletionHandler:` and forwards each of them to
 * the Expo module subscribers (expo-notifications, expo-background-task, …). So every
 * method injected here is an `override` that calls `super` — dropping the `super` call
 * silently breaks the other Expo modules in the app.
 */

const START = '// @generated begin bearound - expo config plugin';
const END = '// @generated end bearound';

const IMPORTS = ['BearoundSDK', 'BearoundReactSdk'];

const DID_FINISH_LAUNCHING_BLOCK = `    ${START}
    // CRITICAL — background/terminated relaunch path.
    // When iOS relaunches the app from a beacon-region event, touching
    // BeAroundSDK.shared runs its init, which restores the saved config and
    // RE-ARMS region monitoring synchronously; the region-enter callback then
    // fires asynchronously. The delegate is a runtime object (never persisted),
    // so it MUST be set here — the async JS configure() path is too late and
    // races the relaunch event.
    BeAroundSDK.shared.delegate = RNBearoundBridge.shared

    // Must run before the app finishes launching, or BGTaskScheduler rejects it.
    BeAroundSDK.shared.registerBackgroundTasks()

    // Silent push is the only vector that resurrects a user-force-quit app.
    // Needs the Push Notifications capability (signed aps-environment entitlement).
    application.registerForRemoteNotifications()

    if launchOptions?[.location] != nil {
      NSLog("[Bearound] App launched by a LOCATION event (beacon region entry)")
    }
    if launchOptions?[.bluetoothCentrals] != nil {
      NSLog("[Bearound] App launched by a BLUETOOTH event (state restoration)")
    }
    ${END}
`;

const METHODS_HEADER = `  // MARK: - Bearound background integration
  //
  // Every method below is an override of ExpoAppDelegate and calls super, so the
  // other Expo modules (expo-notifications, expo-background-task, …) keep
  // receiving the same callbacks. Never drop the super call.
`;

/**
 * One entry per injected method. `selector` is what we look for in the host's own
 * code: if the AppDelegate already implements it by hand — or another config
 * plugin injected it — we skip that method instead of emitting a duplicate, which
 * Swift rejects as `invalid redeclaration`.
 */
const METHODS = [
  {
    selector: 'performFetchWithCompletionHandler',
    code: `
  public override func application(
    _ application: UIApplication,
    performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    BeAroundSDK.shared.performBackgroundFetch { success in
      completionHandler(success ? .newData : .noData)
    }
    // Separate no-op handler: the system handler above may only be called once.
    super.application(application, performFetchWithCompletionHandler: { _ in })
  }
`,
  },
  {
    selector: 'didRegisterForRemoteNotificationsWithDeviceToken',
    code: `

  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    // Forward the RAW APNs token. The SDK also swizzles for it, but the swizzle
    // loses to whichever push library installs first (Firebase, expo-notifications).
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    NSLog("[Bearound] APNs token registered (%d bytes)", deviceToken.count)
    BeAroundSDK.shared.setPushToken(token)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }
`,
  },
  {
    selector: 'didFailToRegisterForRemoteNotificationsWithError',
    code: `

  public override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    // Usual cause: no Push Notifications capability / aps-environment entitlement.
    NSLog("[Bearound] APNs registration failed: %@", error.localizedDescription)
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }
`,
  },
  {
    selector: 'didReceiveRemoteNotification',
    code: `

  public override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    // Cold-launch race: the SDK's push swizzle only installs once configure() runs,
    // which in React Native is after JS boots — iOS delivers the launch-triggering
    // push before that. Anything that is not a Bearound wake goes straight to Expo.
    guard userInfo["bearound"] != nil else {
      super.application(
        application,
        didReceiveRemoteNotification: userInfo,
        fetchCompletionHandler: completionHandler
      )
      return
    }
    NSLog("[Bearound] Silent push received — BLE refresh + sync")
    BeAroundSDK.shared.performBackgroundBLERefreshAndSync(
      bleScanDuration: 10,
      trigger: "silent_push"
    ) { success in
      completionHandler(success ? .newData : .noData)
    }
  }
`,
  },
  {
    selector: 'handleEventsForBackgroundURLSession',
    code: `

  public override func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    // iOS relaunches the app to deliver completed uploads. Without this the
    // terminated-state upload finishes in nsurlsessiond and is never finalized.
    guard identifier == BeAroundSDK.backgroundURLSessionIdentifier else {
      super.application(
        application,
        handleEventsForBackgroundURLSession: identifier,
        completionHandler: completionHandler
      )
      return
    }
    NSLog("[Bearound] handleEventsForBackgroundURLSession: %@", identifier)
    BeAroundSDK.shared.handleBackgroundURLSessionEvents(
      identifier: identifier,
      completionHandler: completionHandler
    )
  }
`,
  },
];

/** Removes a previously generated block so the plugin is idempotent. */
function stripGenerated(contents) {
  const lines = contents.split('\n');
  const out = [];
  let skipping = false;
  let dropBlankAfterBlock = false;
  for (const line of lines) {
    if (line.trim() === START) {
      skipping = true;
      // Also drop the blank line the injection added in front of the block, so
      // stripping restores the file byte for byte.
      if (out.length && out[out.length - 1].trim() === '') out.pop();
      continue;
    }
    if (line.trim() === END) {
      skipping = false;
      dropBlankAfterBlock = true;
      continue;
    }
    if (skipping) continue;
    if (dropBlankAfterBlock) {
      dropBlankAfterBlock = false;
      if (line.trim() === '') continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

/**
 * Injects the Bearound wiring into an Expo `AppDelegate.swift`.
 *
 * @param {string} original AppDelegate.swift contents
 * @returns {string} the transformed contents
 * @throws {Error} when the file does not look like the Expo AppDelegate template
 */
function withBearoundAppDelegate(original, onSkip = defaultOnSkip) {
  let contents = stripGenerated(original);
  // Everything the host owns, with our previous output removed. Anything found
  // here was written by the app or by another config plugin, and must not be
  // duplicated: Swift rejects a second declaration outright.
  const hostOwned = contents;

  // 1. Imports — anchored on the last existing import at the top of the file.
  const importLines = contents.split('\n');
  let lastImport = -1;
  for (let i = 0; i < importLines.length; i++) {
    if (/^(internal |public |@preconcurrency )?import /.test(importLines[i])) {
      lastImport = i;
    }
    if (
      /^(@main|@UIApplicationMain|(final )?(open |public )?class )/.test(
        importLines[i]
      )
    ) {
      break;
    }
  }
  if (lastImport === -1) {
    throw new Error(
      '[bearound] no import statement found in AppDelegate.swift'
    );
  }
  const missing = IMPORTS.filter(
    (name) => !new RegExp(`^import ${name}$`, 'm').test(contents)
  );
  importLines.splice(
    lastImport + 1,
    0,
    ...missing.map((name) => `import ${name}`)
  );
  contents = importLines.join('\n');

  // 2. didFinishLaunchingWithOptions — before the React Native bootstrap, so the
  //    SDK is armed before the method returns.
  const bootstrapAnchor =
    /^([ \t]*)let delegate = (?:Expo)?ReactNativeDelegate\(\)/m;
  const bootstrapMatch = contents.match(bootstrapAnchor);
  if (!bootstrapMatch) {
    throw new Error(
      '[bearound] could not find the React Native bootstrap in didFinishLaunchingWithOptions'
    );
  }
  if (hostOwned.includes('BeAroundSDK.shared.registerBackgroundTasks()')) {
    // The app already arms the SDK on launch (hand-wired integration).
    onSkip('didFinishLaunchingWithOptions');
  } else {
    contents = contents.replace(
      bootstrapAnchor,
      `${DID_FINISH_LAUNCHING_BLOCK}\n${bootstrapMatch[0]}`
    );
  }

  // 3. Methods — inserted just before the closing brace of the AppDelegate class,
  //    skipping any the host already implements.
  const methods = METHODS.filter((m) => {
    if (!hostOwned.includes(m.selector)) return true;
    onSkip(m.selector);
    return false;
  });

  if (methods.length) {
    const classIndex = contents.search(
      /^(?:final )?(?:open |public )?class AppDelegate\b/m
    );
    if (classIndex === -1) {
      throw new Error(
        '[bearound] no `class AppDelegate` found in AppDelegate.swift'
      );
    }
    const block = `  ${START}\n${METHODS_HEADER}${methods
      .map((m) => m.code)
      .join('')}  ${END}\n`;
    const closing = findClassClosingBrace(contents, classIndex);
    contents = `${contents.slice(0, closing)}\n${block}${contents.slice(closing)}`;
  }

  return contents;
}

/**
 * Skipping is never silent: a host that already owns one of these keeps its own
 * implementation, and must know the SDK call is now its responsibility.
 */
function defaultOnSkip(what) {
  console.warn(
    `[bearound] AppDelegate.swift already implements \`${what}\` — leaving it alone. ` +
      'Make sure it carries the Bearound call for that method (see the README, ' +
      '"iOS Background Integration"), or background detection degrades silently.'
  );
}

/**
 * Returns the index of the `}` that closes the class starting at `classIndex`,
 * counting braces from the class's opening brace.
 */
function findClassClosingBrace(contents, classIndex) {
  const open = contents.indexOf('{', classIndex);
  if (open === -1) {
    throw new Error(
      '[bearound] malformed AppDelegate.swift: class has no body'
    );
  }
  let depth = 0;
  for (let i = open; i < contents.length; i++) {
    const char = contents[i];
    if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error('[bearound] malformed AppDelegate.swift: unbalanced braces');
}

module.exports = {
  withBearoundAppDelegate,
  stripGenerated,
  METHODS,
  START,
  END,
};
