import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB
export const DEFAULT_MAX_PACKAGES = 250_000;

/**
 * Error thrown for invalid lockfile input, unsupported versions, or safety limits.
 */
export class LockfileError extends Error {
  /**
   * @param {string} message
   * @param {string} [code]
   */
  constructor(message, code = 'LOCKFILE_ERROR') {
    super(message);
    this.name = 'LockfileError';
    this.code = code;
  }
}

/**
 * @typedef {object} LockPackageEntry
 * @property {string} path
 * @property {string | null} name
 * @property {string | null} version
 * @property {string | null} resolved
 * @property {boolean} link
 * @property {boolean} optional
 * @property {boolean} dev
 * @property {string[] | null} os
 * @property {string[] | null} cpu
 * @property {string[] | null} libc
 * @property {Map<string, string>} optionalDependencies
 * @property {Map<string, string>} dependencies
 */

/**
 * @typedef {object} ParsedLockfile
 * @property {string} name
 * @property {number} lockfileVersion
 * @property {Map<string, LockPackageEntry>} packages
 */

/**
 * Convert an untrusted dependency object into a prototype-safe Map.
 *
 * @param {unknown} rawObj
 * @returns {Map<string, string>}
 */
function toDepMap(rawObj) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) {
    return map;
  }
  for (const [key, val] of Object.entries(rawObj)) {
    if (typeof val === 'string') {
      map.set(key, val);
    }
  }
  return map;
}

/**
 * Normalize an optional platform constraint field (`os`, `cpu`, `libc`).
 * In npm package metadata, these are arrays of strings (or occasionally a single string).
 *
 * @param {unknown} rawVal
 * @returns {string[] | null}
 */
function toStringArray(rawVal) {
  if (Array.isArray(rawVal)) {
    const filtered = rawVal.filter((item) => typeof item === 'string' && item.length > 0);
    return filtered.length > 0 ? filtered : null;
  }
  if (typeof rawVal === 'string' && rawVal.length > 0) {
    return [rawVal];
  }
  return null;
}

/**
 * Parse raw lockfile JSON text into a prototype-safe structure.
 *
 * @param {string} rawText
 * @param {{ maxFileBytes?: number, maxPackages?: number }} [options]
 * @returns {ParsedLockfile}
 */
export function parseLockfileContent(rawText, options = {}) {
  if (typeof rawText !== 'string') {
    throw new LockfileError('Lockfile content must be a string.', 'INVALID_INPUT');
  }

  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const maxPackages = options.maxPackages ?? DEFAULT_MAX_PACKAGES;

  const byteLength = Buffer.byteLength(rawText, 'utf8');
  if (byteLength > maxFileBytes) {
    throw new LockfileError(
      `Lockfile exceeds maximum allowed size (${byteLength} > ${maxFileBytes} bytes).`,
      'FILE_TOO_LARGE',
    );
  }

  // Strip UTF-8 BOM if present
  const cleanText = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(cleanText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new LockfileError(`Invalid JSON in lockfile: ${msg}`, 'INVALID_JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LockfileError('Lockfile root must be a JSON object.', 'INVALID_ROOT');
  }

  const rootObj = /** @type {Record<string, unknown>} */ (parsed);
  const version = rootObj.lockfileVersion;

  if (version === 1) {
    throw new LockfileError(
      'lockfileVersion 1 is not supported because it lacks the "packages" map with platform metadata (os/cpu/libc). Regenerate with npm >= 7 (lockfileVersion 2 or 3).',
      'UNSUPPORTED_VERSION',
    );
  }

  if (version !== 2 && version !== 3) {
    throw new LockfileError(
      `Unsupported or missing lockfileVersion (${String(version)}). Expected 2 or 3.`,
      'UNSUPPORTED_VERSION',
    );
  }

  const rawPackages = rootObj.packages;
  if (!rawPackages || typeof rawPackages !== 'object' || Array.isArray(rawPackages)) {
    throw new LockfileError(
      'Lockfile is missing a valid "packages" object.',
      'MISSING_PACKAGES',
    );
  }

  /** @type {Map<string, LockPackageEntry>} */
  const packages = new Map();
  let count = 0;

  for (const [pkgPath, rawEntry] of Object.entries(rawPackages)) {
    count++;
    if (count > maxPackages) {
      throw new LockfileError(
        `Lockfile exceeds maximum allowed package entries (${maxPackages}).`,
        'TOO_MANY_PACKAGES',
      );
    }

    if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
      continue;
    }

    const entry = /** @type {Record<string, unknown>} */ (rawEntry);
    packages.set(pkgPath, {
      path: pkgPath,
      name: typeof entry.name === 'string' ? entry.name : null,
      version: typeof entry.version === 'string' ? entry.version : null,
      resolved: typeof entry.resolved === 'string' ? entry.resolved : null,
      link: entry.link === true,
      optional: entry.optional === true,
      dev: entry.dev === true,
      os: toStringArray(entry.os),
      cpu: toStringArray(entry.cpu),
      libc: toStringArray(entry.libc),
      optionalDependencies: toDepMap(entry.optionalDependencies),
      dependencies: toDepMap(entry.dependencies),
    });
  }

  const rootName = typeof rootObj.name === 'string' ? rootObj.name : '';

  return {
    name: rootName,
    lockfileVersion: version,
    packages,
  };
}

/**
 * Resolve a target path (file or directory) to a lockfile path.
 *
 * @param {string} targetPath
 * @returns {string}
 */
export function resolveLockfilePath(targetPath) {
  const resolved = path.resolve(targetPath);
  let stat;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new LockfileError(`Path does not exist: ${resolved}`, 'NOT_FOUND');
  }

  if (stat.isDirectory()) {
    const pkgLock = path.join(resolved, 'package-lock.json');
    if (fs.existsSync(pkgLock)) return pkgLock;
    const shrinkwrap = path.join(resolved, 'npm-shrinkwrap.json');
    if (fs.existsSync(shrinkwrap)) return shrinkwrap;
    throw new LockfileError(
      `No package-lock.json or npm-shrinkwrap.json found in directory: ${resolved}`,
      'NOT_FOUND',
    );
  }

  return resolved;
}

/**
 * Read and parse a lockfile from disk, enforcing file size limits before reading.
 *
 * @param {string} targetPath
 * @param {{ maxFileBytes?: number, maxPackages?: number }} [options]
 * @returns {{ filePath: string, lockfile: ParsedLockfile }}
 */
export function readAndParseLockfile(targetPath, options = {}) {
  const filePath = resolveLockfilePath(targetPath);
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    throw new LockfileError(`Cannot access lockfile: ${filePath}`, 'NOT_FOUND');
  }

  if (!stat.isFile()) {
    throw new LockfileError(`Lockfile path is not a regular file: ${filePath}`, 'NOT_A_FILE');
  }

  if (stat.size > maxFileBytes) {
    throw new LockfileError(
      `Lockfile exceeds maximum allowed size (${stat.size} > ${maxFileBytes} bytes).`,
      'FILE_TOO_LARGE',
    );
  }

  const rawText = fs.readFileSync(filePath, 'utf8');
  const lockfile = parseLockfileContent(rawText, options);
  return { filePath, lockfile };
}
