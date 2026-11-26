# Rules Reference

## `LM001` — Missing Optional Dependency (`error`)

Triggered when a package in `package-lock.json` declares an entry in `optionalDependencies`, and Node's module resolution order inside the lockfile finds **no** matching entry in `packages`.

If the missing package name ends with a recognizable platform suffix (e.g. `-linux-x64-gnu`, `-darwin-arm64`, `-win32-x64-msvc`) or is `fsevents`, `lockmatrix` appends `(inferred platform: <platform>)` as a labeled heuristic.

**Remediation (verify before running):**
Regenerate `package-lock.json` with a modern npm version without `--omit=optional` (for example, `rm -rf node_modules package-lock.json && npm install`).

---

## `LM002` — Uncovered Target Platform (`error`)

Triggered for a **platform-variant group** (a parent package that has at least one resolved optional dependency carrying `os`, `cpu`, or `libc` metadata) when **none** of its present optional dependencies satisfies a requested target platform.

Evaluates npm's `os`, `cpu`, and `libc` arrays including negations (e.g. `["!win32"]`).

**Remediation (verify before running):**
Regenerate `package-lock.json` without `--omit=optional`, or narrow `--targets` / `lockmatrix.config.json` if that platform is not targeted by your project.

---

## `LM003` — Single-Platform Lockfile (`warn`)

Triggered when all `os`/`cpu`/`libc`-constrained entries across the entire lockfile match only a single `(os, cpu)` pair (for example, only `darwin-arm64`). This usually indicates the lockfile was generated on a single developer machine with incomplete cross-platform resolution.

---

## `LM004` — Coverage Matrix (`info`)

Emits a summary matrix where rows are platform-variant groups, columns are requested targets, and each cell is `present` or `missing`.
