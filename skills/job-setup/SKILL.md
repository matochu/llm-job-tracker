---
name: job:setup
description: Runs the first-step interactive readiness check for job-search configuration, dependencies, profiles, base CV, tracker, sources, browser MCP, PDF setup, and run prerequisites.
argument-hint:
---

Check whether the workspace is ready for `job:run`.

This is an interactive setup assistant. It performs a full preflight and asks the user concrete questions for missing or weak configuration. It does not install the skill system and does not run `node scripts/install.js`.

## Load Config

Before starting, read existing files when present:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the active profile from settings
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `strategy/sources.md`
8. `config/tracker-schema.md`
9. `style/outreach-style.md`
10. `style/cv-style.md`
11. `config/next-actions.md`
12. `data/tracker.md`
13. configured base CV path, usually `candidate/cv/cv-base.md`

## Scope

Run `job:setup` as the first user-facing step after installing this workspace.

This skill always performs the full setup review. It has no quick/fix modes.

Allowed actions:

- run `node scripts/check-deps.js`
- inspect configuration files and configured paths
- inspect installed hook/skill sync status reported by dependency checks
- ask the user for missing information
- propose specific next files/actions to complete setup
- create only narrow scaffolds after explicit user confirmation

Forbidden actions:

- do not run `node scripts/install.js`
- do not invent candidate experience, metrics, contacts, job requirements, or source strategy
- do not create a full base CV from scratch without user-provided resume content
- do not change the active profile without explicit user confirmation
- do not add job sources without user confirmation
- do not start `job:run`

## Review Checklist

Check:

- dependencies and hook sync via `node scripts/check-deps.js`
- active profile exists in `config/settings.md`
- every listed profile has a corresponding `strategy/search-profiles/*.md` file
- active profile has usable fit, reject, priority, and search/source guidance
- `candidate/candidate.md` exists and contains candidate identity, constraints, and real skills
- configured base CV exists, is Markdown, is non-empty, and contains real user-provided experience
- `config/language.md` exists
- `config/paths.md` points to usable tracker, company notes, CV, PDF generator, and base CV paths
- `data/tracker.md` exists and job tables include a `Profile` column
- `strategy/sources.md` exists and defines usable sources for the active profile
- LinkedIn, Djinni, browser-filtered boards, and JavaScript-rendered ATS sources are marked as browser-MCP-only where relevant
- PDF generator and CSS exist
- browser MCP readiness is reported for Codex and, when available, Claude
- hard rules are present in `config/agent-instructions.md`, `CLAUDE.md`, and `AGENTS.md`

## Interactive Questions

When a critical setup item is missing, ask the minimum concrete questions needed to proceed.

Use questions like:

- Missing base CV: ask for a path to an existing PDF/DOCX/MD resume, pasted resume text, or permission to create an empty scaffold.
- Missing active profile: list available profile files and ask which slug should be active.
- Missing profile file: ask whether to create a profile scaffold and what search direction it should represent.
- Weak profile: ask for target roles, reject rules, priority rules, location/work-mode limits, and preferred sources.
- Missing sources: ask where to search for vacancies and which sources require browser login.
- Missing tracker: ask whether to create a tracker scaffold using the configured schema.
- Browser MCP or login issue: ask the user to authenticate manually in the opened browser or provide the missing CLI path when relevant.

Do not ask more than three questions in one response. Prioritize blockers over warnings.

## Verdicts

Return:

- `pass`: ready for `job:run`
- `warning`: ready for `job:run`, but warnings should be addressed soon
- `blocked`: not ready for `job:run`; user input is required

## Output

Reply in the configured assistant language when `config/language.md` exists, otherwise Ukrainian.

Include:

- `Verdict: pass|warning|blocked`
- `Ready for job:run: yes|no`
- critical blockers
- warnings
- checked areas with pass/warning/blocked status
- up to three concrete questions when blocked
- files that should be created or updated next
- footer with `Active profile: <slug-or-missing>` and context-specific `job:action` next actions using `config/next-actions.md`
