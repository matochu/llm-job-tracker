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
3. `config/profile-resolution.md`, then the profile it resolves to
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `config/tracker-schema.md`
8. `config/next-actions.md`
9. `config/browser-patterns.md`
10. `config/source-registry.md`

Also get the current date and timezone from the execution environment or system context before writing verification or archive dates.

## Profile Resolution

Follow `config/profile-resolution.md`.

## Scope

This skill re-checks liveness of tracked roles at source. It does not do job discovery, company research, outreach drafting, CV tailoring, fit scoring, or PDF export. Use the corresponding `job-tracker:*` skill to act on findings.

## Workflow

1. Read the configured tracker.
2. Identify roles to check:
   - default: active pipeline
   - if requested: Raw Pipeline, Staging, one company, or one priority group
3. For each role:
   - for liveness of an existing tracked role, open the direct job URL with browser MCP, preferably Playwright MCP
   - read the live page title after navigation; common active signals include the full role title or `<Job Title> @ <Company>`
   - classify closed when the direct URL returns a clear not-found page, redirects to a generic board/index, has an empty/non-job title, or shows closed text such as `Position Closed`
   - take a browser snapshot or inspect visible page text only when the title/redirect is ambiguous
   - do not use ATS board/listing APIs for liveness of a specific job ID; board APIs are discovery surfaces and may omit active roles that are paused, unlisted, hidden, or not featured
   - do not use WebFetch as a substitute for direct job URL liveness; it may miss rendered state, redirects, login/session behavior, or stale/cache-sensitive content
   - use `node scripts/ats-probe.js ...` only for new role discovery from supported ATS boards, never as the closing signal for a tracked direct job URL
   - use browser MCP for tracked direct job URLs; source-specific browser/login policies live in `config/source-registry.md`
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
   - use `node scripts/tracker.js move`, `set-status`, or `bump-date` for supported tracker mutations
   - direct Markdown table edits are allowed only when `node scripts/tracker.js ...` does not support the needed operation, such as restoring a moved row or complex multi-field updates
6. Suggest `job-tracker:company [company]` when an active role has no prep notes.

## Output

Reply in the configured assistant language and include:

- roles checked
- active / closed / unclear counts
- exact tracker changes made
- roles needing login or manual verification
- highest-signal issues and the responsible `job-tracker:action` for each fix
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions using `config/next-actions.md`
