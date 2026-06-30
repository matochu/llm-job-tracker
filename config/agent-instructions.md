# Agent Guide

This repository is a configurable job-search workspace. The skills in `skills/` are generic workflows; candidate-specific behavior lives in the `config/`, `candidate/`, `strategy/`, `style/`, and `templates/` zones.

If a tool expects skills in a tool-specific directory, use `node scripts/install.js` to install local symlinks or copies from the canonical `skills/` directory.

Minimal LLM command hooks live in `scripts/llm-hooks/`. `node scripts/install.js` syncs `.codex/hooks.json` and `.codex/rules/`, and only creates `.claude/settings.json` when local Claude settings are missing.

Use `node scripts/check-deps.js` when hook, script, or PDF dependencies need verification.

Read `config/settings.md` before job-search skills that depend on positioning or search strategy. New job discovery uses the active profile from settings. Existing tracked vacancies use the `Profile` value stored in `data/tracker.md`.

Search-specific targets, fit signals, reject rules, priority rules, application strategy, and positioning live in profiles, not in `candidate/candidate.md` or `strategy/criteria.md`.

## Default Behavior

- At the start of each skill run, get the current date and timezone from the execution environment or system context. Use that date for tracker updates, verification dates, Session Reports, and generated status summaries.
- Read `config/language.md` before producing user-facing or document-facing output.
- Default user replies are in Ukrainian.
- CVs, cover letters, and manual message drafts are in English unless the user asks otherwise.
- Keep edits narrow and preserve user-authored notes.
- Do not invent experience, metrics, contacts, or job requirements.

## Hard Rules

- Do not bypass `job-tracker:*` skills by writing their expected artifacts directly.
- Company research sections in `data/companies/*/prep-notes.md` must be produced through `job-tracker:company`.
- `### Manual Message Drafts` must be produced through `job-tracker:draft`.
- Having research, contact, or draft data already in context is not a valid reason to skip the relevant skill.
- `job-tracker:run` must call the relevant `job-tracker:*` skill instead of reconstructing that skill's output manually.
- Never mark outreach, applications, LinkedIn messages, connection requests, or email as sent/submitted unless the user explicitly says they did it outside the tool and asks to update status.
- `job-tracker:apply` is the only workflow that may submit an ATS/job application from the browser, and only after explicit user confirmation in the same run. It must never send LinkedIn messages, connection requests, emails, or referral outreach.

## Configuration Files

- `candidate/candidate.md` — candidate identity, contacts, real skills, and hard constraints.
- `config/settings.md` — active profile and profile selection rules.
- `config/language.md` — reply/document language rules.
- `config/paths.md` — tracker, company notes, CV, PDF generator paths.
- `strategy/criteria.md` — shared scoring labels and tracker row format.
- `strategy/sources.md` — job-search sources and verification rules.
- `config/tracker-schema.md` — tracker sections and update rules.
- `config/source-registry.md` — source values, host patterns, ATS probe providers, and browser-required source policy.
- `style/outreach-style.md` — message tone and templates strategy.
- `style/cv-style.md` — CV house style and review rules.
- `candidate/stories.md` — factual STAR story bank for interview preparation.
- `candidate/application-answers.md` — profile-aware reusable answer bank for ATS forms and outreach; read by `apply` and `draft`, appended after confirmed applications.
- `config/session-reports.md` — Session Report format, paths, and lifecycle.
- `strategy/search-profiles/*.md` — named profiles with fit/reject/priority rules.

## Skill Map

- `job-tracker:find` — find new leads, verify them at source, add to Raw Pipeline. Use `job-tracker:find network` to discover leads from local contact sources in `data/network/`.
- `job-tracker:import` — import one job posting URL: verify at source, auto-select the best-fit profile (switches active profile to it, asking on ties), derive Source from the URL host, and add a verified row to Raw Pipeline. Writes a per-import session report at `.sessions/reports/[id].import.md`.
- `job-tracker:setup` — run the first-step interactive readiness check before `job-tracker:run`.
- `job-tracker:health` — check tracker/profile/company/CV/PDF consistency, seed missing protected-zone files, and apply pending in-file migrations from `migrations/<version>.md` with confirmation.
- `job-tracker:run` — orchestrate the full search/prep/draft/CV/fit/stories/PDF path with frequent tracker updates and final summary; owns its own intake/prep/final reviewer gates.
- `job-tracker:verify` — liveness re-check of tracked roles at source; classifies active, closed, or unclear and narrows tracker updates.
- `job-tracker:company` — research one company, roles, ATS, contacts, tech stack, prep notes.
- `job-tracker:draft` — prepare recruiter/engineering/referral manual message drafts and save them in prep notes.
- `job-tracker:status` — home base: pipeline state, top priorities, and what to do next.
- `job-tracker:profile` — show, switch, validate, add, or remove profile configuration.
- `job-tracker:cv` — create or update company-specific Markdown CV.
- `job-tracker:fit` — score a CV against a vacancy via subagent when supported and suggest edits.
- `job-tracker:stories` — maintain and map factual STAR stories for interview preparation.
- `job-tracker:pdf` — export Markdown CV/cover letter to PDF.
- `job-tracker:apply` — scout, prepare, fill, and optionally submit an ATS application after explicit user confirmation.

## Porting To Another Candidate

To reuse these skills for another person:

1. Replace `candidate/candidate.md`.
2. Replace or create `strategy/search-profiles/*.md`.
3. Update `config/settings.md` to point at the active profile.
4. Adjust `config/language.md`.
5. Adjust `strategy/sources.md`.
6. Update `config/paths.md` if the repository layout differs.
7. Replace or adapt base CV files referenced from `paths.md`.

The skill files should not need candidate-specific edits.

## Tracker Rules

- The tracker path is configured in `paths.md`.
- Job tables must include a `Profile` column.
- New leads must store the active profile in the `Profile` column. `job-tracker:import` writes the row under the auto-selected best-fit profile (which it switches active before writing, so the row always matches the active profile at write time).
- For tracked vacancies, skills must use the row's `Profile` value instead of the active profile.
- Add unresearched new leads to Raw Pipeline first.
- Move researched, active, prioritized roles to the active pipeline.
- Move closed/disappeared roles to Archive with date and reason.
- Move useful companies without active relevant roles to Monitoring.

## Session Reports

- Long-running skills may write one Session Report per pass; the report is the resumable source of truth. `job-tracker:run` must write one. `job-tracker:import` writes a single-pass report per import (`[id].import.md`). Resume / Continue Run logic applies only to `job-tracker:run` reports; a blocked import report is an import snapshot, not a resumable run.
- Format, paths, and lifecycle live in `config/session-reports.md`.
- `.sessions/` is runtime output and is gitignored; do not commit it.
- The latest report is the newest file by timestamp; there is no index or `current` pointer.

## Browser / Sources

- Source values, host patterns, ATS probe providers, and browser-required source policy live in `config/source-registry.md`.
- Use browser MCP only for sources marked browser-required in `config/source-registry.md`, JavaScript-rendered ATS pages, browser filters, and sources that need login/session state. Follow each source's `Required access` policy; LinkedIn and Djinni require Playwright MCP with the user's logged-in account/session.
- If login is required, open the page in the browser and wait for the user to log in manually.
- Do not replace sources marked browser-required in `config/source-registry.md` with plain web search snippets.
- Outreach workflows prepare manual message drafts only and save them in prep notes. The user writes/sends manually. Do not send connection requests, emails, or LinkedIn messages from these skills.
- ATS/job application submission is allowed only through `job-tracker:apply` after explicit user confirmation in the same run.
- When `job-tracker:company` finds useful contacts, run `job-tracker:draft [company]` after saving prep notes so manual message drafts are prepared immediately. If another skill cannot run in the same turn, make `job-tracker:draft [company]` the first next action.

## PDF Export

- Use the configured PDF generator and naming rules from `paths.md`.
- Verify that generated PDFs exist and are valid.

## Next Actions

- Skills should end with a concise, context-specific `Next actions` footer when useful.
- Footer must include the active profile, for example `Active profile: frontend`.
- User-facing next actions should use `job-tracker:action` commands, such as `job-tracker:find`, `job-tracker:company ExampleCo`, `job-tracker:cv ExampleCo`, `job-tracker:draft ExampleCo`, `job-tracker:stories ExampleCo`, `job-tracker:apply ExampleCo`, `job-tracker:health`, `job-tracker:verify`, and `job-tracker:status`.
- Generate shortcuts dynamically using `config/next-actions.md`; do not treat shortcut hints as a fixed menu.
- Show only relevant actions for the current result; do not show the full action dictionary.
- Wait for the user to choose an action before running another workflow.
- Exception: internal child-skill steps inside `job-tracker:run` are not user-facing next actions. `job-tracker:run` should continue through its run plan until final summary or a hard blocker.
