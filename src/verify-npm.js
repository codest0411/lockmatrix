import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** @typedef {import('./platforms.js').TargetPlatform} TargetPlatform */

/**
 * @typedef {object} VerifyTargetResult
 * @property {string} target
 * @property {boolean} ok
 * @property {boolean} skipped
 * @property {string} summary
 */

/**
 * @typedef {object} NpmInvocation
 * @property {string} command
 * @property {string[]} prefixArgs
 */

/**
 * Resolve how to invoke npm without `shell: true`.
 * On Windows, Node >= 18.20 / 20.12 forbids spawning `.cmd` files without a shell,
 * so we resolve `npm_execpath` or `npm-cli.js` and run it via `process.execPath`.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @param {NodeJS.Platform} [platform]
 * @returns {NpmInvocation}
 */
export function resolveNpmInvocation(env = process.env, platform = process.platform) {
  const execPath = env.npm_execpath;
  if (execPath && /\.(?:c|m)?js$/i.test(execPath) && fs.existsSync(execPath)) {
    return { command: process.execPath, prefixArgs: [execPath] };
  }

  if (platform === 'win32') {
    const pathEnv = env.PATH || env.Path || '';
    for (const dir of pathEnv.split(path.delimiter)) {
      if (!dir) continue;
      const siblingCli = path.join(dir, 'node_modules', 'npm', 'bin', 'npm-cli.js');
      if (fs.existsSync(siblingCli)) {
        return { command: process.execPath, prefixArgs: [siblingCli] };
      }
      const npmExe = path.join(dir, 'npm.exe');
      if (fs.existsSync(npmExe)) {
        return { command: npmExe, prefixArgs: [] };
      }
    }

    const bundledCli = path.join(
      path.dirname(process.execPath),
      'node_modules',
      'npm',
      'bin',
      'npm-cli.js',
    );
    if (fs.existsSync(bundledCli)) {
      return { command: process.execPath, prefixArgs: [bundledCli] };
    }
  }

  return { command: 'npm', prefixArgs: [] };
}

/**
 * Run npm safely via `execFile` (never `exec` or `shell: true`).
 *
 * @param {NpmInvocation} invocation
 * @param {string[]} args
 * @param {string} cwd
 * @param {number} timeoutMs
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
async function runNpm(invocation, args, cwd, timeoutMs) {
  try {
    const { stdout, stderr } = await execFileAsync(
      invocation.command,
      [...invocation.prefixArgs, ...args],
      {
        cwd,
        shell: false,
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      },
    );
    return { code: 0, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') };
  } catch (err) {
    const e = /** @type {{ code?: number | string, stdout?: string, stderr?: string, message?: string }} */ (err);
    const exitCode = typeof e.code === 'number' ? e.code : 1;
    return {
      code: exitCode,
      stdout: String(e.stdout ?? ''),
      stderr: String(e.stderr ?? e.message ?? ''),
    };
  }
}

/**
 * Verify lockfile coverage by running `npm ci --dry-run --ignore-scripts`
 * inside an isolated temporary directory containing ONLY `package.json` and the lockfile.
 *
 * @param {string} lockfilePath
 * @param {TargetPlatform[]} targets
 * @param {{ timeoutMs?: number, env?: NodeJS.ProcessEnv, platform?: NodeJS.Platform }} [options]
 * @returns {Promise<VerifyTargetResult[]>}
 */
export async function verifyWithNpm(lockfilePath, targets, options = {}) {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const invocation = resolveNpmInvocation(options.env, options.platform);
  const lockDir = path.dirname(path.resolve(lockfilePath));
  const lockBasename = path.basename(lockfilePath);
  const pkgJsonSrc = path.join(lockDir, 'package.json');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lockmatrix-verify-'));

  try {
    fs.copyFileSync(lockfilePath, path.join(tempDir, lockBasename));
    if (fs.existsSync(pkgJsonSrc)) {
      fs.copyFileSync(pkgJsonSrc, path.join(tempDir, 'package.json'));
    }

    // Confirm installed npm supports --os and --cpu flags (checked via `npm install --help`)
    const helpRes = await runNpm(invocation, ['install', '--help'], tempDir, timeoutMs);
    const helpText = `${helpRes.stdout}\n${helpRes.stderr}`;
    if (!helpText.includes('--os') || !helpText.includes('--cpu')) {
      return targets.map((t) => ({
        target: t.id,
        ok: true,
        skipped: true,
        summary: 'Installed npm does not advertise --os/--cpu flags; verification skipped.',
      }));
    }

    /** @type {VerifyTargetResult[]} */
    const results = [];

    for (const target of targets) {
      const args = [
        'ci',
        '--dry-run',
        '--ignore-scripts',
        `--os=${target.os}`,
        `--cpu=${target.cpu}`,
      ];
      if (target.libc) {
        args.push(`--libc=${target.libc}`);
      }

      const res = await runNpm(invocation, args, tempDir, timeoutMs);
      if (res.code === 0) {
        results.push({
          target: target.id,
          ok: true,
          skipped: false,
          summary: 'npm ci --dry-run succeeded',
        });
      } else {
        const combined = `${res.stderr}\n${res.stdout}`.trim();
        const lines = combined.split(/\r?\n/);
        const firstMeaningful =
          lines.find((line) => line.includes('Missing:')) ||
          lines.find((line) => line.includes('EUSAGE')) ||
          lines.find((line) => line.trim().length > 0) ||
          `npm exited with code ${res.code}`;
        results.push({
          target: target.id,
          ok: false,
          skipped: false,
          summary: firstMeaningful.replace(/^npm error\s*/i, '').trim(),
        });
      }
    }

    return results;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
