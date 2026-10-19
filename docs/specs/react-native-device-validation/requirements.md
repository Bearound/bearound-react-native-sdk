# React Native device validation

## Assumptions
- Reuse the React Native 0.79.2 / React 19 example as the test app and derive an isolated installed-package consumer.
- The connected iPhone is authorized for installation, launch and permission interaction.
- No Android physical device is available. Existing public SDK contracts remain unchanged.

## Open questions
- Is a compatible beacon physically available and observable? Record measured availability; absence leaves detection unverified.
- Are background and terminated wake conditions available? Record them as unverified unless directly observed.

## Unchanged behavior
- Published package identity and native version pins remain stable unless an observed blocker requires correction.
- Existing SDK public exports and unrelated push integrations remain compatible.
- Previous adaptive-sampling physical gates remain separate.

### REQ-001: Installed consumer
WHEN the validation app is prepared the system SHALL install the packed SDK into a consumer outside the workspace.
- [ ] Record package version, archive checksum and resolved module/native paths inside consumer node_modules; no parent SDK autolink or Metro source alias remains.

### REQ-002: Physical execution
WHEN the installed consumer is built the system SHALL build, install and launch it on the authorized physical iPhone.
- [ ] Capture build success, device installation, running app identity and runtime output; report any failure honestly and fix reproducible integration blockers.

### REQ-003: Observable SDK operation
WHEN the user configures and starts scanning the system SHALL expose permission state, native SDK version, scanning transitions, callback activity and errors through existing diagnostics.
- [ ] Observe native bridge calls and scan start/stop without host crash; record actual beacon callbacks if available, and identify missing beacon or network evidence explicitly. Denied permissions must remain recoverable.

### REQ-004: Reproducible integration guidance
WHEN device validation finishes the system SHALL document reproducible package setup and correct the AI integration prompt for demonstrated integration defects.
- [ ] Guidance agrees with measured installation/build/runtime behavior; distinguish iOS foreground evidence from Android, background, terminated and server-delivery gaps. PR explains changes, reasons and executed checks without credentials.
