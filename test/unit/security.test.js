import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  auditLockfileContent,
  formatReport,
  LockfileError,
  parseLockfileContent,
} from '../../src/index.js';
import { escapeGitHubMessage, escapeGitHubProperty, sanitizeText } from '../../src/sanitize.js';
import { resolveNpmInvocation, verifyWithNpm } from '../../src/verify-npm.js';
import { COMPLETE_V3_LOCKFILE } from '../helpers/fixtures.js';

describe('security requirements', () => {
  it('is immune to prototype-pollution keys (__proto__, constructor, prototype)', () => {
    const malicious = `{
      "name": "proto-test",
      "lockfileVersion": 3,
      "packages": {
        "": { "name": "proto-test" },
        "__proto__": { "polluted": true, "optionalDependencies": { "constructor": "1.0.0" } },
        "constructor": { "version": "1.0.0" },
        "prototype": { "version": "1.0.0" },
        "node_modules/a": {
          "version": "1.0.0",
          "optionalDependencies": {
            "__proto__": "1.0.0",
            "constructor": "1.0.0",
            "prototype": "1.0.0"
          }
        }
      }
    }`;

    const report = auditLockfileContent(malicious);
    assert.equal(/** @type {Record<string, unknown>} */ ({}).polluted, undefined);
    assert.ok(report.findings.some((f) => f.ruleId === 'LM001'));
  });

  it('enforces maxFileBytes and maxPackages limits', () => {
    const raw = JSON.stringify(COMPLETE_V3_LOCKFILE);
    assert.throws(
      () => parseLockfileContent(raw, { maxFileBytes: 50 }),
      (err) => err instanceof LockfileError && err.code === 'FILE_TOO_LARGE',
    );
    assert.throws(
      () => parseLockfileContent(raw, { maxPackages: 2 }),
      (err) => err instanceof LockfileError && err.code === 'TOO_MANY_PACKAGES',
    );
  });

  it('strips ANSI escapes and control characters from untrusted names', () => {
    const evil = '\x1b[31mred\x1b[0m\x1b]0;pwned\x07\x00\x08hello\r\nworld';
    const cleaned = sanitizeText(evil);
    assert.equal(cleaned, 'redhello  world');

    const lockfile = {
      name: 'evil-app',
      lockfileVersion: 3,
      packages: {
        '': { name: 'evil-app' },
        'node_modules/\x1b[31mevil\x1b[0m': {
          version: '1.0.0',
          optionalDependencies: { 'missing-\x1b[32mdep\x1b[0m': '1.0.0' },
        },
      },
    };

    const report = auditLockfileContent(JSON.stringify(lockfile));
    const human = formatReport(report, 'human', { color: false });
    assert.ok(!human.includes('\x1b'));
    const sarif = formatReport(report, 'sarif');
    assert.ok(!sarif.includes('\x1b'));
  });

  it('escapes GitHub workflow-command injection sequences', () => {
    assert.equal(
      escapeGitHubMessage('bad\n::error::injected\r%25'),
      'bad%0A%3A%3Aerror%3A%3Ainjected%0D%2525',
    );
    assert.equal(escapeGitHubProperty('a:b,c\n::'), 'a%3Ab%2Cc%0A%3A%3A');

    const lockfile = {
      name: 'gh-inject',
      lockfileVersion: 3,
      packages: {
        '': { name: 'gh-inject' },
        'node_modules/pkg': {
          version: '1.0.0',
          optionalDependencies: { 'bad\n::error::pwned': '1.0.0' },
        },
      },
    };
    const report = auditLockfileContent(JSON.stringify(lockfile), {
      lockfilePath: 'dir/package-lock.json',
    });
    const gh = formatReport(report, 'github');
    const lines = gh.trim().split('\n');
    assert.equal(lines.length, 1);
    assert.ok(!lines[0]?.includes('::error::pwned'));
    assert.ok(lines[0]?.includes('%3A%3Aerror%3A%3Apwned'));
  });

  it('handles adversarial inputs in linear time (ReDoS-safe)', () => {
    const adversarial = '\x1b['.repeat(50_000) + '::'.repeat(50_000);
    const start = performance.now();
    const out = escapeGitHubMessage(adversarial);
    const elapsed = performance.now() - start;
    assert.ok(out.length > 0);
    assert.ok(elapsed < 250, `Expected < 250ms, took ${elapsed.toFixed(1)}ms`);
  });

  it('resolves npm safely via npm_execpath or Windows npm-cli.js without shell:true', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-npm-res-'));
    try {
      const fakeCli = path.join(tmp, 'npm-cli.js');
      fs.writeFileSync(fakeCli, 'console.log("ok");');
      const inv = resolveNpmInvocation({ npm_execpath: fakeCli }, 'win32');
      assert.equal(inv.command, process.execPath);
      assert.deepEqual(inv.prefixArgs, [fakeCli]);

      const winDir = path.join(tmp, 'winbin');
      const cliDir = path.join(winDir, 'node_modules', 'npm', 'bin');
      fs.mkdirSync(cliDir, { recursive: true });
      const siblingCli = path.join(cliDir, 'npm-cli.js');
      fs.writeFileSync(siblingCli, '');
      const inv2 = resolveNpmInvocation({ PATH: winDir }, 'win32');
      assert.equal(inv2.command, process.execPath);
      assert.deepEqual(inv2.prefixArgs, [siblingCli]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('verifyWithNpm isolates in temp dir, cleans up, and never touches project files', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-proj-'));
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-fake-npm-'));
    try {
      const lockPath = path.join(projectDir, 'package-lock.json');
      const pkgPath = path.join(projectDir, 'package.json');
      const secretFile = path.join(projectDir, 'secret.txt');
      fs.writeFileSync(lockPath, JSON.stringify(COMPLETE_V3_LOCKFILE));
      fs.writeFileSync(pkgPath, JSON.stringify({ name: 'complete-app', version: '1.0.0' }));
      fs.writeFileSync(secretFile, 'do-not-copy');

      const fakeNpm = path.join(binDir, 'fake-npm.js');
      fs.writeFileSync(
        fakeNpm,
        `
        const fs = require('node:fs');
        const args = process.argv.slice(2);
        if (args[0] === 'install' && args[1] === '--help') {
          console.log('--os --cpu --libc');
          process.exit(0);
        }
        if (fs.existsSync('secret.txt')) {
          console.error('LEAKED secret.txt into temp dir!');
          process.exit(99);
        }
        if (args.includes('--os=win32')) {
          console.error('npm error code EUSAGE\\nnpm error Missing: @esbuild/win32-x64 from lock file');
          process.exit(1);
        }
        process.exit(0);
        `,
      );

      const results = await verifyWithNpm(
        lockPath,
        [
          { id: 'linux-x64-glibc', os: 'linux', cpu: 'x64', libc: 'glibc' },
          { id: 'win32-x64', os: 'win32', cpu: 'x64', libc: null },
        ],
        { env: { npm_execpath: fakeNpm } },
      );

      assert.equal(results.length, 2);
      assert.equal(results[0]?.ok, true);
      assert.equal(results[1]?.ok, false);
      assert.ok(results[1]?.summary.includes('Missing: @esbuild/win32-x64'));
      assert.equal(fs.readFileSync(secretFile, 'utf8'), 'do-not-copy');
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.rmSync(binDir, { recursive: true, force: true });
    }
  });

  it('verifyWithNpm skips when installed npm lacks --os/--cpu flags', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-proj-skip-'));
    const binDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-old-npm-'));
    try {
      const lockPath = path.join(projectDir, 'package-lock.json');
      fs.writeFileSync(lockPath, JSON.stringify(COMPLETE_V3_LOCKFILE));
      const oldNpm = path.join(binDir, 'old-npm.js');
      fs.writeFileSync(oldNpm, 'console.log("npm install");');

      const results = await verifyWithNpm(
        lockPath,
        [{ id: 'linux-x64-glibc', os: 'linux', cpu: 'x64', libc: 'glibc' }],
        { env: { npm_execpath: oldNpm } },
      );
      assert.equal(results[0]?.skipped, true);
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true });
      fs.rmSync(binDir, { recursive: true, force: true });
    }
  });
});
