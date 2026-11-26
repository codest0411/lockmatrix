import { sanitizeText } from '../sanitize.js';

/** @typedef {import('../index.js').AuditReport} AuditReport */

/**
 * Format an audit report as sanitized JSON.
 *
 * @param {AuditReport} report
 * @returns {string}
 */
export function formatJson(report) {
  const sanitized = {
    tool: 'lockmatrix',
    version: report.toolVersion,
    lockfilePath: sanitizeText(report.lockfilePath),
    lockfileVersion: report.lockfileVersion,
    packageCount: report.packageCount,
    targets: report.targets.map((t) => ({
      id: sanitizeText(t.id),
      os: sanitizeText(t.os),
      cpu: sanitizeText(t.cpu),
      libc: t.libc ? sanitizeText(t.libc) : null,
    })),
    summary: report.summary,
    findings: report.findings.map((f) => ({
      ruleId: sanitizeText(f.ruleId),
      severity: f.severity,
      packageName: sanitizeText(f.packageName),
      packagePath: sanitizeText(f.packagePath),
      message: sanitizeText(f.message),
      ...(f.remediation ? { remediation: sanitizeText(f.remediation) } : {}),
      ...(f.details ? { details: f.details } : {}),
    })),
    matrix: report.matrix.map((row) => ({
      parentName: sanitizeText(row.parentName),
      parentPath: sanitizeText(row.parentPath),
      cells: row.cells,
    })),
    ...(report.verifyResults ? { verifyResults: report.verifyResults } : {}),
  };

  return JSON.stringify(sanitized, null, 2) + '\n';
}
