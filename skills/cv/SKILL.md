---
name: job-tracker:cv
description: "Creates or updates a company-specific Markdown CV from configured profile, prep notes, vacancy text, and CV style, then suggests PDF export."
argument-hint: "<company-slug-or-name> [vacancy-url-or-path]"
---

Tailor a CV for one target vacancy.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. `config/profile-resolution.md`, then the profile it resolves to
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `style/cv-style.md`
8. `config/next-actions.md`

Also read `data/companies/[slug]/prep-notes.md` when available.

## Profile Resolution

Follow `config/profile-resolution.md`.

## Workflow

1. Resolve company slug/name and vacancy source.
2. Read the base CV or closest existing company CV.
3. Read prep notes and vacancy text.
4. Choose the top 3 positioning themes for the role using the vacancy and resolved profile.
5. Create or update `data/companies/[slug]/resume.md`.
6. Use the configured document language.
7. Preserve truthfulness: do not invent stack, scale, metrics, or domain experience.
8. Follow configured CV style and house rules.
9. Suggest `job-tracker:fit [resume.md] [job]` when the fit is risky or the vacancy is detailed.
10. Suggest `job-tracker:pdf [resume.md]` after the Markdown is ready.

If this skill is called by `job-tracker:run`, its output is an internal CV result for the orchestrator. Suggested `job-tracker:fit` or `job-tracker:pdf` follow-ups must be added to the `job-tracker:run` internal action queue when inputs are available, not treated as user-facing stop points. Report `Run progress` and the exact `Next internal step:` instead of ending with a user-facing follow-up menu.

## Output

Reply in the configured assistant language and include:

- CV path
- main tailoring choices
- unresolved risks or missing vacancy keywords
- when called by `job-tracker:run` and runnable internal work remains, `Run progress` plus `Next internal step`
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions using `config/next-actions.md`
