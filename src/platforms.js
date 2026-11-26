/**
 * Target platform model, presets, npm os/cpu/libc constraint matching,
 * and heuristic platform inference from package names.
 */

/** @typedef {import('./lockfile.js').LockPackageEntry} LockPackageEntry */

/**
 * @typedef {object} TargetPlatform
 * @property {string} id
 * @property {string} os
 * @property {string} cpu
 * @property {string | null} libc
 */

/** @type {readonly TargetPlatform[]} */
export const DEFAULT_TARGETS = Object.freeze([
  { id: 'linux-x64-glibc', os: 'linux', cpu: 'x64', libc: 'glibc' },
  { id: 'linux-x64-musl', os: 'linux', cpu: 'x64', libc: 'musl' },
  { id: 'linux-arm64-glibc', os: 'linux', cpu: 'arm64', libc: 'glibc' },
  { id: 'win32-x64', os: 'win32', cpu: 'x64', libc: null },
  { id: 'darwin-arm64', os: 'darwin', cpu: 'arm64', libc: null },
  { id: 'darwin-x64', os: 'darwin', cpu: 'x64', libc: null },
]);

/** @type {Readonly<Record<string, readonly string[]>>} */
export const TARGET_PRESETS = Object.freeze({
  default: DEFAULT_TARGETS.map((t) => t.id),
  'github-actions': ['linux-x64-glibc', 'linux-arm64-glibc', 'win32-x64', 'darwin-arm64'],
  'common-dev': ['linux-x64-glibc', 'win32-x64', 'darwin-arm64', 'darwin-x64'],
  'linux-only': ['linux-x64-glibc', 'linux-x64-musl', 'linux-arm64-glibc'],
});

const SEGMENT_RE = /^[a-z0-9_]+$/i;

/**
 * Parse a single target specification such as `linux-x64-glibc` or `win32-x64`.
 *
 * @param {string} spec
 * @returns {TargetPlatform}
 */
export function parseTarget(spec) {
  if (typeof spec !== 'string' || spec.trim() === '') {
    throw new Error('Target specification must be a non-empty string.');
  }
  const trimmed = spec.trim();
  const parts = trimmed.split('-');
  if (parts.length !== 2 && parts.length !== 3) {
    throw new Error(
      `Invalid target "${trimmed}". Expected "<os>-<cpu>" or "<os>-<cpu>-<libc>" (e.g. "linux-x64-glibc", "win32-x64").`,
    );
  }
  for (const part of parts) {
    if (!SEGMENT_RE.test(part)) {
      throw new Error(`Invalid segment "${part}" in target "${trimmed}".`);
    }
  }
  const os = /** @type {string} */ (parts[0]).toLowerCase();
  const cpu = /** @type {string} */ (parts[1]).toLowerCase();
  const libc = parts[2] ? parts[2].toLowerCase() : null;
  const id = libc ? `${os}-${cpu}-${libc}` : `${os}-${cpu}`;
  return { id, os, cpu, libc };
}

/**
 * Resolve target specs or preset names into deduplicated `TargetPlatform` objects.
 *
 * @param {string | readonly string[] | undefined} input
 * @returns {TargetPlatform[]}
 */
export function resolveTargets(input) {
  if (input === undefined) {
    return DEFAULT_TARGETS.map((t) => ({ ...t }));
  }

  const rawList = Array.isArray(input)
    ? input
    : String(input)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  if (rawList.length === 0) {
    throw new Error('At least one target platform must be specified.');
  }

  /** @type {Map<string, TargetPlatform>} */
  const seen = new Map();

  for (const item of rawList) {
    const key = String(item).trim().toLowerCase();
    if (Object.hasOwn(TARGET_PRESETS, key)) {
      const presetIds = /** @type {readonly string[]} */ (TARGET_PRESETS[key]);
      for (const presetSpec of presetIds) {
        const parsed = parseTarget(presetSpec);
        seen.set(parsed.id, parsed);
      }
    } else {
      const parsed = parseTarget(item);
      seen.set(parsed.id, parsed);
    }
  }

  return Array.from(seen.values());
}

/**
 * Evaluate whether a value satisfies an npm constraint array (`os`, `cpu`, or `libc`).
 * Supports positive entries (`["linux", "darwin"]`) and negations (`["!win32"]`).
 *
 * @param {string[] | null} constraints
 * @param {string | null} value
 * @returns {boolean}
 */
export function matchesConstraint(constraints, value) {
  if (!constraints || constraints.length === 0) {
    return true;
  }

  /** @type {string[]} */
  const positives = [];
  /** @type {string[]} */
  const negatives = [];

  for (const raw of constraints) {
    const item = raw.toLowerCase();
    if (item.startsWith('!')) {
      negatives.push(item.slice(1));
    } else {
      positives.push(item);
    }
  }

  const normalizedValue = value ? value.toLowerCase() : null;

  if (normalizedValue !== null && negatives.includes(normalizedValue)) {
    return false;
  }

  if (positives.length > 0) {
    return normalizedValue !== null && positives.includes(normalizedValue);
  }

  return true;
}

/**
 * Check whether a lockfile package entry can be installed on `target`.
 *
 * @param {LockPackageEntry} entry
 * @param {TargetPlatform} target
 * @returns {boolean}
 */
export function entryMatchesTarget(entry, target) {
  return (
    matchesConstraint(entry.os, target.os) &&
    matchesConstraint(entry.cpu, target.cpu) &&
    matchesConstraint(entry.libc, target.libc)
  );
}

/** @type {readonly [string, string][]} */
const SUFFIX_HINTS = Object.freeze([
  ['-linux-x64-gnu', 'linux-x64-glibc'],
  ['-linux-x64-musl', 'linux-x64-musl'],
  ['-linux-arm64-gnu', 'linux-arm64-glibc'],
  ['-linux-arm64-musl', 'linux-arm64-musl'],
  ['-linux-x64', 'linux-x64'],
  ['-linux-arm64', 'linux-arm64'],
  ['-win32-x64-msvc', 'win32-x64'],
  ['-win32-arm64-msvc', 'win32-arm64'],
  ['-win32-x64', 'win32-x64'],
  ['-win32-arm64', 'win32-arm64'],
  ['-win32-ia32', 'win32-ia32'],
  ['-darwin-arm64', 'darwin-arm64'],
  ['-darwin-x64', 'darwin-x64'],
  ['-darwin-universal', 'darwin'],
  ['/linux-x64', 'linux-x64'],
  ['/linux-arm64', 'linux-arm64'],
  ['/win32-x64', 'win32-x64'],
  ['/win32-arm64', 'win32-arm64'],
  ['/darwin-arm64', 'darwin-arm64'],
  ['/darwin-x64', 'darwin-x64'],
]);

/**
 * Best-effort heuristic to infer a target platform from a package name suffix.
 * Always label results as "inferred" — never treat as authoritative metadata.
 *
 * @param {string} pkgName
 * @returns {string | null}
 */
export function inferPlatformFromName(pkgName) {
  const lower = pkgName.toLowerCase();
  if (lower === 'fsevents') {
    return 'darwin';
  }
  for (const [suffix, platform] of SUFFIX_HINTS) {
    if (lower.endsWith(suffix)) {
      return platform;
    }
  }
  return null;
}
