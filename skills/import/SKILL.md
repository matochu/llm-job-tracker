---
name: job-tracker:import
description: "Imports a single job posting URL: canonicalizes it, verifies at source, auto-selects and switches to the best-fit profile, and adds a verified lead to Raw Pipeline with the correct Source."
argument-hint: "<url>"
---

Import one job posting URL into the tracker.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md` (active profile + Available Profiles list)
3. all `strategy/search-profiles/*.md` (for profile auto-selection)
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `strategy/sources.md`
8. `config/tracker-schema.md`
9. `config/session-reports.md`
10. `config/next-actions.md`

Also get the current date and timezone from the execution environment before writing tracker rows or session reports.

## Profile Resolution

`import` does **not** take a profile slug as an argument. It auto-selects the best-fit profile from all configured profiles and switches to it (asking the user on ties). See `## Profile Auto-Selection` below. Treat all arguments as the posting URL only.

## Scope

This skill imports one verified posting. It does not run a broad source search, does not produce a source report, and never marks anything applied, sent, or submitted. A blocked import report (login required) is **not** a resumable run — the next action is to re-run `job-tracker:import <url>` after logging in.

If this skill is called by `job-tracker:run`, its next-action footer is advisory for the orchestrator.

## Source Derivation

Before anything else, canonicalize the URL: lowercase the host, strip tracking parameters (`utm_*`, `ref`, `gh_src`, `source`, `rl`), and remove trailing slashes. Derive the `Source` value from the canonical host:

| Host pattern | Source value |
|---|---|
| `jobs.ashbyhq.com` | `ashby` |
| `*.greenhouse.io`, `job-boards*.greenhouse.io`, `boards.greenhouse.io` | `greenhouse` |
| `jobs.lever.co` | `lever` |
| `*.linkedin.com` | `linkedin` |
| `apply.workable.com` | `workable` |
| `*.recruitee.com` | `recruitee` |
| `*.smartrecruiters.com` | `smartrecruiters` |
| `*.teamtailor.com` | `teamtailor` |
| `jobs.wellfound.com`, `wellfound.com` | `wellfound` |
| `otta.com`, `app.otta.com` | `otta` |
| `djinni.co` | `djinni` |
| other company careers host | bare root domain (e.g. `careers.acme.com` → `acme`) |

## Profile Auto-Selection

No slug is passed. Import picks the best-fit profile among all configured profiles using a coarse signal match (not the full `/60` rubric; that is `job-tracker:fit` later):

1. Normalize the role: title, level, domain, work mode, location.
2. For each profile in `Available Profiles`, score fit-signal overlap against its **Target Role Families**, **Strong/Medium Fit Signals**, and **Reject / Low ROI** rules.
3. Eliminate profiles whose Reject rules clearly hit.
4. Resolve:
   - **Single clear best-fit == active profile:** no switch; continue.
   - **Single clear best-fit ≠ active profile:** switch via `job-tracker:profile use <slug>`. Show the choice and reason in the reply and session report `Decisions`.
   - **Ambiguous (2+ near-tied):** stop and ask the user which profile to use, then switch if needed and continue.
   - **Only one profile configured:** use it (no switch needed).
5. Record the selected profile, runners-up, reason, and any switch in the session report `Decisions`.
6. If the selected profile differs from an existing same-company row in the tracker, surface the divergence — do not silently produce conflicting Profile values for the same company.

## Workflow

1. Get current date and timezone.
2. Resolve URL from `$ARGUMENTS`. If missing, ask once. Canonicalize and derive `Source`.
3. **Dedup check**: compare the canonical URL against all URLs in `data/tracker.md`. Also check recent `.sessions/reports/*.import.md` for a matching URL (best-effort). If a duplicate is found: write session report with `Status: done`, `Decision: duplicate` pointing to the existing tracker row; do not mutate the tracker; report the duplicate to the user and stop.
4. **Verify at source of truth**: fetch the posting. Use browser MCP (Playwright MCP or Chrome DevTools MCP preferred) for JavaScript-rendered pages or pages requiring login. If login is required and unavailable: write session report with `Status: blocked` and the URL; report to user; stop. If the posting is dead or closed: write session report with `Status: done`, `Decision: dead`; do not add to tracker; stop.
5. **Normalize**: extract company name, role title, level, location/work mode, ATS/application URL.
6. **Profile auto-selection** (see above): pick best-fit, switch active profile if needed or ask on tie.
7. **Fit/reject filter**: apply the selected profile's reject rules. Clear reject → write session report with `Status: done`, `Decision: rejected` + reason; do not add to tracker; stop (same behavior as `job-tracker:find`).
8. **Add to Raw Pipeline**: write one row to `data/tracker.md` Raw Pipeline using the `config/tracker-schema.md` shape: `Profile` = selected slug, `Source` = derived value, `Added` = today's date, `Status` = ⬜.
9. **Write session report**: `.sessions/reports/[id].import.md`. Status is always `done` or `blocked` (login required); `dead`, `duplicate`, and `rejected` outcomes use `Status: done` with `Decision: <outcome>` in the report body. Record decision, profile selection, source, and tracker row in the report.
10. Suggest `job-tracker:company [company]` as the next action.

Hard rule: `import` only adds a verified lead. It never marks anything applied, sent, or submitted. It never submits an ATS application.

## Output

Reply in the configured assistant language using this structure:

```md
# Import — [Company / Role]

- URL: <canonical url>
- Source: <derived value>
- Profile: <selected slug> [switched from <previous> | no switch]
- Decision: added | duplicate | dead | rejected | blocked

## What was added

| Company | Profile | Role | URL | Added | Status | Source |
|---|---|---|---|---|---|---|
| ... | ... | ... | ... | YYYY-MM-DD | ⬜ | ... |

(omit this section if Decision ≠ added)

## Blocker

(include only when Decision: blocked)
- Reason: login required at <host>
- Next step: log in to <host>, then re-run `job-tracker:import <url>`

## Profile Selection

(omit when Decision: blocked — profile selection did not run)
- Selected: <slug> — <reason>
- Considered: <runners-up with brief reason>
- Switch: yes/no

Active profile: <slug>

## Next actions

- context-specific `job-tracker:action` next actions using `config/next-actions.md`
```
