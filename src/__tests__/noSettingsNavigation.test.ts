/**
 * @fileoverview One-way ratchet: neither the SDK nor the sample app may take the
 * user out of the app.
 *
 * **The cost of violating this.** The library learned it in 3.4.5, when
 * `requestBackgroundLocation()` called `Linking.openSettings()` on a permanent
 * denial. The example app re-learned it on its own: it auto-started on launch,
 * and the auto-start asked for `ACCESS_BACKGROUND_LOCATION` — a permission that
 * from Android 11 on cannot be granted from a dialog at all, only on the system
 * Settings screen. The user granted the permissions, the app opened, and the app
 * immediately threw them into Android's location settings. Reporting the state is
 * the SDK's job; hijacking the user's navigation is not.
 *
 * Explicit, user-initiated navigation is a different thing and is allowed: a
 * button whose label says where it goes, or a host app acting on the boolean
 * `requestBackgroundLocation()` returns. This test guards the *automatic* paths
 * only, which is why it forbids the calls in the shipped library and the sample
 * app rather than in host code we do not own.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..');

const read = (relativePath: string) =>
  readFileSync(join(repoRoot, relativePath), 'utf8');

const SHIPPED_SOURCES = [
  'src/index.tsx',
  'src/permissions.ts',
  'src/errorReporter.ts',
  'src/NativeBearoundReactSdk.ts',
  'example/src/App.tsx',
  'example/src/SettingsModal.tsx',
  'example/src/TwoEyesModal.tsx',
  'example/src/LogModal.tsx',
  'example/src/EyeCard.tsx',
];

describe('no automatic navigation out of the app', () => {
  it.each(SHIPPED_SOURCES)('%s never calls Linking.openSettings()', (file) => {
    // Comments and docs may name it — call sites may not.
    const calls = read(file).match(/^[^*/\n]*Linking\.openSettings\s*\(/gm);
    expect(calls).toBeNull();
  });

  it.each(SHIPPED_SOURCES)('%s never opens the iOS settings URL', (file) => {
    expect(read(file)).not.toContain('app-settings:');
  });

  it('the example never asks for background location on its own', () => {
    // The example auto-starts scanning on launch, so any askBackground here is
    // a request the user did not make.
    // Comments may document the opt-in for host apps — call sites may not use it.
    const optIns = read('example/src/App.tsx').match(
      /^[^*/\n]*askBackground:\s*true/gm
    );
    expect(optIns).toBeNull();
  });

  it('the example reports the background-location state and its cost instead', () => {
    const app = read('example/src/App.tsx');
    expect(app).toContain('Loc. background');
    expect(app).toContain('Wi-Fi só com o app na tela');
  });
});
