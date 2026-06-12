---
name: job:health
description: Checks job-search workspace integrity, tracker/profile schema, orphan company artifacts, CV/PDF consistency, duplicate URLs, Session Reports, hook/install sync signals, and reports concrete fixes without doing search or preparation work.
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

Use it when the user asks whether the workspace is consistent, when tracker state looks suspicious, after large `job:run` batches, or before fixing confusing pipeline state.

## Workflow

1. Run `node scripts/check-workspace.js`.
2. Run these validators when available:
   - `python3 scripts/llm-hooks/validate_tracker_profiles.py`
   - `python3 scripts/llm-hooks/validate_skill_footers.py`
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
- footer with `Active profile: <slug>` and context-specific `job:action` next actions from `config/next-actions.md`

`Next actions` must contain only agent-runnable `job:*` actions. Manual user work, if any, belongs under `Manual user actions`.
