import { checkMissingOptionalDeps } from './lm001.js';
import { checkUncoveredTargets } from './lm002.js';
import { checkSinglePlatformLockfile } from './lm003.js';
import { buildCoverageMatrix } from './lm004.js';

/** @typedef {import('../lockfile.js').ParsedLockfile} ParsedLockfile */
/** @typedef {import('../groups.js').OptionalDepGroup} OptionalDepGroup */
/** @typedef {import('../platforms.js').TargetPlatform} TargetPlatform */
/** @typedef {import('./lm004.js').MatrixRow} MatrixRow */

/**
 * @typedef {'error' | 'warn' | 'info'} Severity
 */

/**
 * @typedef {object} Finding
 * @property {string} ruleId
 * @property {Severity} severity
 * @property {string} packageName
 * @property {string} packagePath
 * @property {string} message
 * @property {Record<string, unknown>} [details]
 * @property {string} [remediation]
 */

/**
 * Run all static rules (LM001–LM004) against the parsed lockfile and optional groups.
 *
 * @param {ParsedLockfile} lockfile
 * @param {OptionalDepGroup[]} groups
 * @param {TargetPlatform[]} targets
 * @param {ReadonlySet<string>} [ignoredPackages]
 * @returns {{ findings: Finding[], matrix: MatrixRow[] }}
 */
export function runAllRules(lockfile, groups, targets, ignoredPackages = new Set()) {
  const lm001 = checkMissingOptionalDeps(groups);
  const lm002 = checkUncoveredTargets(groups, targets);
  const lm003 = checkSinglePlatformLockfile(lockfile, targets, ignoredPackages);
  const { matrix, findings: lm004 } = buildCoverageMatrix(groups, targets);

  return {
    findings: [...lm001, ...lm002, ...lm003, ...lm004],
    matrix,
  };
}
