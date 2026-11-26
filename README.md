# lockmatrix

Statically audit npm `package-lock.json` and `npm-shrinkwrap.json` (lockfileVersion 2 & 3) for missing platform-specific optional dependencies across OS, CPU, and libc targets — **offline, read-only, and with zero runtime dependencies**.

## The Problem

JavaScript packages with native binaries (such as `esbuild`, `rollup`, `@swc/core`, `lightningcss`, and `sharp`) declare platform-specific packages under `optionalDependencies`. When a lockfile is incomplete or pruned for another OS/CPU, `npm ci` in CI or Docker fails late with errors like:

```text
npm error code EUSAGE
npm error
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync. Please update your lock file with `npm install` before continuing.
npm error
npm error Missing: @rollup/rollup-linux-x64-gnu@4.68.8 from lock file
```

Or at runtime:

```text
Error: Cannot find module '@rollup/rollup-linux-x64-gnu'
```

`lockmatrix` checks your lockfile statically against your target platforms before CI fails.

## Before / After

**Before (macOS-only lockfile):**

```text
$ npx lockmatrix
lockmatrix — audited package-lock.json (lockfileVersion 3, 3 packages)
Targets: linux-x64-glibc, linux-x64-musl, linux-arm64-glibc, win32-x64, darwin-arm64, darwin-x64

ERROR [LM001] rollup declares optional dependency "@rollup/rollup-linux-x64-gnu" (4.68.8), which is missing from the lockfile (inferred platform: linux-x64-glibc).
ERROR [LM002] Platform-variant group "rollup" has no optional dependency entry satisfying target "linux-x64-glibc".
WARN  [LM003] All 1 platform-specific entries in the lockfile cover only a single OS/CPU (darwin-arm64); the lockfile may have been generated on a single machine.
```

**After regenerating the complete lockfile:**

```text
$ npx lockmatrix
lockmatrix — audited package-lock.json (lockfileVersion 3, 28 packages)
Targets: linux-x64-glibc, linux-x64-musl, linux-arm64-glibc, win32-x64, darwin-arm64, darwin-x64

PASS: No missing optional dependencies or uncovered target platforms found.
```

## Quick Start

```bash
npx lockmatrix
```

Or audit a specific file or directory with custom targets or output format:

```bash
npx lockmatrix ./package-lock.json --targets github-actions --format human
npx lockmatrix . --targets linux-x64-glibc,win32-x64 --format json
npx lockmatrix . --format github
npx lockmatrix . --format sarif > lockmatrix.sarif
```

### CLI Options

| Flag | Description |
| :--- | :--- |
| `-f, --format <fmt>` | `human` (default), `json`, `github`, `sarif` |
| `-t, --targets <list>` | Comma-separated targets (`os-cpu` or `os-cpu-libc`) or presets: `default`, `github-actions`, `common-dev`, `linux-only` |
| `--fail-on <level>` | Minimum severity to exit `1`: `error` (default), `warn`, `info`, `none` |
| `-c, --config <path>` | Path to `lockmatrix.config.json` |
| `--verify-with-npm` | Opt-in: copies `package.json` + lockfile to an isolated temp dir and runs `npm ci --dry-run --ignore-scripts --os=... --cpu=... [--libc=...]` (may use network/cache) |
| `--max-file-bytes` | Maximum lockfile size in bytes (default: `104857600` / 100 MB) |
| `--max-packages` | Maximum package entries (default: `250000`) |

Exit codes: `0` clean, `1` findings at/above `--fail-on`, `2` usage or runtime error.

## Rules Reference

See [docs/RULES.md](docs/RULES.md) for full details and examples.

| Rule | Default Severity | Summary |
| :--- | :--- | :--- |
| `LM001` | `error` | Parent declares an `optionalDependencies` entry with no resolvable lockfile entry. Includes heuristic `inferred platform` label when recognizable from the package name suffix. |
| `LM002` | `error` | A platform-variant group (parent with `os`/`cpu`/`libc`-constrained optional deps) has no present entry satisfying a requested target platform. |
| `LM003` | `warn` | All platform-specific entries in the lockfile cover only a single `(os, cpu)` pair. |
| `LM004` | `info` | Summary coverage matrix (rows = platform-variant groups, columns = target platforms). |

## Configuration (`lockmatrix.config.json`)

Place an optional `lockmatrix.config.json` next to your `package-lock.json`:

```json
{
  "targets": ["linux-x64-glibc", "linux-arm64-glibc", "win32-x64", "darwin-arm64"],
  "ignorePackages": [
    {
      "name": "fsevents",
      "reason": "macOS-only file watcher; not needed on Linux or Windows"
    }
  ],
  "failOn": "error"
}
```

- `targets`: Array of target strings or presets.
- `ignorePackages`: Array of `{ name, reason }` objects. `reason` is required.
- `failOn`: One of `"error"`, `"warn"`, `"info"`, `"none"`.

## CI & Pre-Push Integration

### GitHub Actions (on PRs touching `package-lock.json`)

```yaml
name: Lockfile Platform Audit
on:
  pull_request:
    paths:
      - 'package-lock.json'
      - 'npm-shrinkwrap.json'

permissions:
  contents: read

jobs:
  lockmatrix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - run: npx --yes lockmatrix --format github
```

### Git `pre-push` Hook

```sh
#!/bin/sh
npx --no-install lockmatrix . || exit 1
```

## Does npm Still Have This Bug?

We tested npm `11.11.0` on Node `v24.13.0` (recorded in [docs/NPM-BEHAVIOR.md](docs/NPM-BEHAVIOR.md)):
- Fresh `npm install` of `esbuild` and `rollup` on npm `11.11.0` **did** record all 27 platform variants in `package-lock.json`.
- However, lockfiles generated by older npm versions (`npm/cli#4828`, `npm/cli#8320`), `--omit=optional` runs, or manual conflict merges still omit platform variants — and when `package-lock.json` is missing `@rollup/rollup-linux-x64-gnu`, `npm ci` fails with `EUSAGE: Missing: @rollup/rollup-linux-x64-gnu@4.68.8 from lock file`.

## Limitations

- **npm v2/v3 only**: Supports `package-lock.json` and `npm-shrinkwrap.json` with `lockfileVersion` `2` or `3`. `lockfileVersion: 1`, `yarn.lock`, and `pnpm-lock.yaml` are not supported (see [docs/LIMITATIONS.md](docs/LIMITATIONS.md)).
- **Name-suffix inference is a heuristic**: In `LM001`, platform hints like `(inferred platform: linux-x64-glibc)` are derived from package naming conventions and labeled `inferred`.
- **No registry metadata lookup**: In offline mode, `lockmatrix` cannot know the `os`/`cpu`/`libc` metadata of a package that is completely absent from the lockfile.

## FAQ

**Why not just run `npm ci` in CI?**
`npm ci` only checks the single OS/CPU of the runner executing it, fails late in CI (after checkout/setup), requires network/cache access, and can silently skip optional binaries when a dependency is absent rather than mismatched. `lockmatrix` checks all target platforms in one offline pass in milliseconds.

## Comparison with Existing Tools

See [docs/COMPETITORS.md](docs/COMPETITORS.md) for full details.

| Tool | Primary Focus | Multi-Target npm Lockfile Matrix | Offline / Zero-Dep |
| :--- | :--- | :--- | :--- |
| **lockmatrix** | Cross-platform optional dep coverage (`package-lock.json` v2/v3) | Yes | Yes |
| **lockfile-lint** | Registry host, HTTPS, and integrity hash validation | No | — |
| **syncpack** | `package.json` version consistency across monorepos | No | — |
| **pnpm `supportedArchitectures`** | Multi-arch resolution for `pnpm-lock.yaml` | pnpm only | — |
| **npm `ci --dry-run --os/--cpu`** | Single-target `npm ci` simulation | One target per run | Uses npm/network |

## License

[MIT](LICENSE)
