import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ConfigError, loadConfig, validateConfig } from '../../src/config.js';

describe('config loader and validator', () => {
  it('validates a complete config object', () => {
    const cfg = validateConfig({
      targets: ['linux-x64-glibc', 'win32-x64'],
      ignorePackages: [{ name: 'fsevents', reason: 'macOS only watcher' }],
      failOn: 'warn',
    });
    assert.deepEqual(cfg.targets, ['linux-x64-glibc', 'win32-x64']);
    assert.equal(cfg.ignorePackages.length, 1);
    assert.equal(cfg.failOn, 'warn');
  });

  it('rejects invalid config fields and missing ignore reasons', () => {
    assert.throws(() => validateConfig([]), ConfigError);
    assert.throws(() => validateConfig({ extra: true }), /Unknown config property/);
    assert.throws(() => validateConfig({ targets: [123] }), /array of non-empty strings/);
    assert.throws(
      () => validateConfig({ ignorePackages: [{ name: 'fsevents' }] }),
      /reason" is required/,
    );
    assert.throws(() => validateConfig({ failOn: 'critical' }), /"failOn" must be one of/);
  });

  it('loads lockmatrix.config.json from directory or explicit path', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-cfg-'));
    try {
      const empty = loadConfig(tmp);
      assert.equal(empty.ignorePackages.length, 0);

      assert.throws(() => loadConfig(tmp, path.join(tmp, 'missing.json')), /not found/);

      const cfgPath = path.join(tmp, 'lockmatrix.config.json');
      fs.writeFileSync(cfgPath, '\uFEFF' + JSON.stringify({ failOn: 'none' }));
      const loaded = loadConfig(tmp);
      assert.equal(loaded.failOn, 'none');

      fs.writeFileSync(cfgPath, '{bad json');
      assert.throws(() => loadConfig(tmp), /Invalid JSON/);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
