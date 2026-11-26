import { escapeGitHubMessage, escapeGitHubProperty } from '../sanitize.js';

/** @typedef {import('../index.js').AuditReport} AuditReport */

/**
 * Format findings as GitHub Actions workflow command annotations.
 * All untrusted strings are escaped to prevent workflow-command injection.
 *
 * @param {AuditReport} report
 * @returns {string}
 */
export function formatGitHub(report) {
  const fileProp = escapeGitHubProperty(report.lockfilePath);
  /** @type {string[]} */
  const lines = [];

  for (const f of report.findings) {
    const cmd =
      f.severity === 'error' ? 'error' : f.severity === 'warn' ? 'warning' : 'notice';
    const title = escapeGitHubProperty(`${f.ruleId}: ${f.packageName}`);
    const message = escapeGitHubMessage(f.message);
    lines.push(`::${cmd} file=${fileProp},title=${title}::${message}`);
  }

  return lines.length > 0 ? lines.join('\n') + '\n' : '';
}
