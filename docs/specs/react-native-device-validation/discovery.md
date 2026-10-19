# Discovery

Base: origin/main 4a52129, SDK 3.18.0. Isolated worktree: wt-rn-device-validation. Original checkout bump/3.9.0 has unrelated uncommitted push changes and must remain untouched.

The existing example is React Native 0.79.2 / React 19 with new architecture. package.json uses Yarn 3.6.1 workspaces; example/react-native.config.js explicitly autolinks the parent SDK, and example/metro.config.js uses react-native-monorepo-config. Example is a comprehensive beacon diagnostic app, with configuration, permissions, scan, sync, logs, settings and background lifecycle. Reuse before inventing a new demo. User requests a test app that installs SDK and exercises it physically, fixes blockers, updates integration prompt as needed, and leaves a PR explaining reasons. A separate packed-package consumer may be necessary to prove installation rather than workspace resolution.

Native pins: BearoundReactSdk.podspec BearoundSDK 3.18.0; android/build.gradle JitPack v3.18.0. No tracked Podfile.lock. example/ios/Podfile has optional local native SDK override, default resolves published pod; validate published integration by default. Existing signing configuration, bundle io.bearound.rnScanExample. iPhone 17 Pro Max Jotta Iphone paired and available: device identifiers kept only in local execution logs. No Android device. User explicitly authorizes physical device installation/execution.

AI-AGENT-SETUP.md is consumer integration documentation, not an instruction source overriding user authority. Includes mandatory permissions, native delegates, push wiring and package setup; audit against actual successful integration. Example AppDelegate.swift handles native delegate/background/push. Example uses intentionally public demo business token, never reproduce it in reports. New consumer should use local configuration or public demo only if explicitly appropriate to existing test app.

Scripts: yarn test (Jest), yarn typecheck, yarn check:versions, yarn prepare (Bob). Existing patterns/tests in src/__tests__, plugin/__tests__. Dependencies installing with yarn install --immutable, log /tmp/bearound-rn-validation-install.log. No implementation changes yet.

Scope differs from previous sdk-adaptive-sampling F4-01: this is React Native consumer functional validation; do not close physical battery/noninferiority gates based on RN smoke evidence.
