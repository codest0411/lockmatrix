# Existing Tools & Competitors (Phase 0 Research)

This document compares `lockmatrix` against existing tools in the npm/JavaScript ecosystem.

| Tool | Link | What it does | What it does NOT do |
| :--- | :--- | :--- | :--- |
| **lockfile-lint** | https://github.com/lirantal/lockfile-lint | Validates lockfile security properties: allowed registry hosts, HTTPS schemes, and integrity hashes for `package-lock.json`, `npm-shrinkwrap.json`, and `yarn.lock`. | Does not inspect `optionalDependencies`, `os`/`cpu`/`libc` metadata, or cross-platform coverage. |
| **syncpack** | https://github.com/JamieMason/syncpack | Enforces consistent dependency version ranges and formatting across `package.json` files in monorepos/polyrepos. | Does not audit `package-lock.json` entries or platform-specific optional dependencies. |
| **pnpm `supportedArchitectures`** | https://pnpm.io/settings#supportedarchitectures | Configures pnpm to resolve and store optional dependencies for multiple `os`/`cpu`/`libc` targets in `pnpm-lock.yaml`. | Specific to pnpm; does not audit existing npm `package-lock.json` / `npm-shrinkwrap.json` files. |
| **npm `ci --dry-run --os/--cpu/--libc`** | https://docs.npmjs.com/cli/commands/npm-ci | Simulates `npm ci` for a single `--os`, `--cpu`, and `--libc` combination and reports missing lockfile entries (`EUSAGE`). | Runs one target per invocation, requires npm CLI execution (and potentially registry/cache access), and does not output a multi-target matrix, SARIF, or GitHub PR annotations. |

## Honest Differentiation

`lockmatrix` fills a narrow, specific gap: **offline, static, multi-target platform coverage auditing for npm `package-lock.json` and `npm-shrinkwrap.json` (v2/v3)**. Security linters like `lockfile-lint` check *where* packages come from, monorepo tools like `syncpack` check `package.json` version alignment, and `pnpm` solves multi-arch resolution within its own lockfile format. For npm projects, the only built-in alternative is running `npm ci --dry-run` separately for every target OS/CPU/libc combination; `lockmatrix` performs that cross-platform check in a single offline pass with zero runtime dependencies and CI-native outputs (JSON, GitHub Actions annotations, SARIF).
