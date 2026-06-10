#!/usr/bin/env node
// Fails when the RN package major drifts from the native SDK majors it bridges.
// Policy: the RN SDK major MUST mirror the iOS/Android native SDK major.
// This is the guard against the silent version drift that froze the bridge at 2.4.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const majorOf = (version) => {
  const m = String(version).match(/(\d+)/);
  return m ? Number(m[1]) : NaN;
};

const pkg = JSON.parse(read('package.json'));
const pkgMajor = majorOf(pkg.version);

const podspec = read('BearoundReactSdk.podspec');
const podMatch = podspec.match(/s\.dependency\s+["']BearoundSDK["']\s*,\s*["'][~><=\s]*([\d.]+)["']/);
const iosMajor = podMatch ? majorOf(podMatch[1]) : NaN;

const gradle = read('android/build.gradle');
const gradleMatch = gradle.match(/bearound-android-sdk:([\d.]+)/);
const androidMajor = gradleMatch ? majorOf(gradleMatch[1]) : NaN;

const rows = [
  ['package.json', pkg.version, pkgMajor],
  ['iOS BearoundSDK (podspec)', podMatch?.[1] ?? '??', iosMajor],
  ['Android bearound-android-sdk (gradle)', gradleMatch?.[1] ?? '??', androidMajor],
];

console.log('Native version alignment check:');
for (const [label, version, major] of rows) {
  console.log(`  ${label}: ${version} (major ${major})`);
}

const iosVersion = podMatch?.[1];
const androidVersion = gradleMatch?.[1];

if ([pkgMajor, iosMajor, androidMajor].some((m) => Number.isNaN(m))) {
  console.error('\n❌ Could not parse one or more versions. Check the patterns above.');
  process.exit(1);
}

// 1) iOS and Android must point to the SAME native release (both pinned exact).
if (iosVersion !== androidVersion) {
  console.error(
    `\n❌ Native dep mismatch. iOS BearoundSDK (${iosVersion}) and Android ` +
      `bearound-android-sdk (${androidVersion}) must pin the exact same native release.\n` +
      `   Bump both in lockstep when a new native version ships.`
  );
  process.exit(1);
}

// 2) The RN SDK major must mirror the native major (policy: RN major == native major).
if (iosMajor !== pkgMajor) {
  console.error(
    `\n❌ Major drift. The RN SDK major (${pkgMajor}) must mirror the native major (${iosMajor}).\n` +
      `   Bump package.json or the native deps so the majors match.`
  );
  process.exit(1);
}

console.log(
  `\n✅ Aligned: native ${iosVersion} on both platforms; RN major ${pkgMajor} mirrors native major ${iosMajor}.`
);
