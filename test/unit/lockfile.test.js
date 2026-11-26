import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  auditLockfileContent,
  LockfileError,
  parseLockfileContent,
  readAndParseLockfile,
  resolveLockfilePath,
} from '../../src/index.js';
import { getDisplayPackageName, getResolutionCandidates, resolveOptionalDep } from '../../src/resolve.js';
import {
  COMPLETE_V3_LOCKFILE,
  LIBC_AND_NEGATION_V2,
  MAC_ONLY_ROLLUP_V3,
  WORKSPACE_AND_NESTED_V3,
} from '../helpers/fixtures.js';

describe('lockfile parser and resolver', () => {
  it('parses valid v3 lockfile with BOM and CRLF', () => {
    const raw = '\uFEFF' + JSON.stringify(COMPLETE_V3_LOCKFILE, null, 2).replace(/\n/g, '\r\n');
    const parsed = parseLockfileContent(raw);
    assert.equal(parsed.lockfileVersion, 3);
    assert.equal(parsed.packages.size, 7);
  });

  it('rejects lockfileVersion 1 with LockfileError', () => {
    const raw = JSON.stringify({ name: 'legacy', lockfileVersion: 1, dependencies: {} });
    assert.throws(
      () => parseLockfileContent(raw),
      (err) => err instanceof LockfileError && err.code === 'UNSUPPORTED_VERSION',
    );
  });

  it('rejects unknown lockfileVersion and missing packages', () => {
    assert.throws(
      () => parseLockfileContent(JSON.stringify({ lockfileVersion: 99, packages: {} })),
      (err) => err instanceof LockfileError && err.code === 'UNSUPPORTED_VERSION',
    );
    assert.throws(
      () => parseLockfileContent(JSON.stringify({ lockfileVersion: 3 })),
      (err) => err instanceof LockfileError && err.code === 'MISSING_PACKAGES',
    );
  });

  it('handles empty lockfile cleanly', () => {
    const report = auditLockfileContent(
      JSON.stringify({ name: 'empty', lockfileVersion: 3, packages: { '': { name: 'empty' } } }),
    );
    assert.equal(report.summary.errors, 0);
    assert.equal(report.summary.warnings, 0);
    assert.equal(report.matrix.length, 0);
  });

  it('handles duplicate JSON keys deterministically without crashing', () => {
    const raw = `{
      "name": "dup",
      "lockfileVersion": 3,
      "packages": {
        "": { "name": "dup" },
        "node_modules/a": { "version": "1.0.0" },
        "node_modules/a": { "version": "2.0.0" }
      }
    }`;
    const parsed = parseLockfileContent(raw);
    assert.equal(parsed.packages.get('node_modules/a')?.version, '2.0.0');
  });

  it('resolves nested, hoisted, scoped, and link entries', () => {
    const candidates = getResolutionCandidates('packages/app/node_modules/@scope/pkg', 'dep');
    assert.deepEqual(candidates, [
      'packages/app/node_modules/@scope/pkg/node_modules/dep',
      'packages/app/node_modules/dep',
      'packages/node_modules/dep',
      'node_modules/dep',
    ]);

    const parsed = parseLockfileContent(JSON.stringify(WORKSPACE_AND_NESTED_V3));
    const localSharpDep = resolveOptionalDep(parsed.packages, 'packages/app/node_modules/sharp', '@img/sharp-linux-x64');
    assert.equal(localSharpDep?.version, '0.33.0');

    const hoistedDep = resolveOptionalDep(parsed.packages, 'packages/app/node_modules/sharp', '@img/sharp-universal');
    assert.equal(hoistedDep?.path, 'node_modules/@img/sharp-universal');

    const linked = resolveOptionalDep(parsed.packages, '', '@mono/app');
    assert.equal(linked?.path, 'packages/app');
    assert.equal(getDisplayPackageName(linked), '@mono/app');
  });

  it('resolves directory to package-lock.json or npm-shrinkwrap.json', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lm-resolve-'));
    try {
      const shrink = path.join(tmp, 'npm-shrinkwrap.json');
      fs.writeFileSync(shrink, JSON.stringify(COMPLETE_V3_LOCKFILE));
      assert.equal(resolveLockfilePath(tmp), shrink);

      const { lockfile } = readAndParseLockfile(tmp);
      assert.equal(lockfile.lockfileVersion, 3);

      const pkgLock = path.join(tmp, 'package-lock.json');
      fs.writeFileSync(pkgLock, JSON.stringify(MAC_ONLY_ROLLUP_V3));
      assert.equal(resolveLockfilePath(tmp), pkgLock);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('evaluates complete, mac-only, and libc/negated lockfiles accurately', () => {
    const clean = auditLockfileContent(JSON.stringify(COMPLETE_V3_LOCKFILE));
    assert.equal(clean.summary.errors, 0);
    assert.equal(clean.summary.warnings, 0);

    const macOnly = auditLockfileContent(JSON.stringify(MAC_ONLY_ROLLUP_V3));
    assert.ok(macOnly.findings.some((f) => f.ruleId === 'LM001' && f.message.includes('inferred platform: linux-x64-glibc')));
    assert.ok(macOnly.findings.some((f) => f.ruleId === 'LM002' && f.details?.target === 'win32-x64'));
    assert.ok(macOnly.findings.some((f) => f.ruleId === 'LM003'));
    assert.ok(macOnly.findings.some((f) => f.ruleId === 'LM004'));

    const libcReport = auditLockfileContent(JSON.stringify(LIBC_AND_NEGATION_V2));
    // lightningcss-not-win32 covers linux-arm64-glibc, darwin-arm64, darwin-x64; explicit entries cover linux-x64-glibc & musl; win32-x64 is uncovered!
    const lm002 = libcReport.findings.filter((f) => f.ruleId === 'LM002');
    assert.equal(lm002.length, 1);
    assert.equal(lm002[0]?.details?.target, 'win32-x64');
  });
});
