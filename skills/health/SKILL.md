---
name: job-tracker:health
description: "Workspace integrity lint and pending migrations: run when status flags issues, after large batches, or before release."
argument-hint:
---

Run a workspace health check.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the active profile from settings
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `config/tracker-schema.md`
8. `config/next-actions.md`

Also get the current date and timezone from the execution environment or system context before judging stale Session Reports or date-sensitive tracker state.

## Scope

This skill checks integrity. It does not perform job discovery, company research, manual message draft preparation, CV tailoring, fit review, PDF export, or outreach/application actions.

The one exception: health may seed missing protected-zone files (never overwriting existing ones) and apply in-file migrations from `migrations/<version>.md` — both gated by explicit user confirmation before any write. All other recommended fixes are reported only; the user applies them manually or by running the relevant skill.

Use it when the user asks whether the workspace is consistent, when tracker state looks suspicious, after large `job-tracker:run` batches, or before fixing confusing pipeline state.

## Version & Migration Check

Before running workspace checks, detect the install mode, check for an outdated installation, seed any missing protected-zone files, and apply pending in-file migrations.

First detect the mode by checking whether the `CLAUDE_PLUGIN_ROOT` environment variable is set (run `echo "$CLAUDE_PLUGIN_ROOT"`).

### Version check

**Plugin mode** (`CLAUDE_PLUGIN_ROOT` is set):

1. Read the installed version from `$CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json` (the `version` field). This is the **current code version**.
2. Get the latest published version: `gh release list --repo matochu/llm-job-tracker --limit 1` (or curl `https://api.github.com/repos/matochu/llm-job-tracker/releases/latest`). If it fails (offline or no `gh`), skip silently and note it.
3. If installed < latest:
   - Report as `warning` in the issue table.
   - Show what changed (read `CHANGELOG.md` entries newer than installed).
   - Tell the user to update the plugin: in Claude Cowork, open Plugins, remove and re-upload the latest zip from the GitHub release; in Claude Code CLI, reinstall from the marketplace/zip URL. The agent cannot self-update an installed plugin.

**Workspace mode** (`CLAUDE_PLUGIN_ROOT` is not set):

1. Read `config/.installed-version`. If the file is missing, report `warning: installed version unknown — workspace may predate version tracking`. Treat missing as `0.0.0` for migration purposes.
2. The value in `config/.installed-version` is the **current code version**.
3. Run `npm view llm-job-tracker version --json` to get the latest published version. If the command fails (offline or npm unavailable), skip silently and note it.
4. Compare versions. If installed < latest:
   - Report as `warning` in the issue table.
   - Show relevant sections from `CHANGELOG.md` between the installed version and latest.
   - Propose: `npx llm-job-tracker update .`

### Seed missing protected-zone files

Read `config/.migrated-version`. If missing, treat as `0.0.0`.

For each file in the seed list below, check existence in the workspace; if missing, create it by copying from the canonical source:

- `candidate/application-answers.md`
  - **Plugin mode:** copy from `$CLAUDE_PLUGIN_ROOT/candidate/application-answers.md`.
  - **Workspace mode:** the CLI already seeds this on init and update. If somehow missing, it should be present in the local `migrations/` or `candidate/` managed copy.

Never overwrite an existing file. Report each seeded file as `info` in the issue table.

Distinguish skip reasons:
- **Skipped — already present:** ok, counts as satisfied.
- **Skipped — not applicable (e.g. workspace mode for a plugin-only step):** ok, counts as satisfied.
- **Skipped — source missing or unresolvable:** not satisfied. Report as `warning`. Do **not** count this step as complete when deciding whether to bump `config/.migrated-version`.

### Apply pending in-file migrations

Determine the pending migration range: `(migrated-version, current-code-version]`.

Find available migration files: list `migrations/*.md` in the workspace (workspace mode) or `$CLAUDE_PLUGIN_ROOT/migrations/*.md` (plugin mode). Sort them by **semantic version** (numeric major.minor.patch comparison, not lexicographic string sort — `0.9.0` < `0.10.0`). Filter to those in the pending range (exclusive lower bound, inclusive upper bound).

If no pending migrations: skip silently.

If pending migrations exist:
1. Show the user a summary of which migration files will be applied and what each step does.
2. Ask for confirmation before applying.
3. Apply each migration file's steps in order, verifying each step's check condition before writing. Skip steps where the marker already exists (idempotent guard).
4. On the first step that cannot be applied (unexpected file structure, missing heading, write error, or source missing): stop immediately. Report the exact failed step. Do **not** update `config/.migrated-version`. The user can re-run `job-tracker:health` safely — already-applied steps will be skipped by their idempotent checks.
5. After all steps in all pending migration files either succeed or are skipped as "already present / not applicable": write the current code version to `config/.migrated-version`. If any step was skipped because its source was missing or unresolvable, do **not** bump the version — treat it the same as a failure.
6. Report each applied step as `info` in the issue table.

## Workflow

1. Run `node scripts/check-workspace.js`.
2. Run these validators when available:
   - `node scripts/llm-hooks/validate-tracker-profiles.js`
   - `node scripts/llm-hooks/validate-skill-footers.js`
3. Optionally run `node scripts/check-deps.js` only when the user asks for dependency/hook/MCP readiness too. Do not treat expected local MCP warnings as tracker integrity issues.
4. Inspect specific files only when needed to explain a reported issue.
5. Classify findings:
   - `critical`: blocks safe job workflow execution
   - `warning`: should be fixed soon but does not block
   - `info`: useful cleanup or drift notice
6. Recommend narrow fixes. Do not apply fixes unless the user explicitly asks. (Exception: migrations and seeding, covered in the Version & Migration Check section above.)

## Checks

Check for:

- missing or unknown `Profile` values in tracker rows
- tracker job tables missing or misplacing the `Profile` column
- duplicate job URLs
- company directories without matching tracker rows
- tracker rows with no expected company artifacts when status says prep/CV/PDF is ready
- `data/companies/*/prep-notes.md` missing when company artifacts exist
- manual draft status claims without `### Manual Message Drafts`
- `resume.md` without expected PDF, or PDF without `resume.md`
- empty base CV or company CV files
- active/listed profiles without profile files
- `.sessions/` is gitignored
- Session Report filenames use `[id].run.md`
- Session Reports contain required sections and valid status values
- old `running` or `blocked` Session Reports that may need resume or abandonment
- installed skill/footer validation drift

## Output

Reply in the configured assistant language and include:

- verdict: `pass`, `warning`, or `critical`
- issue table with severity, file/path, and fix
- what was checked
- what was not checked, if any
- recommended narrow fixes in priority order
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions from `config/next-actions.md`

`Next actions` must contain only agent-runnable `job-tracker:*` actions. Manual user work, if any, belongs under `Manual user actions`.
