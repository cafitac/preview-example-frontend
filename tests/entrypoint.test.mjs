import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';

for (const apiUrl of ['https://api.example.test', 'https://api.test/"\\\n\r\t</script>\u2028\u2029?x=$HOME&y=`echo bad`']) {
  test(`entrypoint safely serializes ${JSON.stringify(apiUrl)} and executes the server command`, () => {
    const directory = mkdtempSync(join(tmpdir(), 'frontend-config-'));
    try {
      const configPath = join(directory, 'config.js');
      const result = spawnSync('sh', ['docker/entrypoint.sh', 'sh', '-c', 'printf server-started'], {
        encoding: 'utf8', env: { ...process.env, API_URL: apiUrl, CONFIG_PATH: configPath },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, 'server-started');
      const context = { window: {} };
      runInNewContext(readFileSync(configPath, 'utf8'), context);
      assert.equal(context.window.__APP_CONFIG__.apiUrl, apiUrl);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('requires API_URL in the container', () => {
  const result = spawnSync('sh', ['docker/entrypoint.sh', 'true'], {
    encoding: 'utf8', env: { ...process.env, API_URL: '' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /API_URL must be set/);
});
