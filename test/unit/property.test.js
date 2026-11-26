import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { auditLockfileContent } from '../../src/index.js';

/**
 * Simple deterministic PRNG (Mulberry32) so property tests are reproducible.
 *
 * @param {number} seed
 */
function createRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('property-based lockfile tests', () => {
  const OS_LIST = ['linux', 'win32', 'darwin', '!win32', '!darwin'];
  const CPU_LIST = ['x64', 'arm64', '!ia32'];
  const LIBC_LIST = ['glibc', 'musl', '!musl'];

  it('never crashes on random lock trees and is deterministic regardless of key order', () => {
    const rng = createRng(20261126);

    for (let trial = 0; trial < 30; trial++) {
      /** @type {[string, Record<string, unknown>][]} */
      const entries = [['', { name: `app-${trial}`, version: '1.0.0' }]];
      const pkgCount = 5 + Math.floor(rng() * 20);

      for (let i = 0; i < pkgCount; i++) {
        const isNested = rng() < 0.3 && i > 0;
        const pkgPath = isNested
          ? `node_modules/pkg-${i - 1}/node_modules/pkg-${i}`
          : `node_modules/pkg-${i}`;

        /** @type {Record<string, unknown>} */
        const entry = { version: '1.0.0' };
        if (rng() < 0.5) entry.os = [OS_LIST[Math.floor(rng() * OS_LIST.length)]];
        if (rng() < 0.5) entry.cpu = [CPU_LIST[Math.floor(rng() * CPU_LIST.length)]];
        if (rng() < 0.3) entry.libc = [LIBC_LIST[Math.floor(rng() * LIBC_LIST.length)]];

        if (rng() < 0.4) {
          /** @type {Record<string, string>} */
          const optDeps = {};
          const depCount = 1 + Math.floor(rng() * 4);
          for (let d = 0; d < depCount; d++) {
            const targetIdx = Math.floor(rng() * pkgCount);
            optDeps[`pkg-${targetIdx}`] = '^1.0.0';
          }
          entry.optionalDependencies = optDeps;
        }

        entries.push([pkgPath, entry]);
      }

      const forwardObj = {
        name: `app-${trial}`,
        lockfileVersion: 3,
        packages: Object.fromEntries(entries),
      };
      const reversedObj = {
        name: `app-${trial}`,
        lockfileVersion: 3,
        packages: Object.fromEntries([...entries].reverse()),
      };

      const r1 = auditLockfileContent(JSON.stringify(forwardObj));
      const r2 = auditLockfileContent(JSON.stringify(reversedObj));

      assert.deepEqual(r1.summary, r2.summary);
      assert.deepEqual(r1.findings, r2.findings);
      assert.deepEqual(r1.matrix, r2.matrix);
    }
  });
});
