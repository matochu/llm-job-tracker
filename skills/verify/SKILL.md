---
name: job-tracker:verify
description: "Liveness re-check of tracked roles at source: classifies active, closed, or unclear, and narrows tracker updates."
argument-hint: "[company-or-section]"
---

Re-check whether tracked roles are still live at their source.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the resolved profile from the Profile Resolution rules below
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `config/tracker-schema.md`
8. `config/next-actions.md`

Also get the current date and timezone from the execution environment or system context before writing verification or archive dates.

## Profile Resolution

1. Read the active profile from `config/settings.md`.
2. For new job discovery or untracked targets, use the active profile from settings.
3. For existing tracked vacancies, use the `Profile` value from the matching `data/tracker.md` row.
4. Treat all arguments as normal skill arguments; profiles are not passed in commands.

## Scope

This skill re-checks liveness of tracked roles at source. It does not do job discovery, company research, outreach drafting, CV tailoring, fit scoring, or PDF export. Use the corresponding `job-tracker:*` skill to act on findings.

## Workflow

1. Read the configured tracker.
2. Identify roles to check:
   - default: active pipeline
   - if requested: Raw Pipeline, Staging, one company, or one priority group
3. For each role:
   - open the URL or source board
   - prefer company/ATS source of truth over search snippets
   - use browser MCP, preferably Playwright MCP or Chrome DevTools MCP, for LinkedIn, Djinni, JavaScript-rendered boards, and logged-in sites
   - if login is required, open the site in the browser and wait for the user to authenticate manually
   - do not use plain web search as a fallback for browser-required checks
4. Classify status:
   - active and relevant to the resolved profile
   - active but weak fit or needs clarification
   - closed / disappeared / redirects to generic board
   - inaccessible / needs manual login
5. Update the tracker narrowly:
   - keep active roles in active pipeline
   - move closed roles to Archive with date and reason
   - move companies with useful contacts but no active role to Monitoring
   - update checked/updated dates
6. Suggest `job-tracker:company [company]` when an active role has no prep notes.

## Output

Reply in the configured assistant language and include:

- roles checked
- active / closed / unclear counts
- exact tracker changes made
- roles needing login or manual verification
- highest-signal issues and the responsible `job-tracker:action` for each fix
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions using `config/next-actions.md`
