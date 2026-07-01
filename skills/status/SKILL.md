---
name: job-tracker:status
description: "Your home base: current pipeline state, top priorities, and what to do next. Start here when unsure."
argument-hint: "[company-or-section]"
---

Review job-search status and propose next actions.

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

## Profile Resolution

Follow `config/profile-resolution.md`.

## Scope

This skill is an orchestrator. It should not perform heavy research, job search, CV tailoring, or outreach unless the user chooses a next action.

## Inspection Tooling

When inspecting prep notes, resumes, PDFs, or tracker state across multiple companies, prefer one batch search command over generated shell loops.

Use patterns like:

```bash
rg -n "Manual Message Drafts|Outreach status|PDF|fit|blocked|ready" data/companies/*/prep-notes.md data/tracker.md
```

or targeted `rg`/glob reads for the relevant files.

Do not generate ad hoc `for company in ...; do ...; done` shell loops for status checks. If the needed information cannot be collected with `rg`/glob reads, inspect the specific files directly.

## Workflow

1. Read the configured tracker. Then check for pending migrations: if `config/.installed-version` and `config/.migrated-version` both exist locally and `migrated-version` < `installed-version` by semver, emit one line — "pending local migrations — run `job-tracker:health`". If either file is missing, or versions are equal, or `migrated-version` > `installed-version`, skip silently. Do not read `$CLAUDE_PLUGIN_ROOT` or any remote source; only compare the two local workspace files.
2. If `$ARGUMENTS` names a company or section, focus there. Otherwise review the whole pipeline.
3. Inspect relevant `data/companies/[slug]/prep-notes.md`, `resume.md`, and PDFs when needed to determine readiness.
4. Classify items against tracker state and resolved profile priorities:
   - CV/PDF prepared and awaiting user action
   - needs company research
   - needs outreach
   - needs tailored CV
   - needs PDF export
   - needs verification
   - should be deferred or archived
5. Produce a concise status summary.
6. Provide a footer with `Active profile: <slug>` and a context-specific `job-tracker:action` menu using `config/next-actions.md`. If multiple companies need the same `job-tracker:action`, group them into one next action instead of repeating separate single-company actions.

## Action Handling

Follow `## Presenting Next Actions` and `## Action Handling` in `config/next-actions.md` for how to deliver the footer and interpret the user's reply.

## Output

Reply in the configured assistant language and include:

### Pipeline Board

Open with a compact board showing counts per tracker status and a mini-table of up to 10 active items:

```
Active   │ N   Applied  │ N   Interview │ N   Offer  │ N
Stale    │ N   Rejected │ N   Archived  │ N
```

Then a mini-table (company, role, status, last update, next action) sorted by priority — active and stale items only, skip archived/rejected unless user asked.

Flag **stale** items: rows with no tracker update in 14+ days. Mark them visually (e.g. `⚠ stale`).

Flag **blocked** items: rows explicitly marked blocked or missing required artifacts (no CV, no research, no outreach drafted).

### Summary sections

After the board:

- top priorities (max 5, with the single most important next action each)
- stale/blocked items with concrete reason
- ready-to-act items (CV done, research done, just needs send/apply)
- manual user actions when relevant, without shortcut letters

### Footer

- recommended next action first
- grouped next action when several companies need the same `job-tracker:action`
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions; `Next actions` must contain only agent-runnable `job-tracker:*` actions
