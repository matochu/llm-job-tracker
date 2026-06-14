---
name: job-tracker:find
description: "Finds new jobs for the configured candidate profile, verifies each new lead at the source, updates the configured tracker Raw Pipeline, and suggests company research."
argument-hint: "[keywords-or-filters | network]"
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

Use `$ARGUMENTS` as additional search keywords or filters. If the argument is `network`, run the network source discovery flow (see `## Network Mode` below) instead of the standard source checklist.

## Profile Resolution

1. Read the active profile from `config/settings.md`.
2. For new job discovery or untracked targets, use the active profile from settings.
3. For existing tracked vacancies, use the `Profile` value from the matching `data/tracker.md` row.
4. Treat all arguments as normal skill arguments; profiles are not passed in commands.

## Scope

This skill only finds **new** job leads and adds verified leads to `Raw Pipeline`.

Do not verify the full active pipeline here. Use `job-tracker:verify` for that.

If this skill is called by `job-tracker:run`, its next-action footer is advisory for the orchestrator and must not be treated as a user-facing stop point.

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
8. For new companies without a `data/companies/[slug]/prep-notes.md`, suggest `job-tracker:company [company]`.

## Network Mode

When called as `job-tracker:find network`, skip the standard source checklist and run the network discovery flow defined in `strategy/sources.md` under `## Network Sources → job-tracker:find network`.

Discovery flow:
1. Read and normalize all available network sources from `data/network/` and legacy `docs/*referrals*.md` / `docs/*network*.md`.
2. If no network sources are found, report `no local network sources found` and stop.
3. Group normalized contacts by company (case-insensitive, suffix-tolerant matching).
4. Apply the active profile's fit/reject rules to each company group. Discard companies that clearly violate reject rules (wrong industry, company type, etc.).
5. For each qualifying company **not yet in the tracker**: verify whether an active relevant role exists — check the company careers page or ATS (web search or browser MCP). This step is required; do not add companies to the tracker without role verification.
   - **Active role found:** add to Raw Pipeline with role, URL, `Source: network`, and active profile. Suggest `job-tracker:company [company]` as next action.
   - **No active role but useful contact exists:** add to Monitoring (not Raw Pipeline) with `Notes: source: network; contacts: [names]`. Do not invent a role or URL.
   - **Company inaccessible / careers page down:** note in output summary as `unverified`; do not add to tracker.
6. For qualifying companies **already in the tracker**: surface as warm intro opportunities in the summary — no tracker change.

Network mode does not run the standard LinkedIn Jobs / ATS / VC board / Djinni pass. If the user wants both, they run `job-tracker:find` (standard) and `job-tracker:find network` separately.

Output includes: network sources read, total contacts found, companies verified, new Raw Pipeline entries, new Monitoring entries, warm intro opportunities at existing tracked companies, and the standard footer.

## Output

Reply in the configured assistant language and include:

- number of leads checked
- number of new leads added
- companies needing `job-tracker:company [company]`
- skipped leads only when the reason matters
- a required source report table from `strategy/sources.md`, showing where you looked, where you did not, method used, blockers, and findings
- a footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions using `config/next-actions.md`

Do not finish a broad search without the source report.
