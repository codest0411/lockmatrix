import { parseArgs } from 'node:util';
import {
  auditLockfile,
  ConfigError,
  formatReport,
  getToolVersion,
  LockfileError,
  shouldFail,
  VALID_FORMATS,
} from './index.js';

const VALID_FAIL_ON = new Set(['error', 'warn', 'info', 'none']);

const HELP_TEXT = `Usage: lockmatrix [path-to-lockfile-or-dir] [options]

Statically audit npm package-lock.json / npm-shrinkwrap.json (v2/v3) for
missing platform-specific optional dependencies across OS, CPU, and libc targets.

Options:
  -f, --format <fmt>      Output format: human (default), json, github, sarif
  -t, --targets <list>    Comma-separated targets or presets (default, github-actions, common-dev, linux-only)
      --fail-on <level>   Minimum severity to exit 1: error (default), warn, info, none
  -c, --config <path>     Path to lockmatrix.config.json
      --verify-with-npm   Verify each target with \`npm ci --dry-run --ignore-scripts\` (uses temp dir)
      --max-file-bytes    Maximum lockfile size in bytes (default: 104857600)
      --max-packages      Maximum package entries in lockfile (default: 250000)
  -v, --version           Show version
  -h, --help              Show this help
`;

/**
 * Parse a positive integer CLI option.
 *
 * @param {string | undefined} raw
 * @param {string} flagName
 * @returns {number | undefined}
 */
function parsePositiveInt(raw, flagName) {
  if (raw === undefined) return undefined;
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`${flagName} must be a positive integer.`);
  }
  return num;
}

/**
 * Run the lockmatrix CLI with explicit arguments and streams (testable without spawning).
 *
 * @param {string[]} argv
 * @param {{
 *   stdout?: { write: (chunk: string) => unknown, isTTY?: boolean },
 *   stderr?: { write: (chunk: string) => unknown },
 *   env?: NodeJS.ProcessEnv,
 * }} [io]
 * @returns {Promise<number>} Exit code (0 = clean, 1 = findings >= failOn, 2 = usage/runtime error)
 */
export async function runCli(argv, io = {}) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const env = io.env ?? process.env;

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        format: { type: 'string', short: 'f', default: 'human' },
        targets: { type: 'string', short: 't' },
        'fail-on': { type: 'string' },
        config: { type: 'string', short: 'c' },
        'verify-with-npm': { type: 'boolean', default: false },
        'max-file-bytes': { type: 'string' },
        'max-packages': { type: 'string' },
        version: { type: 'boolean', short: 'v', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stderr.write(`Error: ${msg}\n`);
    return 2;
  }

  const { values, positionals } = parsed;

  if (values.help) {
    stdout.write(HELP_TEXT);
    return 0;
  }

  if (values.version) {
    stdout.write(`${getToolVersion()}\n`);
    return 0;
  }

  const format = /** @type {string} */ (values.format);
  if (!VALID_FORMATS.has(format)) {
    stderr.write(`Error: Invalid --format "${format}". Expected human, json, github, or sarif.\n`);
    return 2;
  }

  const failOnFlag = typeof values['fail-on'] === 'string' ? values['fail-on'] : undefined;
  if (failOnFlag !== undefined && !VALID_FAIL_ON.has(failOnFlag)) {
    stderr.write(`Error: Invalid --fail-on "${failOnFlag}". Expected error, warn, info, or none.\n`);
    return 2;
  }

  let maxFileBytes;
  let maxPackages;
  try {
    maxFileBytes = parsePositiveInt(
      typeof values['max-file-bytes'] === 'string' ? values['max-file-bytes'] : undefined,
      '--max-file-bytes',
    );
    maxPackages = parsePositiveInt(
      typeof values['max-packages'] === 'string' ? values['max-packages'] : undefined,
      '--max-packages',
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    stderr.write(`Error: ${msg}\n`);
    return 2;
  }

  const targetPath = positionals[0] ?? '.';

  try {
    const { report, failOn: configFailOn } = await auditLockfile(targetPath, {
      targets: typeof values.targets === 'string' ? values.targets : undefined,
      configPath: typeof values.config === 'string' ? values.config : undefined,
      verifyWithNpm: values['verify-with-npm'] === true,
      maxFileBytes,
      maxPackages,
    });

    const effectiveFailOn = /** @type {'error' | 'warn' | 'info' | 'none'} */ (
      failOnFlag ?? configFailOn
    );

    const useColor = Boolean(stdout.isTTY) && env.NO_COLOR === undefined;
    const output = formatReport(
      report,
      /** @type {'human' | 'json' | 'github' | 'sarif'} */ (format),
      { color: useColor },
    );

    stdout.write(output);
    return shouldFail(report, effectiveFailOn) ? 1 : 0;
  } catch (err) {
    if (err instanceof LockfileError || err instanceof ConfigError || err instanceof Error) {
      stderr.write(`Error: ${err.message}\n`);
      return 2;
    }
    stderr.write(`Error: ${String(err)}\n`);
    return 2;
  }
}
