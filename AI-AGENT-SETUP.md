# Bearound React Native — AI agent setup prompt

Hover the block below and click the **copy icon** in its top-right corner to copy
the prompt, then paste it into your AI coding agent (Claude Code, Cursor, Copilot, …)
with your app's repo open. The agent reads the [SDK README](./README.md) and wires
the full iOS/Android background integration.

```text
Integrate @bearound/react-native-sdk into this React Native app. First READ the
SDK's README end to end — especially "iOS Background Integration (required)",
"Permission Configuration", and "Quick Start" — then do ALL of the following,
matching the README's proven-working example EXACTLY:

1. Install: `npm i @bearound/react-native-sdk`, then `cd ios && pod install`.

2. iOS AppDelegate (§1): wire the COMPLETE AppDelegate from README §1 into this
   app's AppDelegate — EVERY method, none optional: the SDK delegate,
   registerBackgroundTasks, the UNUserNotificationCenter delegate +
   requestAuthorization, application.registerForRemoteNotifications(),
   launchOptions handling, performFetch,
   didRegisterForRemoteNotificationsWithDeviceToken -> setPushToken,
   didFailToRegister, the `bearound` silent-push handler,
   handleEventsForBackgroundURLSession, and willPresent. Use THIS app's own
   registered module name in startReactNative (do NOT leave the placeholder).
   If the app still ships the Objective-C AppDelegate.mm, port the same calls there.

3. iOS Info.plist: add the five UIBackgroundModes, the two
   BGTaskSchedulerPermittedIdentifiers (io.bearound.sdk.sync,
   io.bearound.sdk.processing), and the four NS…UsageDescription strings — write
   a user-facing rationale that matches what THIS app actually does (no internal
   jargon). Then run `plutil -lint` and confirm it prints OK.

4. JS (§4 / Quick Start): call configure({ businessToken: <ASK ME FOR IT> }) on
   root-component mount (useEffect), then startScanning(); on Android also call
   enableForegroundScanning() after startScanning().

5. Verify (§6): run the plutil checks and give me the 3-state field-test checklist
   (foreground / background / terminated).

Guardrails — follow strictly:
- NEVER rely on the push swizzle alone; forward the RAW APNs token explicitly.
- The SDK must NEVER crash the host app.
- Ask me for my businessToken; do not invent one.
- STOP and hand me click-by-click steps for anything only a human can do: the
  Xcode Push Notifications capability with my provisioning profile, on-device
  permission grants (Always location + Background App Refresh), and the Google
  Play foreground-service declaration. Do not attempt those yourself.
```

Web-capable agents can fetch this prompt directly from its raw URL:
`https://raw.githubusercontent.com/Bearound/bearound-react-native-sdk/main/AI-AGENT-SETUP.md`
