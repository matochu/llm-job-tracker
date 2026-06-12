---
name: job-tracker:health
description: "Checks job-search workspace integrity, tracker/profile schema, orphan company artifacts, CV/PDF consistency, duplicate URLs, Session Reports, hook/install sync signals, and reports concrete fixes without doing search or preparation work."
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

Use it when the user asks whether the workspace is consistent, when tracker state looks suspicious, after large `job-tracker:run` batches, or before fixing confusing pipeline state.

## Version Check

Before running workspace checks, detect the install mode and check for an outdated installation.

First detect the mode by checking whether the `CLAUDE_PLUGIN_ROOT` environment variable is set (run `echo "$CLAUDE_PLUGIN_ROOT"`).

**Plugin mode** (`CLAUDE_PLUGIN_ROOT` is set):

1. Read the installed version from `$CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json` (the `version` field).
2. Get the latest published version: `gh release list --repo matochu/llm-job-tracker --limit 1` (or curl `https://api.github.com/repos/matochu/llm-job-tracker/releases/latest`). If it fails (offline or no `gh`), skip silently and note it.
3. If installed < latest:
   - Report as `warning` in the issue table.
   - Show what changed (read `CHANGELOG.md` entries newer than installed).
   - Tell the user to update the plugin: in Claude Cowork, open Plugins, remove and re-upload the latest zip from the GitHub release; in Claude Code CLI, reinstall from the marketplace/zip URL. The agent cannot self-update an installed plugin.

**Workspace mode** (`CLAUDE_PLUGIN_ROOT` is not set):

1. Read `config/.installed-version`. If the file is missing, report `warning: installed version unknown — workspace may predate version tracking`.
2. Run `npm view llm-job-tracker version --json` to get the latest published version. If the command fails (offline or npm unavailable), skip silently and note it.
3. Compare versions. If installed < latest:
   - Report as `warning` in the issue table.
   - Show relevant sections from `CHANGELOG.md` between the installed version and latest.
   - Propose: `npx llm-job-tracker update .`

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
6. Recommend narrow fixes. Do not apply fixes unless the user explicitly asks.

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

`Next actions` must contain only agent-runnable `job:*` actions. Manual user work, if any, belongs under `Manual user actions`.
