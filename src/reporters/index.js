import { formatHuman } from './human.js';
import { formatJson } from './json.js';
import { formatGitHub } from './github.js';
import { formatSarif } from './sarif.js';

/** @typedef {import('../index.js').AuditReport} AuditReport */

export const VALID_FORMATS = new Set(['human', 'json', 'github', 'sarif']);

/**
 * Format an audit report according to `format`.
 *
 * @param {AuditReport} report
 * @param {'human' | 'json' | 'github' | 'sarif'} format
 * @param {{ color?: boolean }} [options]
 * @returns {string}
 */
export function formatReport(report, format, options = {}) {
  switch (format) {
    case 'human':
      return formatHuman(report, options);
    case 'json':
      return formatJson(report);
    case 'github':
      return formatGitHub(report);
    case 'sarif':
      return formatSarif(report);
    default:
      throw new Error(`Unsupported output format: "${String(format)}". Expected human, json, github, or sarif.`);
  }
}
