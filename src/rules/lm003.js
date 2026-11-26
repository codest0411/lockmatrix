import { entryMatchesTarget } from '../platforms.js';

/** @typedef {import('../lockfile.js').ParsedLockfile} ParsedLockfile */
/** @typedef {import('../platforms.js').TargetPlatform} TargetPlatform */
/** @typedef {import('./index.js').Finding} Finding */

export const RULE_LM003 = 'LM003';

const REMEDIATION =
  'Verify before running: inspect whether `npm install` was run with `--omit=optional` or an older npm version on a single machine, and regenerate `package-lock.json` if cross-platform CI fails.';

/**
 * LM003: All platform-specific entries across the entire lockfile cover
 * only a single (os, cpu) pair, suggesting single-machine lockfile generation.
 *
 * @param {ParsedLockfile} lockfile
 * @param {TargetPlatform[]} targets
 * @param {ReadonlySet<string>} [ignoredPackages]
 * @returns {Finding[]}
 */
export function checkSinglePlatformLockfile(lockfile, targets, ignoredPackages = new Set()) {
  /** @type {Set<string>} */
  const coveredOsCpu = new Set();
  let constrainedCount = 0;

  for (const entry of lockfile.packages.values()) {
    if (entry.path === '') continue;
    if (entry.name && ignoredPackages.has(entry.name)) continue;
    if (entry.os === null && entry.cpu === null && entry.libc === null) {
      continue;
    }

    constrainedCount++;
    for (const target of targets) {
      if (entryMatchesTarget(entry, target)) {
        coveredOsCpu.add(`${target.os}-${target.cpu}`);
      }
    }
  }

  if (constrainedCount > 0 && coveredOsCpu.size === 1) {
    const [onlyPair] = Array.from(coveredOsCpu);
    return [
      {
        ruleId: RULE_LM003,
        severity: 'warn',
        packageName: lockfile.name || '<root>',
        packagePath: '',
        message: `All ${constrainedCount} platform-specific entries in the lockfile cover only a single OS/CPU (${onlyPair}); the lockfile may have been generated on a single machine.`,
        details: {
          constrainedEntries: constrainedCount,
          coveredOsCpu: Array.from(coveredOsCpu),
        },
        remediation: REMEDIATION,
      },
    ];
  }

  return [];
}
