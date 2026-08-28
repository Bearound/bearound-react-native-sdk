/**
 * @fileoverview One-way ratchet: neither the SDK nor the sample app may send the
 * user to the system Settings, or ask for background location, on its own.
 * Explicit, user-initiated navigation by a host app is allowed.
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
