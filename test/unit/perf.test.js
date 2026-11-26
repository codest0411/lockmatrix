import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { auditLockfileContent } from '../../src/index.js';

describe('performance', () => {
  it('audits a 50,000-package lockfile within 5 seconds', () => {
    /** @type {Record<string, unknown>} */
    const packages = {
      '': { name: 'perf-app', version: '1.0.0' },
    };

    for (let i = 0; i < 49_999; i++) {
      if (i % 100 === 0) {
        packages[`node_modules/pkg-${i}`] = {
          version: '1.0.0',
          optionalDependencies: {
            [`pkg-${i}-linux`]: '1.0.0',
          },
        };
      } else if (i % 100 === 1) {
        packages[`node_modules/pkg-${i - 1}-linux`] = {
          version: '1.0.0',
          os: ['linux'],
          cpu: ['x64'],
          optional: true,
        };
      } else {
        packages[`node_modules/pkg-${i}`] = { version: '1.0.0' };
      }
    }

    const raw = JSON.stringify({
      name: 'perf-app',
      lockfileVersion: 3,
      packages,
    });

    const start = performance.now();
    const report = auditLockfileContent(raw);
    const elapsedMs = performance.now() - start;

    assert.equal(report.packageCount, 50_000);
    assert.ok(elapsedMs < 5000, `Expected < 5000ms, took ${elapsedMs.toFixed(1)}ms`);
  });
});
