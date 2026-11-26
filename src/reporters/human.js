import { sanitizeText } from '../sanitize.js';

/** @typedef {import('../index.js').AuditReport} AuditReport */

/**
 * @param {boolean} useColor
 * @param {string} code
 * @param {string} text
 * @returns {string}
 */
function color(useColor, code, text) {
  return useColor ? `\x1b[${code}m${text}\x1b[0m` : text;
}

/**
 * Format an audit report for human terminal output.
 * Colors are emitted only when `options.color` is true.
 *
 * @param {AuditReport} report
 * @param {{ color?: boolean }} [options]
 * @returns {string}
 */
export function formatHuman(report, options = {}) {
  const useColor = options.color === true;
  /** @type {string[]} */
  const lines = [];

  lines.push(
    `${color(useColor, '1', 'lockmatrix')} — audited ${sanitizeText(report.lockfilePath)} (lockfileVersion ${report.lockfileVersion}, ${report.packageCount} packages)`,
  );
  lines.push(`Targets: ${report.targets.map((t) => sanitizeText(t.id)).join(', ')}`);
  lines.push('');

  const actionable = report.findings.filter((f) => f.ruleId !== 'LM004');

  if (actionable.length === 0) {
    lines.push(color(useColor, '32', 'PASS: No missing optional dependencies or uncovered target platforms found.'));
  } else {
    for (const f of actionable) {
      const badge =
        f.severity === 'error'
          ? color(useColor, '31;1', 'ERROR')
          : f.severity === 'warn'
            ? color(useColor, '33;1', 'WARN ')
            : color(useColor, '36', 'INFO ');
      lines.push(`${badge} [${sanitizeText(f.ruleId)}] ${sanitizeText(f.message)}`);
      if (f.remediation) {
        lines.push(`       ${color(useColor, '2', sanitizeText(f.remediation))}`);
      }
    }
  }

  if (report.matrix.length > 0) {
    lines.push('');
    lines.push(color(useColor, '1', 'Coverage Matrix (LM004):'));
    const targetIds = report.targets.map((t) => sanitizeText(t.id));
    lines.push(`  Group | ${targetIds.join(' | ')}`);
    for (const row of report.matrix) {
      const cells = report.targets.map((t) => {
        const status = row.cells[t.id] ?? 'missing';
        return status === 'present' ? color(useColor, '32', 'OK') : color(useColor, '31', 'MISSING');
      });
      lines.push(`  ${sanitizeText(row.parentName)} | ${cells.join(' | ')}`);
    }
  }

  if (report.verifyResults && report.verifyResults.length > 0) {
    lines.push('');
    lines.push(color(useColor, '1', 'npm ci --dry-run Verification:'));
    for (const vr of report.verifyResults) {
      const status = vr.skipped
        ? color(useColor, '33', 'SKIPPED')
        : vr.ok
          ? color(useColor, '32', 'OK')
          : color(useColor, '31', 'FAIL');
      lines.push(`  ${sanitizeText(vr.target)}: ${status} — ${sanitizeText(vr.summary)}`);
    }
  }

  lines.push('');
  lines.push(
    `Summary: ${report.summary.errors} error(s), ${report.summary.warnings} warning(s), ${report.summary.info} info.`,
  );

  return lines.join('\n') + '\n';
}
