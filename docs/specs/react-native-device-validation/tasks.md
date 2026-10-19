## Implementation Plan: React Native device validation
**Spec:** docs/specs/react-native-device-validation/
**Date:** 2026-10-19

### Reuse analysis
| What | Source | Action |
|---|---|---|
| Diagnostic app | example/src/App.tsx | adapt |
| Native host | example/ios/Podfile | reuse |
| Consumer resolution | example/metro.config.js, example/react-native.config.js | avoid workspace aliases in generated consumer |
| AI integration | AI-AGENT-SETUP.md | adapt |
| Regression checks | src/__tests__/sdk.test.ts, src/__tests__/listeners.test.ts, src/__tests__/permissions.test.ts | reuse |

### Tasks

### Wave 1
- [x] F1-01: Prepare installed-package consumer
  - req: REQ-001
  - layer: tooling
  - deps: none
  - writes: `scripts/create-validation-app.mjs`, `scripts/validation-lifecycle.js`, `example/README.md`
  - reuse: `example/metro.config.js`, `example/react-native.config.js`, `example/package.json`
  - design: "Component design", "Data models and interfaces"
  - contracts: packed SDK consumer
  - tests: integration: archive resolution, native autolinking, unsafe destination rejection
  - validate: `node scripts/create-validation-app.mjs --help`; run isolated consumer preparation and inspect resolved SDK paths
  - cost: m
  - kind: required

### Wave 2
- [x] F2-01: Expose diagnostics and audit setup guidance
  - req: REQ-003, REQ-004
  - layer: frontend
  - deps: F1-01
  - writes: `example/src/App.tsx`, `example/ios/BearoundReactSdkExample/AppDelegate.swift`, `README.md`, `AI-AGENT-SETUP.md`, `example/README.md`
  - reuse: `example/src/App.tsx`, `src/__tests__/sdk.test.ts`, `src/__tests__/listeners.test.ts`, `src/__tests__/permissions.test.ts`
  - design: "Component design", "Integration guidance", "Error handling"
  - contracts: existing SDK exports
  - tests: regression: listener lifecycle, permissions, scan errors; inspect guidance against consumer
  - validate: `yarn test --runInBand src/__tests__/sdk.test.ts src/__tests__/listeners.test.ts src/__tests__/permissions.test.ts`; `yarn typecheck`; `yarn check:versions`
  - cost: m
  - kind: required

### Wave 3
- [x] F3-01: Validate installed consumer on physical iPhone
  - req: REQ-001, REQ-002, REQ-003, REQ-004
  - layer: e2e
  - deps: F2-01
  - writes: `docs/specs/react-native-device-validation/validation.md`, `docs/specs/react-native-device-validation/artifacts/`, `e2e/react-native-device-validation.md`, `AI-AGENT-SETUP.md`, `example/README.md`
  - reuse: `example/ios/BearoundReactSdkExample.xcodeproj/xcshareddata/xcschemes/BearoundReactSdkExample.xcscheme`, `example/src/App.tsx`
  - design: "Test strategy", "Integration guidance", "Error handling"
  - contracts: physical consumer evidence
  - tests: device E2E: configure, permissions, start, callbacks, stop, crash-free launch; explicit coverage gaps
  - validate: physical-destination xcodebuild for BearoundReactSdkExample; device install/launch; inspect runtime and docs/specs/react-native-device-validation/validation.md scenario evidence
  - cost: l
  - kind: required
