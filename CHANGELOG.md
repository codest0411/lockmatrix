# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-26

### Added
- Static npm `package-lock.json` / `npm-shrinkwrap.json` (v2/v3) parser and Node-style resolver (`Map`-based, prototype-pollution safe).
- Platform target matrix (`linux-x64-glibc`, `linux-x64-musl`, `linux-arm64-glibc`, `win32-x64`, `darwin-arm64`, `darwin-x64`) with presets and `os`/`cpu`/`libc` negation support.
- Rules `LM001` (missing optional dependency), `LM002` (uncovered target platform), `LM003` (single-platform lockfile warning), and `LM004` (coverage matrix).
- Output reporters: `human`, `json`, `github` (workflow-command escaped), and `sarif` (v2.1.0).
- Optional `lockmatrix.config.json` with strict schema validation.
- Opt-in `--verify-with-npm` mode using isolated temp directories and `execFile` (`shell: false`).
