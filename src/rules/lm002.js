import { entryMatchesTarget } from '../platforms.js';

/** @typedef {import('../groups.js').OptionalDepGroup} OptionalDepGroup */
/** @typedef {import('../platforms.js').TargetPlatform} TargetPlatform */
/** @typedef {import('./index.js').Finding} Finding */

export const RULE_LM002 = 'LM002';

const REMEDIATION =
  'Verify before running: regenerate package-lock.json without `--omit=optional` (`rm -rf node_modules package-lock.json && npm install`), or narrow `--targets` / `lockmatrix.config.json` if this platform is not used.';

/**
 * LM002: A platform-variant group has no present optional dependency
 * satisfying a requested target platform.
 *
 * @param {OptionalDepGroup[]} groups
 * @param {TargetPlatform[]} targets
 * @returns {Finding[]}
 */
export function checkUncoveredTargets(groups, targets) {
  /** @type {Finding[]} */
  const findings = [];

  for (const group of groups) {
    if (!group.isPlatformVariantGroup) {
      continue;
    }

    const presentEntries = group.optionalDeps.filter((d) => d.entry !== null);

    for (const target of targets) {
      const matched = presentEntries.some(
        (d) => d.entry !== null && entryMatchesTarget(d.entry, target),
      );
      if (!matched) {
        findings.push({
          ruleId: RULE_LM002,
          severity: 'error',
          packageName: group.parentName,
          packagePath: group.parentPath,
          message: `Platform-variant group "${group.parentName}" has no optional dependency entry satisfying target "${target.id}".`,
          details: {
            parentName: group.parentName,
            parentPath: group.parentPath,
            target: target.id,
            presentVariants: presentEntries.map((d) => d.depName),
          },
          remediation: REMEDIATION,
        });
      }
    }
  }

  return findings;
}
