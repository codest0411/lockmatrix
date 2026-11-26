import { getDisplayPackageName, resolveOptionalDep } from './resolve.js';

/** @typedef {import('./lockfile.js').ParsedLockfile} ParsedLockfile */
/** @typedef {import('./lockfile.js').LockPackageEntry} LockPackageEntry */

/**
 * @typedef {object} OptionalDepResolution
 * @property {string} depName
 * @property {string} depRange
 * @property {LockPackageEntry | null} entry
 * @property {boolean} hasPlatformConstraints
 */

/**
 * @typedef {object} OptionalDepGroup
 * @property {string} parentName
 * @property {string} parentPath
 * @property {OptionalDepResolution[]} optionalDeps
 * @property {boolean} isPlatformVariantGroup
 */

/**
 * Inspect all lockfile entries that declare `optionalDependencies` and resolve
 * each declared dependency using Node's resolution order inside the lockfile.
 * Results are sorted deterministically by `parentPath` and `depName`.
 *
 * @param {ParsedLockfile} lockfile
 * @param {ReadonlySet<string>} [ignoredPackages]
 * @returns {OptionalDepGroup[]}
 */
export function collectOptionalGroups(lockfile, ignoredPackages = new Set()) {
  /** @type {OptionalDepGroup[]} */
  const groups = [];

  const sortedPaths = Array.from(lockfile.packages.keys()).sort();

  for (const pkgPath of sortedPaths) {
    const parent = lockfile.packages.get(pkgPath);
    if (!parent || parent.optionalDependencies.size === 0) {
      continue;
    }

    const parentName = getDisplayPackageName(parent);
    if (ignoredPackages.has(parentName)) {
      continue;
    }

    const depNames = Array.from(parent.optionalDependencies.keys()).sort();
    /** @type {OptionalDepResolution[]} */
    const optionalDeps = [];
    let isPlatformVariantGroup = false;

    for (const depName of depNames) {
      if (ignoredPackages.has(depName)) {
        continue;
      }
      const depRange = /** @type {string} */ (parent.optionalDependencies.get(depName));
      const entry = resolveOptionalDep(lockfile.packages, pkgPath, depName);
      const hasPlatformConstraints = Boolean(
        entry && (entry.os !== null || entry.cpu !== null || entry.libc !== null),
      );
      if (hasPlatformConstraints) {
        isPlatformVariantGroup = true;
      }
      optionalDeps.push({
        depName,
        depRange,
        entry,
        hasPlatformConstraints,
      });
    }

    if (optionalDeps.length > 0) {
      groups.push({
        parentName,
        parentPath: pkgPath,
        optionalDeps,
        isPlatformVariantGroup,
      });
    }
  }

  return groups;
}
