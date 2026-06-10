---
name: job:find
description: Finds new jobs for the configured candidate profile, verifies each new lead at the source, updates the configured tracker Raw Pipeline, and suggests company research.
argument-hint: [keywords-or-filters]
---

Find new job leads for the configured candidate profile.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the resolved profile from the Profile Resolution rules below
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `strategy/sources.md`
8. `config/tracker-schema.md`
9. `config/next-actions.md`

Also get the current date and timezone from the execution environment or system context before adding leads or dates to the tracker.

Use `$ARGUMENTS` as additional search keywords or filters.

## Profile Resolution

1. Read the active profile from `config/settings.md`.
2. For new job discovery or untracked targets, use the active profile from settings.
3. For existing tracked vacancies, use the `Profile` value from the matching `data/tracker.md` row.
4. Treat all arguments as normal skill arguments; profiles are not passed in commands.

## Scope

This skill only finds **new** job leads and adds verified leads to `Raw Pipeline`.

Do not verify the full active pipeline here. Use `job:verify` for that.

If this skill is called by `job:run`, its next-action footer is advisory for the orchestrator and must not be treated as a user-facing stop point.

## Workflow

1. Read the configured tracker and collect existing company/role URLs to avoid duplicates.
2. Build a source checklist from `strategy/sources.md`.
3. Search every required source group unless the user explicitly narrows the request.
   - Use browser MCP, preferably Playwright MCP or Chrome DevTools MCP, for LinkedIn, Djinni, JavaScript-rendered boards, filters, login/session state, and sources marked Browser MCP in `strategy/sources.md`.
   - For those browser-required sources, do not use plain web search as a fallback.
   - If login is required, open the source in the browser and wait for the user to authenticate manually.
   - Use web search/API where that is faster and reliable.
   - Do not silently skip a source. Mark it `checked`, `partial`, or `skipped` with a reason.
4. For every promising lead, verify it at the source of truth:
   - company careers page
   - ATS board or API
   - browser MCP for JavaScript-rendered or logged-in sites
5. Apply the resolved profile's fit, reject, work-mode, and priority rules.
6. Reject low-fit roles and noisy sources explicitly.
7. Add each accepted lead to the configured `Raw Pipeline` table with the active profile in the `Profile` column.
8. For new companies without a `data/companies/[slug]/prep-notes.md`, suggest `job:company [company]`.

## Output

Reply in the configured assistant language and include:

- number of leads checked
- number of new leads added
- companies needing `job:company [company]`
- skipped leads only when the reason matters
- a required source report table from `strategy/sources.md`, showing where you looked, where you did not, method used, blockers, and findings
- a footer with `Active profile: <slug>` and context-specific `job:action` next actions using `config/next-actions.md`

Do not finish a broad search without the source report.
