# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## 0.2.0 - 2026-06-12

### Changed

- Converted workspace checks, dependency checks, installer, and LLM hooks from shell/Python helpers to Node.js scripts.
- Added idempotent CLI behavior: `llm-job-tracker` defaults to the current directory and automatically initializes or updates a workspace.
- Added managed update support that refreshes reusable workflow files while preserving candidate data, search profiles, sources, tracker data, settings, language, and paths.
- Updated Claude/Codex hook installation to use JavaScript hooks and preserve local Claude settings while refreshing managed hooks.

### Removed

- Removed shell-based install/check scripts and Python hook/check helpers from the public package.
- Removed public starter export tooling; public package scaffolding and update are handled by the CLI.

## 0.1.0 - 2026-06-11

### Added

- Initial `llm-job-tracker` npm scaffold.
- Local-first job-search workspace for Claude, Codex, and other LLM agents.
- Config, candidate, strategy, style, templates, and data workspace zones.
- `job:*` skill workflows for search, verification, company research, drafts, CV tailoring, fit review, stories, PDF export, health checks, setup, and application preparation.
- Claude/Codex project integration installer and conservative LLM hooks.
- Public safety checks for private data, stale paths, and package contents.
