# React Native device validation design

## Component design
REQ-001: Reuse the existing example app, not a second independently maintained UI. Add a preparation script that packs the current SDK and copies the example into a temporary directory outside the repository. Remove workspace-only resolution from the generated consumer: use ordinary React Native Metro defaults and dependency autolinking from its installed archive. Preserve generated artifacts outside Git. Record the archive checksum and actual JS/native resolved paths. Packaging must build distributable JS/types before packing.

REQ-002: Install consumer dependencies and CocoaPods, resolving the published native SDK by default rather than a local native override. Build the existing scheme with physical-device destination and signing. Install and launch through available Apple device tooling; record actual app identity and runtime diagnostics. Use the authorized connected iPhone; discovery contains its identifiers. Do not infer device success from a simulator build.

REQ-003: Reuse example/src/App.tsx listeners, version/permission queries, scan controls and log UI. Make minimal diagnostic changes only when existing evidence is insufficient. Configure before permissions and scanning, retain subscriptions until cleanup, display errors and do not swallow scan failures. Capture actual version response, permission state, scanning event and start/stop results. Beacon callbacks prove detection only when nonempty real observations occur. Backgrounding, terminated launch and server delivery each require independent evidence.

## API contracts
No HTTP routes or new public SDK APIs. The consumer uses existing @bearound/react-native-sdk exports including getSdkVersion, checkPermissions, ensurePermissions, addScanningListener, addBeaconsListener and addErrorListener. Preserve their existing input/output/error shapes. No invented backend acknowledgement is part of acceptance.

## Data models and interfaces
The preparation script accepts an output directory and produces a temporary consumer plus a packed archive. Fail when the destination is unsafe or contains unrelated files. Its evidence metadata includes SDK/package/native versions, archive checksum, resolved package path and commands used. The report uses status values observed, failed or unverified per scenario and includes sanitized artifact references. REQ-001, REQ-002, REQ-003 and REQ-004 are linked to the relevant scenarios.

## Error handling
Dependency, pod, signing, codegen, build and runtime failures are separate outcomes. Preserve command exit status and actionable sanitized logs. Correct only reproducible blockers; expand task write sets before editing an additional file. A missing device, permission, beacon or backend acknowledgement must never become a passing result. Avoid printing tokens or embedding them in tracked evidence. Use only authorized test configuration; do not extract unrelated credentials.

## Integration guidance
REQ-004: Audit AI-AGENT-SETUP.md against successful consumer steps and existing example/README.md. Correct only findings justified by executable evidence or inspected integration code. Record supported version and tested architecture. Keep foreground, background, terminated, Android and backend evidence separate. Preserve human business-token requirements and native host delegate ownership. Explain each fix and why it was necessary in the PR.

## Test strategy
- Packaging integration (REQ-001): run the preparation script, inspect installed dependency resolution and native autolink output; ensure all SDK paths reside in the standalone consumer. Exercise unsafe-output rejection.
- SDK regression (REQ-003): run src/__tests__/sdk.test.ts, src/__tests__/listeners.test.ts and src/__tests__/permissions.test.ts when bridge or diagnostic changes justify them; run yarn typecheck and yarn check:versions.
- Native integration (REQ-002): CocoaPods plus physical iPhone build/install/launch and runtime inspection. Existing wrappers must link to the published native pin.
- Exactly one final device E2E task (REQ-001 through REQ-004): installed app configure, permissions, start, callbacks, stop, denied-permission recovery if practical, foreground/background observations and honest gaps. Native UI/device tooling replaces Playwright because the application has no browser runtime. This is an explicit applicability exception to the generic web E2E convention.
- Documentation (REQ-004): compare instructions with recorded commands and actual outcomes. No prose snapshot tests.

## File-structure plan
| File | Action |
|---|---|
| scripts/create-validation-app.mjs | Create isolated packed-consumer preparation |
| example/README.md | Document reproducible consumer validation |
| example/src/App.tsx | Modify only diagnostics necessary for physical evidence |
| AI-AGENT-SETUP.md, README.md | Correct demonstrated integration guidance defects |
| scripts/validation-lifecycle.js | Optional installed-consumer lifecycle probe |
| example/ios/BearoundReactSdkExample/AppDelegate.swift | Mirror test markers to stderr and a local per-launch file |
| docs/specs/react-native-device-validation/validation.md | Create sanitized E2E evidence and limitations |
| e2e/react-native-device-validation.md | Create repeatable native device regression checklist |
| docs/specs/react-native-device-validation/artifacts/ | Sanitized screenshots or compact logs only if useful |

Native or packaging fixes discovered during execution require updating task write sets before modification. Do not commit generated consumer dependencies, pods, archives, signing material or device-private logs.
