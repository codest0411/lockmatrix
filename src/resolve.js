/**
 * Node-style dependency resolution inside an npm v2/v3 lockfile `packages` Map.
 * Never touches the filesystem; all lookups use Map keys only.
 */

/** @typedef {import('./lockfile.js').LockPackageEntry} LockPackageEntry */

/**
 * Follow `link: true` entries via `resolved` Map keys (with cycle protection).
 *
 * @param {Map<string, LockPackageEntry>} packages
 * @param {LockPackageEntry} entry
 * @returns {LockPackageEntry}
 */
export function dereferenceLink(packages, entry) {
  let current = entry;
  const visited = new Set([current.path]);

  while (current.link && current.resolved !== null) {
    if (visited.has(current.resolved)) {
      break;
    }
    const target = packages.get(current.resolved);
    if (!target) {
      break;
    }
    visited.add(current.resolved);
    current = target;
  }

  return current;
}

/**
 * Compute candidate lockfile keys in Node.js module resolution order
 * starting from `parentPath` up to the root `node_modules/`.
 *
 * @param {string} parentPath
 * @param {string} depName
 * @returns {string[]}
 */
export function getResolutionCandidates(parentPath, depName) {
  /** @type {string[]} */
  const candidates = [];

  if (parentPath === '') {
    candidates.push(`node_modules/${depName}`);
    return candidates;
  }

  const parts = parentPath.split('/');

  for (let i = parts.length; i > 0; i--) {
    const seg = parts[i - 1];
    if (seg === 'node_modules') {
      continue;
    }
    // Skip npm scope directories like `.../node_modules/@scope`
    if (seg && seg.startsWith('@') && i >= 2 && parts[i - 2] === 'node_modules') {
      continue;
    }
    const prefix = parts.slice(0, i).join('/');
    candidates.push(`${prefix}/node_modules/${depName}`);
  }

  candidates.push(`node_modules/${depName}`);
  return candidates;
}

/**
 * Resolve `depName` declared by `parentPath` inside the lockfile `packages` Map.
 * Returns the dereferenced `LockPackageEntry` or `null` if absent.
 *
 * @param {Map<string, LockPackageEntry>} packages
 * @param {string} parentPath
 * @param {string} depName
 * @returns {LockPackageEntry | null}
 */
export function resolveOptionalDep(packages, parentPath, depName) {
  const candidates = getResolutionCandidates(parentPath, depName);
  for (const key of candidates) {
    const found = packages.get(key);
    if (found) {
      return dereferenceLink(packages, found);
    }
  }
  return null;
}

/**
 * Derive a human-readable package name from a lockfile entry or its path.
 *
 * @param {LockPackageEntry} entry
 * @returns {string}
 */
export function getDisplayPackageName(entry) {
  if (entry.path === '') {
    return entry.name || '<root>';
  }
  if (entry.name) {
    return entry.name;
  }
  const idx = entry.path.lastIndexOf('node_modules/');
  if (idx !== -1) {
    return entry.path.slice(idx + 'node_modules/'.length);
  }
  return entry.path;
}
