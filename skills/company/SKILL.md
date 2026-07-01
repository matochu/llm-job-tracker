---
name: job-tracker:company
description: "Researches one target company for the configured job-search profile: active jobs, ATS, tech stack, referral contacts, outreach strategy, and prep notes."
argument-hint: "<company-name-or-slug>"
---

Research one target company for the configured candidate.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the resolved profile from the Profile Resolution rules below
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `config/tracker-schema.md`
8. `style/outreach-style.md`
9. `config/next-actions.md`
10. `config/source-registry.md`
11. `config/browser-patterns.md`

## Profile Resolution

1. Read the active profile from `config/settings.md`.
2. For new job discovery or untracked targets, use the active profile from settings.
3. For existing tracked vacancies, use the `Profile` value from the matching `data/tracker.md` row.
4. Treat all arguments as normal skill arguments; profiles are not passed in commands.

## Workflow

1. Resolve the company name and slug.
2. Find the company careers page and ATS.
3. Verify active roles against the resolved profile's fit, reject, work-mode, and priority rules.
4. Search for referral contacts using a local-first approach:
   a. **Local network check first:** read and normalize all network sources from `data/network/` and any legacy `docs/*referrals*.md` / `docs/*network*.md` (see `strategy/sources.md` — Network Sources). Match contacts against the target company (case-insensitive, suffix-tolerant). Collect any matches as **candidates** for the People/Referrals section, noting their source file. Skip silently if no network sources exist.
   b. **Browser-required contact scan:** use `config/source-registry.md` `## Browser-Required Sources` and each source's `Required access` policy. For LinkedIn contact research, open LinkedIn through the configured browser MCP access path to supplement local contacts, verify current roles, and find mutual connections. If authentication is required, open the source in browser MCP and wait for the user to log in manually. Do not use API calls, WebFetch, curl, Chrome DevTools-only checks, or plain web search as a fallback for browser-required contacts.
   c. Prioritize employees with mutual connections and people matching the configured referral strategy.
   d. Do not send connection requests during research.
   e. Write/update `## People / Referrals` during step 7 (prep notes update) — not before research is complete. Mark locally-sourced contacts in the `Mutual connections` or `Notes` column with their source file (e.g. `local: connections.csv`).
5. Build company summary:
   - product, industry, scale, stage/funding, business model, HQ/remote policy
   - Glassdoor or reputation signal if available
6. Extract tech stack from job descriptions, company docs, engineer profiles, or public sources.
7. Create or update `data/companies/[slug]/prep-notes.md`.
8. Update tracker if the company should move from Raw Pipeline to active pipeline, monitoring, or archive.
9. If useful recruiter, engineering, founder, or referral contacts were found, run `job-tracker:draft [company]` after prep notes are saved so manual message drafts are prepared in the same prep-notes file.
   - `job-tracker:draft` must only prepare drafts and update `### Manual Message Drafts`.
   - Do not send messages, connection requests, emails, LinkedIn messages, or applications.
   - If the current tool cannot run another skill in the same turn, make `job-tracker:draft [company]` the first recommended next action.

If this skill is called by `job-tracker:run`, its output is an internal company-prep result for the orchestrator. Do not use a user-facing `Next actions` footer for runnable `job-tracker:run` work. Report `Run progress` and the exact `Next internal step:` instead, such as `job-tracker:draft [company]`, `job-tracker:cv [company]`, or a tracker update.

## Enforcement

This skill is the required path for producing company research and prep-note research sections. Do not bypass it by writing `data/companies/*/prep-notes.md` research sections directly from context.

Having company, role, ATS, or contact data already in context is not a valid reason to skip `job-tracker:company`.

When useful contacts exist, the `job-tracker:draft [company]` step is mandatory after prep notes are saved. If another skill cannot run in the same turn, do not write manual message drafts yourself; make `job-tracker:draft [company]` the first next action.

## Prep Notes Template

Use this structure unless an existing file already has a compatible format:

```md
# Prep Notes — [Company]

## Company Summary

- **What they do:** ...
- **Industry:** ...
- **Scale:** ...
- **Stage:** ...
- **Glassdoor / reputation:** ...
- **Business model:** ...
- **HQ / Remote:** ...

## Tech Stack

### Frontend

- **Core:** ...

### Backend / Infra

- ...

## Vacancy Snapshot

- **Careers page:** ...
- **Job board:** ...
- **Verified:** YYYY-MM-DD
- **Priority:** ...

### Active Jobs

| Role | Location | Link | Notes |
|---|---|---|---|

## People / Referrals

| Name | Role | Location | LinkedIn | Mutual connections | Priority |
|---|---|---|---|---|---|

## Outreach Strategy

1. ...

- Outreach status: **not started**

## Questions To Clarify

- ...
```

## Output

Reply in the configured assistant language and include:

- company and ATS
- relevant active roles
- best contacts
- tracker/prep-notes changes
- whether manual message drafts were prepared via `job-tracker:draft`
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions using `config/next-actions.md`
