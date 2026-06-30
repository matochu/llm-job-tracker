# Changelog

All notable changes to this project will be documented in this file.

This project follows semantic versioning.

## 0.4.2 - 2026-06-29

### Added

- `scripts/ats-probe.js` — reusable Node.js ATS probe for Ashby, Lever, Greenhouse, Workable, Recruitee, and SmartRecruiters. It normalizes role title/location/id/URL, filters frontend/product/fullstack/platform leads, and marks duplicates against `data/tracker.md`.
- `scripts/tracker.js` — structured Markdown tracker CLI for listing rows, adding Raw Pipeline leads, moving rows between sections, setting status, and bumping date fields without brittle text replacement.
- `scripts/ats-probe.js discover <company-or-domain>` — deterministic ATS slug discovery by probing supported provider APIs with normalized company/domain candidates.
- `scripts/tracker.js validate`, `--dry-run`, `--json`, and section-scoped row updates.
- Tracker CLI schema aliases for English and Ukrainian section/field labels, documented in `config/tracker-schema.md`.
- `scripts/tracker.js` exports `setSchemaRootFromTracker()` for programmatic callers that run outside the workspace cwd.
- `config/browser-patterns.md` — Browser MCP operational guide for stable evaluate calls, locator-based clicks, cookie overlays, login-required sources, and browser safety boundaries.
- `migrations/0.4.2.md` — seeds Browser MCP patterns and adds ATS probe/browser guidance to protected existing workspaces.
- Tests for ATS normalization/filtering/dedupe/discovery, tracker row operations/CLI flags, and run stop-check warnings.
- `README.md` — `## Agent CLI Utilities` section documenting ATS probe and tracker CLI commands, options, and usage patterns for agents and maintainers.

### Changed

- `job-tracker:find`, `job-tracker:import`, and `job-tracker:verify` now prefer `scripts/ats-probe.js` for supported ATS sources before ad hoc API parsing or browser fallback.
- `job-tracker:find` and `job-tracker:import` read `config/browser-patterns.md` at startup.
- `job-tracker:verify` reads `config/browser-patterns.md` at startup and prefers `scripts/ats-probe.js` for supported ATS liveness checks before browser fallback.
- `job-tracker:run` now explicitly prefers `scripts/tracker.js` for tracker row updates and requires profile switching through `job-tracker:profile use`.
- `job-tracker:run` completion rules now forbid `Status: done` while internal queue work remains, background subagents are still running, or skipped selected leads lack tracker-recorded real reasons.
- `job-tracker:run` orchestrator enforces "tool call before text" as a hard rule when state is `running`; a text-only response is invalid unless state is `paused-resumable`, `blocked`, or `done`. `Next internal step:` written without an accompanying tool call is now documented as a stop-point anti-pattern.
- `job-tracker:fit` documents parallel batch fit-review behavior for `job-tracker:run` when subagents are available.
- `strategy/sources.md` documents canonical `scripts/ats-probe.js` probe commands in the ATS section as the preferred alternative to ad hoc `curl`/`jq` parsing.
- Stop hook now warns when a `job-tracker:run` response reports `done` without completion-guard evidence or mentions background/subagent work without `paused-resumable`, `Continue Run`, or `Next internal step:`.
- Stop hook generic reminders now only appear for job-tracker-like outputs, and run-done detection is scoped to `job-tracker:run` context.
- `scripts/llm-hooks/validate-skill-footers.js` now checks `skills/run/SKILL.md` for required run completion guards (`internal action queue is empty`, `no background subagent`, `every skipped selected lead has a reason recorded`, `never \`done\``, `Continue Run`).
- `scripts/llm-hooks/codex-rules/default.rules` uses `npm run validate:skill-footers` instead of the direct node invocation.
- `scripts/check-workspace.js` now loads tracker section and field aliases from `config/tracker-schema.md` before parsing `data/tracker.md`, enabling localized or custom column labels without code changes.

### Fixed

- Run orchestration now documents `paused-resumable` as the required visible state when a turn must end while background subagent work can continue automatically.
- Angular/non-React stack assumptions are explicitly forbidden as invented skip reasons unless the active profile says so.

## 0.4.1 - 2026-06-16

### Fixed

- Preserve legacy `scripts/resume.css` during workspace update so the next migration can move user-customized PDF CSS to `scripts/cv.css` instead of losing it before `job-tracker:health` runs.
- `migrations/0.4.1.md` migrates existing workspaces from `scripts/resume.css` to `scripts/cv.css` and updates the protected `config/paths.md` reference.

## 0.4.0 - 2026-06-14

### Added

- `job-tracker:import <url>` — new command: imports one job posting URL into Raw Pipeline. Verifies the posting at source (browser MCP for JS-rendered/login pages), auto-selects the best-fit profile across all configured profiles and switches to it (asking on tie), derives `Source` from the URL host (ashby/greenhouse/lever/linkedin/workable/etc.), and writes a per-import session report at `.sessions/reports/[id].import.md`. Deduplicates against existing tracker URLs and best-effort recent import reports.
- Fit Rubric — `strategy/criteria.md` now contains `## Fit Rubric`: a three-layer model (Hard Gates PASS/DISQUALIFIED/UNRESOLVED → six-dimension /60 fit score → Application ROI modifier), six dimensions with 1/3/5 anchors, and a per-dimension evidence matrix with `Unknown → 3, never fabricate` rule. `skills/fit/SKILL.md` updated to apply the rubric with Hard Gates before scoring and ROI as a recommendation modifier only.
- Session report filename generalized to `[id].<skill>.md` (`[id].run.md` for run, `[id].import.md` for import). `check-workspace` now accepts any kebab-case skill suffix; blocked import reports are not flagged as unfinished runs.
- `migrations/0.4.0.md` — three idempotent migration steps for existing workspaces: (1) add `## Fit Rubric` to `strategy/criteria.md`, (2) update session-report path in `config/paths.md` to `[id].<skill>.md`, (3) update profile-switch exception in `config/settings.md` to name both `job-tracker:run` and `job-tracker:import`.

### Changed

- `job-tracker:import` is now the second skill (besides `job-tracker:run`) allowed to switch the active profile via `job-tracker:profile use`. Profile switch rules updated in `skills/profile/SKILL.md`, `config/settings.md`, `README.md`, and `config/agent-instructions.md` to distinguish: `run` takes a slug argument; `import` takes no slug and auto-selects best-fit.
- `config/session-reports.md`: filename convention generalized; resume/Continue Run logic scoped to `Skill: job-tracker:run` reports only.

## 0.3.2 - 2026-06-14

### Added

- Network source layer: `job-tracker:find network` discovers opportunities from local referral/contact sources, and `job-tracker:company` checks local network sources before LinkedIn contact research.
- `data/network/` as the canonical gitignored location for private contact/referral data, with committed `README.md` and `.gitkeep`.
- `Source` column for Raw Pipeline entries, including `network` for leads discovered through local contact sources.
- `migrations/0.3.2.md` — creates `data/network/`, adds the Raw Pipeline `Source` column, and adds network/referral paths to `config/paths.md`.

## 0.3.1 - 2026-06-13

### Added

- Fit score bands and apply/skip verdict thresholds in search profiles (`## Fit Score Bands` in each profile); `job-tracker:fit` now outputs a structured Verdict + Recommendation based on profile thresholds (defaults: strong apply ≥45/60, apply with tailoring 35–44, low ROI <35).
- Migration mechanism for protected-zone evolution: CLI seeds missing files on init and update; `job-tracker:health` applies idempotent in-file migrations from `migrations/<version>.md` with confirmation; version markers `config/.installed-version` (CLI) and `config/.migrated-version` (health); works in plugin and workspace mode.
- `migrations/0.3.1.md` — first migration: adds `## Fit Score Bands` to existing profiles, seeds `candidate/application-answers.md` in plugin mode, updates `config/paths.md` references.

### Fixed

- Partial migration failure no longer bumps `config/.migrated-version`; health stops on first failed step and reports the exact failure so re-runs are safe.
- Seed steps skipped because source is missing are treated as failures (not satisfied); version marker is not bumped.
- `bin/job-tracker.js`: unused `readFileSync` import removed; `seedIfMissingEntries` now creates parent directories before copying.

## 0.3.0 - 2026-06-13

### Added

- Reusable, profile-aware application answer bank (`candidate/application-answers.md`) read by `apply` and `draft`, appended after confirmed applications; profile-specific rows override `all` rows for the same field.
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
