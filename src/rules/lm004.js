import { entryMatchesTarget } from '../platforms.js';

/** @typedef {import('../groups.js').OptionalDepGroup} OptionalDepGroup */
/** @typedef {import('../platforms.js').TargetPlatform} TargetPlatform */
/** @typedef {import('./index.js').Finding} Finding */

export const RULE_LM004 = 'LM004';

/**
 * @typedef {object} MatrixRow
 * @property {string} parentName
 * @property {string} parentPath
 * @property {Record<string, 'present' | 'missing'>} cells
 */

/**
 * LM004: Build the coverage matrix (rows = platform-variant groups, columns = targets)
 * and emit an informational summary finding when variant groups exist.
 *
 * @param {OptionalDepGroup[]} groups
 * @param {TargetPlatform[]} targets
 * @returns {{ matrix: MatrixRow[], findings: Finding[] }}
 */
export function buildCoverageMatrix(groups, targets) {
  /** @type {MatrixRow[]} */
  const matrix = [];
  let totalCells = 0;
  let presentCells = 0;

  for (const group of groups) {
    if (!group.isPlatformVariantGroup) {
      continue;
    }

    /** @type {Record<string, 'present' | 'missing'>} */
    const cells = Object.create(null);
    const presentEntries = group.optionalDeps.filter((d) => d.entry !== null);

    for (const target of targets) {
      totalCells++;
      const covered = presentEntries.some(
        (d) => d.entry !== null && entryMatchesTarget(d.entry, target),
      );
      if (covered) {
        presentCells++;
        cells[target.id] = 'present';
      } else {
        cells[target.id] = 'missing';
      }
    }

    matrix.push({
      parentName: group.parentName,
      parentPath: group.parentPath,
      cells,
    });
  }

  /** @type {Finding[]} */
  const findings = [];
  if (matrix.length > 0) {
    findings.push({
      ruleId: RULE_LM004,
      severity: 'info',
      packageName: '<matrix>',
      packagePath: '',
      message: `Coverage matrix: ${matrix.length} platform-variant group(s) across ${targets.length} target(s) (${presentCells}/${totalCells} cells covered).`,
      details: {
        groupCount: matrix.length,
        targetCount: targets.length,
        presentCells,
        totalCells,
      },
    });
  }

  return { matrix, findings };
}
