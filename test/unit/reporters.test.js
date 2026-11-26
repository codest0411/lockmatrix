import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { auditLockfileContent, formatReport } from '../../src/index.js';
import { MAC_ONLY_ROLLUP_V3 } from '../helpers/fixtures.js';

describe('output reporters', () => {
  const report = auditLockfileContent(JSON.stringify(MAC_ONLY_ROLLUP_V3), {
    lockfilePath: 'package-lock.json',
  });

  it('formats human output with and without color', () => {
    const plain = formatReport(report, 'human', { color: false });
    assert.ok(plain.includes('lockmatrix — audited package-lock.json'));
    assert.ok(plain.includes('ERROR [LM001]'));
    assert.ok(plain.includes('ERROR [LM002]'));
    assert.ok(plain.includes('WARN  [LM003]'));
    assert.ok(plain.includes('Coverage Matrix (LM004):'));
    assert.ok(!plain.includes('\x1b['));

    const colored = formatReport(report, 'human', { color: true });
    assert.ok(colored.includes('\x1b['));
  });

  it('formats valid JSON output', () => {
    const jsonStr = formatReport(report, 'json');
    const parsed = JSON.parse(jsonStr);
    assert.equal(parsed.tool, 'lockmatrix');
    assert.equal(parsed.lockfileVersion, 3);
    assert.ok(parsed.summary.errors > 0);
    assert.ok(Array.isArray(parsed.matrix));
  });

  it('formats GitHub workflow annotations', () => {
    const gh = formatReport(report, 'github');
    assert.ok(gh.includes('::error file=package-lock.json,title=LM001%3A rollup::'));
    assert.ok(gh.includes('::warning file=package-lock.json,title=LM003%3A mac-only-app::'));
    assert.ok(gh.includes('::notice file=package-lock.json,title=LM004%3A <matrix>::'));
  });

  it('formats valid SARIF 2.1.0 output', () => {
    const sarifStr = formatReport(report, 'sarif');
    const sarif = JSON.parse(sarifStr);
    assert.equal(sarif.version, '2.1.0');
    assert.equal(sarif.runs.length, 1);
    assert.equal(sarif.runs[0].tool.driver.name, 'lockmatrix');
    assert.equal(sarif.runs[0].tool.driver.rules.length, 4);
    assert.ok(sarif.runs[0].results.length >= 3);
  });
});
