const { execFileSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '../..');

describe('Expo plugin package entry point', () => {
  it('resolves the public app.plugin.js subpath through Node package exports', () => {
    const resolved = execFileSync(
      process.execPath,
      ['-p', "require.resolve('@bearound/react-native-sdk/app.plugin.js')"],
      { cwd: root, encoding: 'utf8' }
    ).trim();

    expect(resolved).toBe(path.join(root, 'app.plugin.js'));
  });
});
