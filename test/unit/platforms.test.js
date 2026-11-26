import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { entryMatchesTarget, matchesConstraint, parseTarget, resolveTargets } from '../../src/platforms.js';

describe('platforms and constraints', () => {
  it('parses target specs and presets', () => {
    assert.deepEqual(parseTarget('linux-x64-glibc'), {
      id: 'linux-x64-glibc',
      os: 'linux',
      cpu: 'x64',
      libc: 'glibc',
    });
    assert.deepEqual(parseTarget('win32-x64'), {
      id: 'win32-x64',
      os: 'win32',
      cpu: 'x64',
      libc: null,
    });
    assert.throws(() => parseTarget('invalid'), /Invalid target/);
    assert.throws(() => parseTarget(''), /non-empty/);

    const gh = resolveTargets('github-actions');
    assert.equal(gh.length, 4);
    const custom = resolveTargets('linux-x64-musl,win32-x64,win32-x64');
    assert.equal(custom.length, 2);
    assert.throws(() => resolveTargets([]), /At least one target/);
  });

  it('evaluates positive and negated os/cpu/libc constraints', () => {
    assert.equal(matchesConstraint(null, 'linux'), true);
    assert.equal(matchesConstraint(['linux', 'darwin'], 'linux'), true);
    assert.equal(matchesConstraint(['linux', 'darwin'], 'win32'), false);
    assert.equal(matchesConstraint(['!win32'], 'linux'), true);
    assert.equal(matchesConstraint(['!win32'], 'win32'), false);
    assert.equal(matchesConstraint(['glibc'], null), false);
    assert.equal(matchesConstraint(['!musl'], null), true);

    const dummyEntry = {
      path: 'node_modules/x',
      name: 'x',
      version: '1.0.0',
      resolved: null,
      link: false,
      optional: true,
      dev: false,
      os: ['!win32'],
      cpu: ['x64'],
      libc: ['!musl'],
      optionalDependencies: new Map(),
      dependencies: new Map(),
    };

    assert.equal(entryMatchesTarget(dummyEntry, parseTarget('linux-x64-glibc')), true);
    assert.equal(entryMatchesTarget(dummyEntry, parseTarget('linux-x64-musl')), false);
    assert.equal(entryMatchesTarget(dummyEntry, parseTarget('win32-x64')), false);
    assert.equal(entryMatchesTarget(dummyEntry, parseTarget('darwin-x64')), true);
  });
});
