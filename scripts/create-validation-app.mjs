#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const destination = process.argv[2];
if (!destination || destination === '--help') {
  console.log(
    'Usage: node scripts/create-validation-app.mjs <new-directory> [--smoke]'
  );
  console.log(
    'Builds and packs the SDK, then creates an independent RN 0.79.2 consumer.'
  );
  process.exit(destination ? 0 : 1);
}
const smoke = process.argv.includes('--smoke');
if (process.argv.slice(3).some((arg) => arg !== '--smoke')) {
  throw new Error(
    'Unknown option. Use --smoke for an automatic stop/restart probe.'
  );
}
const target = resolve(destination);
const relativeTarget = relative(root, target);
if (
  existsSync(target) ||
  (relativeTarget !== '..' &&
    !relativeTarget.startsWith('../') &&
    !isAbsolute(relativeTarget))
) {
  throw new Error(
    'Choose a new directory outside the SDK repository. Existing paths are never overwritten.'
  );
}
execFileSync('yarn', ['prepare'], { cwd: root, stdio: 'inherit' });
mkdirSync(target, { recursive: true });
const archive = join(target, 'bearound-sdk.tgz');
execFileSync('yarn', ['pack', '--out', archive], {
  cwd: root,
  stdio: 'inherit',
});
const example = join(root, 'example');
for (const name of [
  'android',
  'ios',
  'src',
  'app.json',
  'index.js',
  'Gemfile',
]) {
  cpSync(join(example, name), join(target, name), {
    recursive: true,
    filter: (path) =>
      !relative(example, path)
        .split('/')
        .some((part) =>
          [
            'Pods',
            'build',
            'build_device',
            'build_rn',
            '.gradle',
            '.cxx',
            'node_modules',
            'xcuserdata',
            'Podfile.lock',
            'local.properties',
            '.xcode.env.local',
          ].includes(part)
        ),
  });
}
if (smoke) {
  cpSync(
    join(root, 'scripts/validation-lifecycle.js'),
    join(target, 'validation-lifecycle.js')
  );
  const entry = join(target, 'index.js');
  writeFileSync(
    entry,
    "import './validation-lifecycle';\n" + readFileSync(entry, 'utf8')
  );
}
const androidBuild = join(target, 'android/build.gradle');
writeFileSync(
  androidBuild,
  readFileSync(androidBuild, 'utf8').replace(/^.*mavenLocal\(\).*\n/gm, '')
);
const pkg = JSON.parse(readFileSync(join(example, 'package.json'), 'utf8'));
pkg.name = 'bearound-sdk-validation';
pkg.scripts.typecheck = 'tsc --noEmit';
pkg.devDependencies.typescript = JSON.parse(
  readFileSync(join(root, 'package.json'), 'utf8')
).devDependencies.typescript;
pkg.dependencies['@bearound/react-native-sdk'] = 'file:./bearound-sdk.tgz';
delete pkg.devDependencies['react-native-builder-bob'];
delete pkg.devDependencies['react-native-monorepo-config'];
writeFileSync(
  join(target, 'package.json'),
  `${JSON.stringify(pkg, null, 2)}\n`
);
writeFileSync(
  join(target, 'metro.config.js'),
  "const { getDefaultConfig } = require('@react-native/metro-config');\nmodule.exports = getDefaultConfig(__dirname);\n"
);
writeFileSync(
  join(target, 'babel.config.js'),
  "module.exports = { presets: ['module:@react-native/babel-preset'] };\n"
);
writeFileSync(
  join(target, 'tsconfig.json'),
  JSON.stringify(
    {
      extends: '@react-native/typescript-config',
      compilerOptions: { types: ['react', 'react-native'] },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
    },
    null,
    2
  ) + '\n'
);
const podfile = join(target, 'ios/Podfile');
const source = readFileSync(podfile, 'utf8');
const localStart = source.indexOf('  # Dev:');
const localEnd = source.indexOf('  use_react_native!', localStart);
if (localStart < 0 || localEnd < 0)
  throw new Error(
    'Example Podfile changed; review the local SDK override removal.'
  );
writeFileSync(podfile, source.slice(0, localStart) + source.slice(localEnd));
console.log(`\nIndependent consumer created: ${target}`);
console.log('Next: npm install, then cd ios && pod install --repo-update.');
console.log(
  'Uses the example public test tenant. Use a compatible Bearound beacon for detection.'
);
