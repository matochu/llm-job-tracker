# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## 0.3.0 - 2026-06-13

### Added

- Plugin distribution as a Claude Code / Cowork plugin zip, built via `npm run build:plugin` and published as a GitHub release asset.
- Interactive `scripts/install.js` prompt (TTY) with non-TTY default to `all` for CI/npx use.
- Version tracking: CLI writes `config/.installed-version` on every init/update so agents can detect and propose upgrades.
- Pipeline Board section in `job-tracker:status` output.
- PDF import step in `job-tracker:setup` interactive onboarding (step 0).
- CSS customization guidance in `job-tracker:setup` (step 9).
- Version check step in `job-tracker:setup` that detects plugin vs workspace mode.

### Changed

- Renamed all skill directories: `job-run` → `run`, `job-setup` → `setup`, etc. Commands are now `/job-tracker:run`, `/job-tracker:setup`, and so on, consistent between plugin and npx workspace modes.
- Renamed `scripts/resume.css` to `scripts/cv.css`; neutralized accent color and default styles so the file is a candidate-customizable starting point.
- `style/cv-style.md` neutralized — personal style rules removed.
- Plugin and npx workspace now share identical skill commands; no build-time namespace transforms needed.
- Stale skill directories (`job-*`) are now pruned from `skills/`, `.claude/skills`, and `.codex/skills` on update and install.
- `update` no longer overwrites `scripts/cv.css` (user-customizable); `init` copies it once.

### Removed

- `scripts/resume.css` (replaced by `scripts/cv.css`).

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
