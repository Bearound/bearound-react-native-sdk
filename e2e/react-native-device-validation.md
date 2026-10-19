# React Native installed-package device regression

This native flow uses device tooling, not Playwright: there is no browser runtime.

1. Start from a clean SDK checkout, install its locked dependencies, then run:
   `node scripts/create-validation-app.mjs /absolute/new/app --smoke`.
2. In that independent app run `npm install`. Confirm `require.resolve('@bearound/react-native-sdk')` and `npx react-native config` resolve the SDK from its own node_modules. Record the archive SHA-256 and SDK / React / React Native versions.
3. Run `pod install --repo-update` in ios. Confirm BearoundSDK resolves from the published source, without BEAROUND_LOCAL_PODS or mavenLocal substitutions.
4. Build the physical destination using the BearoundReactSdkExample scheme and Release configuration. Install the resulting app, launch it with console capture, and keep the iPhone unlocked during permission prompts. Release embeds JavaScript, so Metro is not a runtime dependency.
5. The iOS example mirrors only `[BearoundValidation]` markers into stderr and `Documents/BeAroundValidation.log` (reset at each launch). If the console connection drops, retrieve that file with `xcrun devicectl device copy from --device <device> --domain-type appDataContainer --domain-identifier io.bearound.rnScanExample --source Documents/BeAroundValidation.log --destination /tmp/BeAroundValidation.log`. Check the lines: native version, configured, permissions, scanning true, lifecycle initial scan, lifecycle stop, lifecycle restart. A native error, timeout or missing lifecycle confirmation fails that scenario.
6. With a compatible beacon nearby, require a nonzero beacon callback. Record sync completion separately from beacon detection. Backend persistence requires independent server evidence.
7. Test permission denial and recovery separately: deny scan prerequisites, confirm the app remains usable, grant in Settings, then retry Start. On Android 12+, location alone must not bypass denied BLUETOOTH_SCAN.
8. Background and reopen the app, checking persisted native events. System-terminated wake requires its own observed relaunch. User force-quit is a different state and background push does not automatically relaunch it.
9. Record measured scenarios and unverified gaps. An iOS foreground pass does not validate Android, background, push, server persistence or battery noninferiority.

The generated app intentionally uses the existing example host and public demo tenant. It shares the example bundle identity and can replace an installed example app, retaining its permissions and data. Record whether the run was a reinstall or a clean first install. Use a different bundle identifier and provisioning profile when existing example data must be isolated.
