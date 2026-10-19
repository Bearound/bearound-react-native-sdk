# React Native consumer validation, 2026-10-19

SDK 3.18.0 installs and builds as a real package with React Native 0.79.2 / React 19. The physical iPhone launched the Release app and confirmed native version, configuration, permission query and scanning callbacks. The public JS bridge completed scan start, stop and restart, and an empty-beacon sync completed successfully. Assertions passed against the marker file retrieved from the device.

## Evidence

| Scenario | Result | Evidence |
|---|---|---|
| Independent npm consumer | Passed | SDK JS main, types and native autolink resolve inside consumer node_modules, with no workspace aliases |
| Published native dependencies | Passed | CocoaPods BearoundSDK 3.18.0 after repo update; Android JitPack v3.18.0, mavenLocal removed from consumer |
| iOS physical-destination Release build | Passed | xcodebuild BUILD SUCCEEDED; signing succeeded; Hermes bundle embedded |
| Device install and launch | Passed | devicectl installation and launch; existing example bundle identity retained |
| Native version | Passed | getSdkVersion returned 3.18.0 through installed JS package |
| Configure and scanning callback | Passed | configured marker and scanning true events in artifacts/ios-runtime.log |
| Permissions | Observed | Existing location/background grant; iOS generic permission fields are not independent proof of each Bluetooth capability |
| Stop/restart probe | Passed | Ordered initial, stop and restart confirmations; false/true scanning events; no lifecycle failure/timeout marker |
| Empty-beacon sync | Passed at client boundary | Sync completed callback with success=true and beaconCount=0; backend persistence was not inspected |
| Persisted marker capture | Passed | Retrieved Documents/BeAroundValidation.log and asserted expected markers and lifecycle order |
| Android arm64 Debug | Passed | Gradle BUILD SUCCESSFUL, APK produced, merged BLUETOOTH_SCAN retains neverForLocation |
| SDK baseline | Passed | 194 tests / 7 suites before changes, project typecheck |
| Targeted SDK regressions | Passed | 94 tests / 3 suites after example changes |
| Project and installed consumer typechecks | Passed | yarn typecheck; npm run typecheck in independent consumer |
| Scoped JS lint | Passed | example/src/App.tsx and scripts/validation-lifecycle.js; generator checked with node --check |

## Changes and reasons

- Added a generator that builds and packs the SDK before creating an independent app from the maintained native example. Default Metro and Babel configurations resolve the installed artifact. Local native overrides and mavenLocal are excluded to avoid masking distribution failures.
- Added an explicit --smoke probe that waits for a real scan, then stops and restarts through the public JS bridge. It does not bypass permissions or fabricate detections.
- Fixed the example startup order: configure before permission requests, catch failures in the startup flow, and gate Android 12+ scanning on BLUETOOTH_SCAN rather than location or adapter power alone.
- Added minimal version/state/callback markers. React Native's default Release logging uses unified logging, so the iOS example additionally mirrors only validation markers to stderr and a per-launch local file without replacing the existing logger.
- Updated the AI-agent integration prompt with packed-consumer validation and CocoaPods cache recovery. A first pod install failed against the stale local catalog; pod install --repo-update successfully resolved the published pin. No SDK version pin changed.
- Corrected the README claim that silent push automatically relaunches a user-force-quit app. [Apple's UIApplicationDelegate contract](https://developer.apple.com/documentation/UIKit/UIApplicationDelegate/application(_:didReceiveRemoteNotification:fetchCompletionHandler:)) excludes that automatic launch. System termination and force-quit require different test expectations.

## Limits

The user confirmed there is no compatible beacon available. Beacon detection and beacon-upload delivery remain unverified. This was a reinstall with existing grants, not a clean first-install permission-denial/recovery test. No physical Android, background/terminated wake, APNs end-to-end delivery, backend persistence, battery or ground-truth visit noninferiority result is claimed. The earlier adaptive-sampling physical gate is separate and remains open. This validates the tested React Native version and configuration, not every version allowed by the package peer range. The physical iPhone runs iOS 27.2 beta; compilation used the installed iPhoneOS 26.5 SDK.

Raw device logs and identifiers remain local. Committed evidence includes only test markers and sanitized environment metadata. See e2e/react-native-device-validation.md for reproduction.

The first console session disconnected. After reconnecting, the final build was installed and launched again; both console and persisted markers captured the full cycle. The transport failure was not treated as an SDK pass or crash.

## Completion

3/3 tasks and 4/4 requirement IDs covered by the recorded acceptance scope. The app process was still running when queried after the completed lifecycle. Beacon detection remains explicitly unverified because no compatible beacon was available.

Profile: fast. Executed: installed-consumer preparation, SDK targeted tests, native iOS/Android builds, physical iOS feature E2E, project/consumer typechecks and scoped JS lint. Skipped: wave gates, full post-change suite, full-project lint, full E2E regression and formal review. Review skipped (profile fast); run /review to audit. The 194-test full suite was the baseline; the post-change focused run covered 94 tests.

Commit: c78a95e introduced the test host and integration fixes; the subsequent evidence commit records the completed physical cycle. No deploy, package publication or main push occurred.
