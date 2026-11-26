# Contributing to lockmatrix

Thank you for your interest in contributing!

## Development Setup

Requirements: Node.js >= 22 (non-EOL LTS lines: 22, 24, 26).

```sh
git clone https://github.com/chirag127/lockmatrix.git
cd lockmatrix
npm ci
```

## Checks

Run all checks locally before opening a pull request:

```sh
npm run lint
npm run typecheck
npm run build:types
npm run test:coverage
```

## Constraints

- **Zero runtime dependencies**: `lockmatrix` uses Node.js built-ins only.
- **ESM + JSDoc types**: Keep modules small, well-documented, and `tsc --checkJs` clean.
- **Security**: Never use `eval`, `new Function`, `exec`, or `shell: true`. Treat lockfile inputs as untrusted.
