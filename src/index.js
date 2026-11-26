import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { collectOptionalGroups } from './groups.js';
import {
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_PACKAGES,
  LockfileError,
  parseLockfileContent,
  readAndParseLockfile,
  resolveLockfilePath,
} from './lockfile.js';
import { resolveTargets } from './platforms.js';
import { runAllRules } from './rules/index.js';
import { verifyWithNpm } from './verify-npm.js';

export { ConfigError, loadConfig, validateConfig } from './config.js';
export { LockfileError, parseLockfileContent, readAndParseLockfile, resolveLockfilePath } from './lockfile.js';
export { DEFAULT_TARGETS, TARGET_PRESETS, entryMatchesTarget, matchesConstraint, parseTarget, resolveTargets } from './platforms.js';
export { formatReport, VALID_FORMATS } from './reporters/index.js';
export { verifyWithNpm, resolveNpmInvocation } from './verify-npm.js';

/** @typedef {import('./lockfile.js').ParsedLockfile} ParsedLockfile */
/** @typedef {import('./platforms.js').TargetPlatform} TargetPlatform */
/** @typedef {import('./rules/index.js').Finding} Finding */
/** @typedef {import('./rules/index.js').Severity} Severity */
/** @typedef {import('./rules/lm004.js').MatrixRow} MatrixRow */
/** @typedef {import('./verify-npm.js').VerifyTargetResult} VerifyTargetResult */

/**
 * @typedef {object} AuditSummary
 * @property {number} errors
 * @property {number} warnings
 * @property {number} info
 */

/**
 * @typedef {object} AuditReport
 * @property {string} toolVersion
 * @property {string} lockfilePath
 * @property {number} lockfileVersion
 * @property {number} packageCount
 * @property {TargetPlatform[]} targets
 * @property {Finding[]} findings
 * @property {MatrixRow[]} matrix
 * @property {AuditSummary} summary
 * @property {VerifyTargetResult[]} [verifyResults]
 */

/**
 * @returns {string}
 */
export function getToolVersion() {
  try {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Audit an already-parsed lockfile in memory.
 *
 * @param {ParsedLockfile} lockfile
 * @param {{
 *   lockfilePath?: string,
 *   targets?: string | readonly string[],
 *   ignoredPackages?: ReadonlySet<string>,
 * }} [options]
 * @returns {AuditReport}
 */
export function auditParsedLockfile(lockfile, options = {}) {
  const targets = resolveTargets(options.targets);
  const ignored = options.ignoredPackages ?? new Set();
  const groups = collectOptionalGroups(lockfile, ignored);
  const { findings, matrix } = runAllRules(lockfile, groups, targets, ignored);

  let errors = 0;
  let warnings = 0;
  let info = 0;
  for (const f of findings) {
    if (f.severity === 'error') errors++;
    else if (f.severity === 'warn') warnings++;
    else info++;
  }

  return {
    toolVersion: getToolVersion(),
    lockfilePath: options.lockfilePath ?? 'package-lock.json',
    lockfileVersion: lockfile.lockfileVersion,
    packageCount: lockfile.packages.size,
    targets,
    findings,
    matrix,
    summary: { errors, warnings, info },
  };
}

/**
 * Audit raw lockfile JSON text.
 *
 * @param {string} rawText
 * @param {{
 *   lockfilePath?: string,
 *   targets?: string | readonly string[],
 *   ignoredPackages?: ReadonlySet<string>,
 *   maxFileBytes?: number,
 *   maxPackages?: number,
 * }} [options]
 * @returns {AuditReport}
 */
export function auditLockfileContent(rawText, options = {}) {
  const lockfile = parseLockfileContent(rawText, {
    maxFileBytes: options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
    maxPackages: options.maxPackages ?? DEFAULT_MAX_PACKAGES,
  });
  return auditParsedLockfile(lockfile, options);
}

/**
 * Audit a lockfile or project directory on disk, optionally loading `lockmatrix.config.json`
 * and optionally running `--verify-with-npm`.
 *
 * @param {string} targetPath
 * @param {{
 *   targets?: string | readonly string[],
 *   configPath?: string,
 *   verifyWithNpm?: boolean,
 *   maxFileBytes?: number,
 *   maxPackages?: number,
 * }} [options]
 * @returns {Promise<{ report: AuditReport, failOn: 'error' | 'warn' | 'info' | 'none' }>}
 */
export async function auditLockfile(targetPath, options = {}) {
  const filePath = resolveLockfilePath(targetPath);
  const projectDir = path.dirname(filePath);
  const config = loadConfig(projectDir, options.configPath);

  const effectiveTargets = options.targets ?? config.targets;
  const ignored = new Set(config.ignorePackages.map((p) => p.name));

  const { lockfile } = readAndParseLockfile(filePath, {
    maxFileBytes: options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES,
    maxPackages: options.maxPackages ?? DEFAULT_MAX_PACKAGES,
  });

  const report = auditParsedLockfile(lockfile, {
    lockfilePath: filePath,
    targets: effectiveTargets,
    ignoredPackages: ignored,
  });

  if (options.verifyWithNpm) {
    report.verifyResults = await verifyWithNpm(filePath, report.targets);
  }

  return {
    report,
    failOn: config.failOn ?? 'error',
  };
}

/**
 * Determine whether the audit report should fail (exit code 1) for a given `failOn` threshold.
 *
 * @param {AuditReport} report
 * @param {'error' | 'warn' | 'info' | 'none'} failOn
 * @returns {boolean}
 */
export function shouldFail(report, failOn) {
  if (failOn === 'none') return false;
  if (failOn === 'error') return report.summary.errors > 0;
  if (failOn === 'warn') return report.summary.errors > 0 || report.summary.warnings > 0;
  if (failOn === 'info') {
    return report.summary.errors > 0 || report.summary.warnings > 0 || report.summary.info > 0;
  }
  throw new LockfileError(`Invalid failOn level: ${String(failOn)}`, 'INVALID_FAIL_ON');
}
