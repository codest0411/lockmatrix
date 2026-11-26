# Security Review Checklist (`lockmatrix`)

This document records the self-audit performed against the Section 5 security requirements.

## Threat Model

`lockmatrix` parses untrusted `package-lock.json` files (e.g. from forked Pull Requests in CI) and formats findings to terminals, JSON, SARIF, and GitHub Actions workflow annotations.

## Checklist

- [x] **Untrusted input size & count limits** (`src/lockfile.js`):
  - `stat.size` is checked against `maxFileBytes` (default 100 MB) before reading into memory, and `Buffer.byteLength` is checked in `parseLockfileContent`.
  - Package entry count is bounded by `maxPackages` (default 250,000).
- [x] **No filesystem access from lockfile keys** (`src/resolve.js`, `src/lockfile.js`):
  - Lockfile keys and `resolved` paths (for `link: true` entries) are used exclusively as `Map` keys, never passed to `fs` APIs.
- [x] **Prototype-pollution safety** (`src/lockfile.js`, `src/rules/lm004.js`):
  - Parsed `packages`, `optionalDependencies`, and `dependencies` are stored in `Map` instances (or `Object.create(null)` for matrix cells).
  - Tested with `__proto__`, `constructor`, and `prototype` keys (`test/unit/security.test.js`).
- [x] **Output & terminal injection** (`src/sanitize.js`, `src/reporters/*.js`):
  - `stripControlChars` removes ANSI CSI/OSC/ESC sequences and C0/C1 control characters before printing.
  - `escapeGitHubMessage` and `escapeGitHubProperty` escape `%`, `\r`, `\n`, `::`, `:`, `,` in `--format github`.
- [x] **ReDoS safety** (`src/sanitize.js`, `src/platforms.js`):
  - Sanitization uses an $O(n)$ character-code loop with no backtracking regexes.
  - Tested with 100k-character adversarial input under a strict time budget.
- [x] **Safe subprocess execution in `--verify-with-npm`** (`src/verify-npm.js`):
  - Uses `execFile` with `shell: false`, argument arrays, `timeout`, and `maxBuffer` — never `exec` or `shell: true`.
  - Resolves `npm_execpath` or `npm-cli.js` via `process.execPath` on Windows (respecting Node's `.cmd` hardening).
  - Copies only `package.json` and the lockfile into a fresh `fs.mkdtempSync` directory and always removes it in `finally`.
- [x] **No dynamic code execution or runtime network calls**:
  - Zero `eval`, `new Function`, or dynamic `import()`/`require()` of user input (enforced by ESLint `no-eval`, `no-implied-eval`, `no-new-func`).
  - Zero runtime dependencies (`package.json` has no `dependencies` field).
- [x] **Supply-chain & CI hardening** (`.github/workflows/*.yml`):
  - GitHub Actions pinned to full 40-char commit SHAs with least-privilege `permissions:`.
  - CodeQL, Dependabot (npm + github-actions), `--provenance` release workflow, and `"files"` allowlist in `package.json`.
