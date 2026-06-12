---
name: job:profile
description: Manages job-search profile configuration: active profile, profile files, validation, switching, adding, and removing profiles.
argument-hint: status | list | validate | use <slug> | add <slug> | remove <slug>
---

Manage job-search profiles.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. `config/language.md`
4. `config/tracker-schema.md`
5. `config/next-actions.md`

Also inspect `strategy/search-profiles/*.md` and `data/tracker.md` when validating or removing profiles.

## Scope

This skill manages profile configuration only. It does not search jobs, verify roles, research companies, tailor CVs, draft outreach, or resolve company-specific workflow context.

Profiles are the source of truth for search-specific positioning, target role families, fit signals, reject rules, priority rules, application strategy, search queries, and CV/outreach emphasis.

## Supported Actions

Use `$ARGUMENTS` to choose the action:

- `status` or no arguments: show the active profile, available profiles, and any consistency issues.
- `list`: list all profile slugs from `config/settings.md` and `strategy/search-profiles/*.md`.
- `use <slug>`: switch the active profile in `config/settings.md`.
- `add <slug>`: create `strategy/search-profiles/<slug>.md` from the standard profile template and add it to `settings.md`.
- `remove <slug>`: remove an unused profile from `settings.md` and delete `strategy/search-profiles/<slug>.md`.
- `validate`: check settings, profile files, tracker `Profile` values, and skill contracts.

If the action is ambiguous, ask one concise follow-up question.

## Rules

1. Never create or keep a generic `default.md`.
2. Profile slugs must be lowercase kebab-case or short lowercase names, such as `frontend`, `ai`, `barcelona-product`, or `platform`.
3. Do not pass profile slugs through other job commands, except `job:run`, which may take a profile slug and switches the active profile via `job:profile use` before running. Other skills read the active profile from `config/settings.md` for new discovery or the row-level `Profile` in `data/tracker.md` for tracked jobs.
4. When switching active profile:
   - require the profile file to exist
   - update both `Profile slug` and `Profile file` in `config/settings.md`
   - do not rewrite existing tracker row profiles
5. When adding a profile:
   - create a complete profile file with the standard sections below
   - add exactly one entry to `Available Profiles` in `config/settings.md`, using the canonical bullet format `` - `<slug>` — <one-line description> `` (backtick-wrapped slug, em dash, short description)
   - do not duplicate content from `candidate/candidate.md`
6. When removing a profile:
   - refuse if it is the active profile
   - refuse if any `data/tracker.md` row uses that profile
   - remove the settings entry and delete only that profile file
7. Preserve existing user-authored profile notes when editing.

## Profile Template

Use this structure for new profiles:

```md
# Profile — [Display Name]

## Positioning

...

## Target Role Families

- ...

## Strong Fit Signals

- ...

## Work Mode

- ...

## Medium Fit Signals

- ...

## Reject / Low ROI

- ...

## Priority Rules

- **P1:** ...
- **P2:** ...
- **P3:** ...

## Application Strategy

- ...

## Search Queries

- `"..."`

## Priority Company Themes

- ...

## CV / Outreach Emphasis

- ...

## Tracker Tag

Use this tag in tracker notes when useful:

```md
- Search profile: [slug]
```
```

## Validation

When validating, check:

- `config/settings.md` exists
- active `Profile slug` is non-empty
- active `Profile file` exists
- every settings profile entry has a matching `strategy/search-profiles/<slug>.md`
- every `strategy/search-profiles/*.md` file has a settings entry
- no profile file is named `default.md`
- `data/tracker.md` job rows use only known profile slugs
- `scripts/llm-hooks/validate-tracker-profiles.js` passes when available
- `scripts/llm-hooks/validate-skill-footers.js` passes when available

## Output

Reply in the configured assistant language and include:

- active profile
- profiles changed or created
- validation errors, if any
- exact files changed
- footer with `Active profile: <slug>` and context-specific `job:action` next actions using `config/next-actions.md`
