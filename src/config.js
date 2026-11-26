import fs from 'node:fs';
import path from 'node:path';

export const CONFIG_FILENAME = 'lockmatrix.config.json';
const VALID_FAIL_ON = new Set(['error', 'warn', 'info', 'none']);
const ALLOWED_KEYS = new Set(['targets', 'ignorePackages', 'failOn']);

/**
 * Error thrown when `lockmatrix.config.json` fails schema or JSON validation.
 */
export class ConfigError extends Error {
  /**
   * @param {string} message
   */
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * @typedef {object} IgnorePackageEntry
 * @property {string} name
 * @property {string} reason
 */

/**
 * @typedef {object} LockmatrixConfig
 * @property {string[] | undefined} targets
 * @property {IgnorePackageEntry[]} ignorePackages
 * @property {'error' | 'warn' | 'info' | 'none' | undefined} failOn
 */

/**
 * Strictly validate a parsed `lockmatrix.config.json` object.
 *
 * @param {unknown} raw
 * @returns {LockmatrixConfig}
 */
export function validateConfig(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ConfigError('Config must be a JSON object.');
  }

  const obj = /** @type {Record<string, unknown>} */ (raw);
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new ConfigError(`Unknown config property: "${key}".`);
    }
  }

  /** @type {string[] | undefined} */
  let targets;
  if (obj.targets !== undefined) {
    if (!Array.isArray(obj.targets) || obj.targets.some((t) => typeof t !== 'string' || !t.trim())) {
      throw new ConfigError('"targets" must be an array of non-empty strings.');
    }
    targets = obj.targets.map((t) => t.trim());
  }

  /** @type {IgnorePackageEntry[]} */
  const ignorePackages = [];
  if (obj.ignorePackages !== undefined) {
    if (!Array.isArray(obj.ignorePackages)) {
      throw new ConfigError('"ignorePackages" must be an array of { name, reason } objects.');
    }
    for (let i = 0; i < obj.ignorePackages.length; i++) {
      const item = obj.ignorePackages[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        throw new ConfigError(`"ignorePackages[${i}]" must be an object.`);
      }
      const entry = /** @type {Record<string, unknown>} */ (item);
      for (const k of Object.keys(entry)) {
        if (k !== 'name' && k !== 'reason') {
          throw new ConfigError(`Unknown property "${k}" in "ignorePackages[${i}]".`);
        }
      }
      if (typeof entry.name !== 'string' || !entry.name.trim()) {
        throw new ConfigError(`"ignorePackages[${i}].name" must be a non-empty string.`);
      }
      if (typeof entry.reason !== 'string' || !entry.reason.trim()) {
        throw new ConfigError(`"ignorePackages[${i}].reason" is required and must be a non-empty string.`);
      }
      ignorePackages.push({ name: entry.name.trim(), reason: entry.reason.trim() });
    }
  }

  /** @type {'error' | 'warn' | 'info' | 'none' | undefined} */
  let failOn;
  if (obj.failOn !== undefined) {
    if (typeof obj.failOn !== 'string' || !VALID_FAIL_ON.has(obj.failOn)) {
      throw new ConfigError('"failOn" must be one of: error, warn, info, none.');
    }
    failOn = /** @type {'error' | 'warn' | 'info' | 'none'} */ (obj.failOn);
  }

  return { targets, ignorePackages, failOn };
}

/**
 * Load and validate `lockmatrix.config.json` if present (or if explicitly specified).
 *
 * @param {string} searchDir
 * @param {string} [explicitPath]
 * @returns {LockmatrixConfig}
 */
export function loadConfig(searchDir, explicitPath) {
  const configPath = explicitPath
    ? path.resolve(explicitPath)
    : path.join(path.resolve(searchDir), CONFIG_FILENAME);

  if (!fs.existsSync(configPath)) {
    if (explicitPath) {
      throw new ConfigError(`Config file not found: ${configPath}`);
    }
    return { targets: undefined, ignorePackages: [], failOn: undefined };
  }

  let rawText;
  try {
    rawText = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to read config file ${configPath}: ${msg}`);
  }

  const cleanText = rawText.charCodeAt(0) === 0xfeff ? rawText.slice(1) : rawText;
  let parsed;
  try {
    parsed = JSON.parse(cleanText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Invalid JSON in config file ${configPath}: ${msg}`);
  }

  return validateConfig(parsed);
}
