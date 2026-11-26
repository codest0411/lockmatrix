import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { runCli } from '../../src/cli.js';
import { COMPLETE_V3_LOCKFILE, MAC_ONLY_ROLLUP_V3 } from '../helpers/fixtures.js';

const execFileAsync = promisify(execFile);
const BIN_PATH = fileURLToPath(new URL('../../bin/lockmatrix.js', import.meta.url));

/**
 * @param {string[]} args
 */
async function execCli(args) {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [BIN_PATH, ...args], {
      shell: false,
      windowsHide: true,
    });
    return { code: 0, stdout: String(stdout), stderr: String(stderr) };
  } catch (err) {
    const e = /** @type {{ code?: number, stdout?: string, stderr?: string }} */ (err);
    return {
      code: typeof e.code === 'number' ? e.code : 1,
      stdout: String(e.stdout ?? ''),
      stderr: String(e.stderr ?? ''),
    };
  }
}

describe('CLI end-to-end', () => {
  it('supports --help and --version with exit code 0', async () => {
    const help = await execCli(['--help']);
    assert.equal(help.code, 0);
    assert.ok(help.stdout.includes('Usage: lockmatrix'));

    const ver = await execCli(['--version']);
    assert.equal(ver.code, 0);
    assert.match(ver.stdout.trim(), /^\d+\.\d+\.\d+/);
  });

  it('returns exit 0 for clean lockfile, 1 for findings, 2 for usage/runtime errors', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-e2e-'));
    try {
      const cleanPath = path.join(tmp, 'clean.json');
      const badPath = path.join(tmp, 'bad.json');
      const v1Path = path.join(tmp, 'v1.json');

      fs.writeFileSync(cleanPath, JSON.stringify(COMPLETE_V3_LOCKFILE));
      fs.writeFileSync(badPath, JSON.stringify(MAC_ONLY_ROLLUP_V3));
      fs.writeFileSync(v1Path, JSON.stringify({ lockfileVersion: 1, dependencies: {} }));

      const res0 = await execCli([cleanPath, '--format', 'json']);
      assert.equal(res0.code, 0);
      assert.equal(JSON.parse(res0.stdout).summary.errors, 0);

      const res1 = await execCli([badPath, '--format', 'sarif']);
      assert.equal(res1.code, 1);
      assert.equal(JSON.parse(res1.stdout).version, '2.1.0');

      const res1None = await execCli([badPath, '--fail-on', 'none', '--format', 'github']);
      assert.equal(res1None.code, 0);
      assert.ok(res1None.stdout.includes('::error'));

      const res2Missing = await execCli([path.join(tmp, 'nope.json')]);
      assert.equal(res2Missing.code, 2);

      const res2V1 = await execCli([v1Path]);
      assert.equal(res2V1.code, 2);

      const res2BadFlag = await execCli(['--format', 'xml']);
      assert.equal(res2BadFlag.code, 2);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('respects NO_COLOR and TTY in runCli', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-runcli-'));
    try {
      const lockPath = path.join(tmp, 'package-lock.json');
      fs.writeFileSync(lockPath, JSON.stringify(MAC_ONLY_ROLLUP_V3));

      let outNoColor = '';
      const code1 = await runCli([lockPath], {
        stdout: { write: (c) => (outNoColor += c), isTTY: true },
        stderr: { write: () => {} },
        env: { NO_COLOR: '1' },
      });
      assert.equal(code1, 1);
      assert.ok(!outNoColor.includes('\x1b['));

      let outColor = '';
      await runCli([lockPath], {
        stdout: { write: (c) => (outColor += c), isTTY: true },
        stderr: { write: () => {} },
        env: {},
      });
      assert.ok(outColor.includes('\x1b['));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
