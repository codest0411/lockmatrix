# Known Limitations

1. **npm `lockfileVersion` 2 and 3 only**:
   - `lockfileVersion: 1` does not include the `packages` map with `os`/`cpu`/`libc` metadata and exits with code `2`.
   - `yarn.lock` and `pnpm-lock.yaml` are out of scope for MVP (parsing `pnpm-lock.yaml` cleanly requires a YAML parser, which would violate the zero-runtime-dependency constraint).
2. **Name-suffix inference is a heuristic (`LM001`)**:
   - When an optional dependency is completely absent from `package-lock.json`, `lockmatrix` does not query the npm registry in offline mode, so it cannot read the missing package's `package.json`. Platform hints are inferred strictly from common naming suffixes and are always labeled `inferred`.
3. **Optional dependencies intentionally omitted**:
   - If a project intentionally excludes a platform (e.g. `fsevents` on Linux/Windows), configure `ignorePackages` with a `reason` in `lockmatrix.config.json` or narrow `--targets`.
4. **`--verify-with-npm` depends on local npm & network/cache**:
   - `--verify-with-npm` invokes the installed `npm` CLI with `--dry-run --ignore-scripts --os=... --cpu=...` in an isolated temp directory. Older npm versions without `--os`/`--cpu` support will skip verification.
