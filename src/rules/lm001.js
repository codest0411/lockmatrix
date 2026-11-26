import { inferPlatformFromName } from '../platforms.js';

/** @typedef {import('../groups.js').OptionalDepGroup} OptionalDepGroup */
/** @typedef {import('./index.js').Finding} Finding */

export const RULE_LM001 = 'LM001';

const REMEDIATION =
  'Verify before running: regenerate package-lock.json with a modern npm version (e.g. remove node_modules and package-lock.json, then run `npm install` without `--omit=optional`).';

/**
 * LM001: Parent declares an optional dependency that is missing from the lockfile.
 *
 * @param {OptionalDepGroup[]} groups
 * @returns {Finding[]}
 */
export function checkMissingOptionalDeps(groups) {
  /** @type {Finding[]} */
  const findings = [];

  for (const group of groups) {
    for (const dep of group.optionalDeps) {
      if (dep.entry !== null) {
        continue;
      }
      const inferred = inferPlatformFromName(dep.depName);
      const inferredSuffix = inferred ? ` (inferred platform: ${inferred})` : '';

      findings.push({
        ruleId: RULE_LM001,
        severity: 'error',
        packageName: group.parentName,
        packagePath: group.parentPath,
        message: `${group.parentName} declares optional dependency "${dep.depName}" (${dep.depRange}), which is missing from the lockfile${inferredSuffix}.`,
        details: {
          parentName: group.parentName,
          parentPath: group.parentPath,
          missingDependency: dep.depName,
          requestedRange: dep.depRange,
          inferredPlatform: inferred,
        },
        remediation: REMEDIATION,
      });
    }
  }

  return findings;
}
