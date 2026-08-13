# Bearound React Native — AI agent setup prompt

Hover the block below and click the **copy icon** in its top-right corner to copy
the prompt, then paste it into your AI coding agent (Claude Code, Cursor, Copilot, …)
with your app's repo open. The agent reads the [SDK README](./README.md) and wires
the full iOS/Android background integration.

```text
Integrate @bearound/react-native-sdk into this React Native app. First READ the
SDK's README end to end — especially "Expo", "iOS Background Integration (required)",
"Permission Configuration", "Quick Start", and "Set up with an AI agent" — then do
ALL of the following. Follow the README's Quick Start and §1-§6; where a step below
is more specific, it wins.

0. FIRST decide which app this is, because it changes steps 1-3 completely:
   - EXPO with managed native folders (CNG): `expo` is a dependency AND there is an
     app.json / app.config.js with an `expo` key AND `ios/`+`android/` are absent or
     gitignored. Then FOLLOW THE "EXPO ROUTE" BELOW and do NOT hand-edit AppDelegate
     or Info.plist — `expo prebuild` regenerates them and your edits vanish silently,
     taking background detection with them.
   - BARE React Native, or an Expo app that committed `ios/`+`android/` and no longer
     prebuilds: use steps 1-3 as written.

EXPO ROUTE (replaces steps 1, 2 and 3):
   a. `npx expo install @bearound/react-native-sdk`.
   b. Add the config plugin to the `plugins` array in app.json / app.config.js:
      ["@bearound/react-native-sdk", { "usageDescriptions": { ... } }] — write the
      NS…UsageDescription copy to match what THIS app actually does, in the user's
      language, no internal jargon. Add "trackingUsageDescription" too, or iOS never
      shows the App Tracking Transparency prompt and the advertising identifier is
      silently absent. It applies the five UIBackgroundModes, both
      BGTaskSchedulerPermittedIdentifiers, the entitlements (aps-environment +
      Access WiFi Information) and the AppDelegate wiring on every prebuild.
   c. Run `npx expo prebuild --clean`, then VERIFY: `plutil -p ios/*/Info.plist`
      shows all five modes + both BGTask ids, and
      `grep -c "@generated begin bearound" ios/*/AppDelegate.swift` prints 2.
   d. Do NOT reassign the UNUserNotificationCenter delegate anywhere: expo-notifications
      owns it. The plugin leaves every notification concern to the app on purpose — the
      SDK never posts notifications and detection does not go through them — but the
      3-state field test uses a local notification as its ONLY proof that the app woke
      up in background. So if the app has no notification stack yet, TELL ME, and wire
      expo-notifications: requestPermissionsAsync() + setNotificationHandler() (banner in
      foreground). Without it background detection can be working and be invisible.
   e. Expo Go CANNOT run this SDK (native code). The app must run as a development
      build — `npx expo run:ios` / `run:android` or EAS Build. Say so explicitly if
      the project is currently Expo-Go-only.
   f. Then continue at step 4 (JS wiring), step 5 (Android push, if applicable) and
      step 6 (verification, adapted: build with `npx expo run:ios` / `run:android`).

1. Install: `npm i @bearound/react-native-sdk`, then `cd ios && pod install`. If this
   app's Podfile uses `use_frameworks!`, set `use_frameworks! :linkage => :static`
   before running pod install.

2. iOS AppDelegate (§1) — the AppDelegate MUST be Swift: BeAroundSDK is pure, non-@objc
   Swift, unreachable from Objective-C, so NEVER wire BeAround calls into an
   AppDelegate.mm. MERGE into the existing AppDelegate, do NOT overwrite it. First check
   the RN version, then PERFORM the right conversion yourself — this is the standard RN
   Swift-AppDelegate migration and IS your job, do not hand it back:
   - RN >= 0.77 (already Swift, symbols RCTReactNativeFactory / ReactNativeDelegate /
     RCTAppDependencyProvider): use the §1 template as-is.
   - RN 0.73-0.76 (ships AppDelegate.mm / subclasses RCTAppDelegate): convert the target
     to a Swift AppDelegate that SUBCLASSES RCTAppDelegate and carries the SAME BeAround
     calls — delete the .mm/.h, add a `<App>-Bridging-Header.h` importing RN's ObjC
     headers, set SWIFT_OBJC_BRIDGING_HEADER. Do NOT paste the RCTReactNativeFactory
     symbols here (they don't exist pre-0.77). Only STOP and hand ME click-by-click steps
     if the existing .mm has heavy custom native wiring (other SDKs' delegate setup) you
     can't safely port.
   Wire EVERY §1 method — none optional: the SDK delegate (RNBearoundBridge.shared),
   registerBackgroundTasks, requestAuthorization, application.registerForRemoteNotifications(),
   launchOptions handling, performFetch, didRegisterForRemoteNotificationsWithDeviceToken ->
   setPushToken, didFailToRegister, the `bearound` silent-push handler,
   handleEventsForBackgroundURLSession, and willPresent — while PRESERVING all existing
   app/Firebase/other-native-module code. For EVERY method the target already implements
   (didFinishLaunching, willPresent, performFetch, didReceiveRemoteNotification,
   didRegister/didFailToRegister, handleEventsForBackgroundURLSession), ADD the BeAround
   call INSIDE it — fold the `userInfo["bearound"]` guard into the existing push handler —
   NEVER declare a duplicate. Set `UNUserNotificationCenter.current().delegate = self`
   ONLY if nothing else owns it; if the host or Firebase/notifee already assigns the
   notification-center delegate, inject BeAround's willPresent / didReceiveNotification
   logic into THAT existing delegate object instead — reassigning silently STEALS the
   host's push and foreground-notification routing. Replace the file wholesale only for a
   stock, unmodified AppDelegate. Use THIS app's own registered module name in
   startReactNative (do NOT leave the placeholder).

3. iOS Info.plist: add the five UIBackgroundModes (fetch, location, processing,
   bluetooth-central, remote-notification), the two BGTaskSchedulerPermittedIdentifiers
   (io.bearound.sdk.sync, io.bearound.sdk.processing), and the NS…UsageDescription
   strings — write a user-facing rationale that matches what THIS app actually does (no
   internal jargon). Then run `plutil -lint` and confirm OK.
   Include NSUserTrackingUsageDescription: without that key iOS never shows the App
   Tracking Transparency prompt, so the SDK reports no advertising identifier — and
   nothing errors, the field is simply never there.

4. JS — configure, THEN request permissions, THEN scan (order matters; follow the
   README Quick Start): on root-component mount call
   `configure({ businessToken: <ASK ME FOR IT> })`. Then request permissions BEFORE
   scanning: `const status = await ensurePermissions({ askBackground: false })` and,
   on iOS, `await requestLocationAuthorization('always')` so CoreLocation region
   monitoring can arm (without Always, background/terminated wake is dead). Gate
   startScanning on the platform result — Android 12+: status.btScan; Android <=11:
   status.fineLocation; iOS: proceed. Only THEN `await startScanning()`. On Android,
   do NOT hard-code enableForegroundScanning() — ASK ME which scan mode to use: the
   foreground-service mode (reliable background, survives OEM kills, but requires a
   Google Play connectedDevice declaration + demo video) or the opportunistic default
   (no Play video, lower battery). Call `await enableForegroundScanning()` ONLY if I
   choose the foreground service; if I do, also on Android 13+ read status.notifications
   and, if false, prompt me to enable notifications so the foreground-service
   notification is visible. Do NOT call startScanning unconditionally and do NOT skip
   ensurePermissions — without it, iOS is foreground-only and Android 12+ detects
   NOTHING.

5. Silent-push wake-up on Android (OPTIONAL — do this ONLY if the backend wakes the
   device by push; skip it otherwise). If the app uses `@react-native-firebase/messaging`,
   register at module scope (before `AppRegistry.registerComponent`)
   `messaging().setBackgroundMessageHandler(async (msg) => { await handleRemoteMessage(msg.data); })`
   and import `handleRemoteMessage` from `@bearound/react-native-sdk` — it resolves `true`
   for a Bearound wake (payload marked `bearound`) and `false` for third-party pushes, so
   forward EVERY data message and pass the non-Bearound ones through to your own handling.
   iOS needs none of this here — the step-2 AppDelegate already covers it via the same
   silent-push path. If the app does NOT use @react-native-firebase but DOES bundle native
   Firebase (google-services plugin configured), instead register
   `io.bearound.sdk.push.BearoundMessagingService` in the app's AndroidManifest.xml — the
   class ships inside the native Android SDK the wrapper embeds. With no Firebase in the
   app at all there is nothing to wire: FCM does the delivering, so push wake-up is
   inapplicable.

6. Verify: run `plutil -lint` / `plutil -p` (all five modes + both BGTask ids), and in
   code confirm the JS actually wires ensurePermissions() /
   requestLocationAuthorization('always') and gates startScanning() on the grant. Then
   BUILD iOS and confirm it COMPILES —
   `cd ios && xcodebuild -workspace <app>.xcworkspace -scheme <app> -sdk iphonesimulator build`
   (or build in Xcode); plutil passing is NOT proof the Swift compiles. BUILD Android too
   — `cd android && ./gradlew assembleDebug` — then confirm the MERGED manifest
   (app/build/…/merged_manifests/…/AndroidManifest.xml) still carries `BLUETOOTH_SCAN`
   with `neverForLocation`; if the flag was dropped, a host redeclaration is missing it
   (fix per §Permission Configuration). Also confirm the target `.entitlements` declares
   `aps-environment` AND `CODE_SIGN_ENTITLEMENTS` points at it in BOTH the Debug AND
   Release configs; if not, explicitly report "terminated-state silent-push wake is NOT
   wired yet — needs §3 (human)". Background and terminated detection stay UNVERIFIED
   until the human runs the on-device 3-state field test — do NOT report terminated-state
   support as done from a foreground run.

Guardrails — follow strictly:
- NEVER rely on the push swizzle alone; forward the RAW APNs token explicitly.
- NEVER reassign the UNUserNotificationCenter delegate if the host/Firebase/notifee
  already owns it — inject BeAround's logic into the existing delegate instead.
- The SDK must NEVER crash the host app.
- Ask me for my businessToken; do not invent one, and never reuse any token from
  the SDK's example app.
- STOP and hand me click-by-click steps for anything only a human can do: the Xcode
  Push Notifications capability with my provisioning profile — set aps-environment to
  `development` for Debug and `production` for Release (a Release/TestFlight build
  left on development silently fails the silent-push wake in production), with
  CODE_SIGN_ENTITLEMENTS pointing at the .entitlements in BOTH build configs; the
  Access WiFi Information capability, which is what lets the SDK report the connected
  Wi-Fi access point (without it iOS returns nothing, with no error — everything else
  keeps working); the on-device permission grants (Always location + Background App
  Refresh); and the Google Play connectedDevice foreground-service declaration + demo
  video. Do not attempt those yourself.
  On the EXPO ROUTE the first two are already written by the config plugin — what
  remains human-only there is the APNs push key (`eas credentials`, which also syncs
  the capabilities to the App ID), the on-device grants, and the Play declaration.
- Wi-Fi collection itself is ON BY DEFAULT and costs nothing extra — no Play policy
  review, no demonstration video. Keep it: ensurePermissions() already asks for
  NEARBY_WIFI_DEVICES on Android 13+ inside the same "Nearby devices" group as
  Bluetooth (usually no second dialog), and on iOS the Access WiFi Information
  capability is one checkbox (automatic via the Expo plugin). Do not disable it and do
  not treat it as a costly permission.
- What DOES cost something is keeping Wi-Fi alive in the BACKGROUND, and its absence is
  INVISIBLE — the system returns empty instead of an error. Android: without
  ACCESS_BACKGROUND_LOCATION a backgrounded app gets an empty scan list and the
  placeholder BSSID 02:00:00:00:00:00, so wifis[] arrives empty (measured: 25 access
  points to zero the instant the app was backgrounded); that permission is the one that
  carries the Google Play policy review plus demo video. iOS: .whenInUse stops revealing
  the access point in the background, .always keeps it. Neither is needed for beacon
  detection. So ASK ME whether background Wi-Fi matters for this app. If yes, declare
  ACCESS_BACKGROUND_LOCATION (Expo: the plugin's "backgroundWifi": true; bare: the app
  manifest — the SDK does not declare it) and call requestBackgroundLocation() AFTER
  foreground location is granted (Android 11+ refuses both in one dialog), and use
  .always on iOS. If no, leave it out — valid choice, just not a silent one. Verify
  either way in the payload: device.permissions.backgroundLocation.
```

Web-capable agents can fetch this prompt directly from its raw URL:
`https://raw.githubusercontent.com/Bearound/bearound-react-native-sdk/main/AI-AGENT-SETUP.md`
