import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LockfileError, parseLockfileContent } from '../../src/lockfile.js';
import { COMPLETE_V3_LOCKFILE } from '../helpers/fixtures.js';

describe('fuzz and malformed input tests', () => {
  it('throws LockfileError (never unhandled) on truncated JSON', () => {
    const valid = JSON.stringify(COMPLETE_V3_LOCKFILE, null, 2);
    for (let cut = 0; cut < valid.length; cut += 17) {
      const truncated = valid.slice(0, cut);
      assert.throws(() => parseLockfileContent(truncated), LockfileError);
    }
  });

  it('throws LockfileError on garbage strings and wrong root types', () => {
    const inputs = [
      '',
      '   \r\n\t  ',
      'null',
      '[]',
      '"hello"',
      '42',
      '{ "lockfileVersion": 3, "packages": [] }',
      '{ "lockfileVersion": 3, "packages": null }',
      '\x00\xff\xfe\xfd{{{',
    ];
    for (const input of inputs) {
      assert.throws(() => parseLockfileContent(input), LockfileError);
    }
  });
});
