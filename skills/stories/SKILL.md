---
name: job-tracker:stories
description: "Maintains a factual interview story bank, maps existing stories to job requirements, and proposes user-confirmed STAR stories for interviews without inventing experience."
argument-hint: "[company-or-role-or-story-topic]"
---

Maintain and use the interview story bank.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. `config/profile-resolution.md`, then the profile it resolves to
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `candidate/stories.md`
8. `config/next-actions.md`

If the request names a company, also read the matching tracker row and `data/companies/[slug]/prep-notes.md` when present. If a company CV exists, read `data/companies/[slug]/resume.md` only when story matching needs CV evidence.

## Profile Resolution

Follow `config/profile-resolution.md`.

## Scope

This skill manages interview stories. It does not perform company research, CV tailoring, manual message draft preparation, PDF export, or job discovery.

Use factual evidence only. Never invent experience, metrics, ownership, tools, incidents, contacts, or outcomes. If a story would be useful but evidence is incomplete, write it as a question or `Needs user confirmation`.

## Story Bank Structure

`candidate/stories.md` has two working sections:

- `## Story Index`: compact table for search, matching, health checks, and quick interview prep.
- `## Story Details`: full STAR+Reflection text keyed by stable IDs.

Every story must have a stable ID: `S001`, `S002`, `S003`, and so on.

Use IDs in other outputs:

- `job-tracker:fit`: `S003 covers ambiguity; S007 is a stretch for observability.`
- `job-tracker:run`: `story gap: no Ready story for incident/debugging questions.`
- prep notes: `Interview prep: use S002 and S005.`

Do not duplicate full stories into company prep notes unless the user asks for a company-specific interview plan.

## Workflow

1. Determine mode from the argument:
   - no argument: audit story bank coverage and gaps
   - company/role: map existing stories to the role and identify missing evidence
   - topic: find or propose stories for that topic
2. Read `candidate/stories.md` and relevant evidence files.
3. Classify stories:
   - ready and directly reusable
   - usable with caveats
   - missing or needing user confirmation
4. For missing coverage, propose concise story prompts for the user instead of fabricating content.
5. When adding a story:
   - assign the next unused `S###` ID
   - add one row to `## Story Index`
   - add matching full text under `## Story Details`
   - mark unsupported details as `Needs user confirmation`
6. When improving a story, update both the index row and detail section.
7. When a story is used in a real interview, update `Use Count` and `Last Used` only after the user explicitly says it was used.
8. If called by `job-tracker:fit` or `job-tracker:run`, return story matches and gaps as internal preparation input, not as a stop point. When called by `job-tracker:run` and runnable internal work remains, report `Run progress` and the exact `Next internal step:`.

## Story Quality Rules

- A good story has situation, task, action, result, and reflection.
- Result can be qualitative if no metric is known, but it must not pretend to be quantified.
- Prefer stories that show tradeoffs, ownership, debugging, collaboration, product judgment, or ambiguity.
- Keep stories general enough to reuse across roles, then map them to company-specific questions in prep notes.
- Preserve user wording and caveats when editing existing stories.
- Never change a story ID after it has been assigned.
- Keep `Strength` honest. Use `4` or `5` only when the story has specific action, stakes, and outcome.

## Matching Rules

When mapping stories to a role or interview question, use this fit scale:

- `Strong`: primary skill matches, strength is 4-5, and domain/profile fit is clear.
- `Workable`: secondary skill matches, or strength is 3, or domain is adjacent.
- `Stretch`: story can be reframed but does not directly prove the competency.
- `Gap`: no existing story covers the competency.

For `Workable` or `Stretch`, include one line of framing guidance.
For `Gap`, ask a concrete user question to collect a real story.

## Output

Reply in the configured assistant language and include:

- matched stories
- missing story themes
- story mapping table with ID, fit, and framing
- questions for user confirmation, if needed
- suggested story-bank edits, if any
- when called by `job-tracker:run` and runnable internal work remains, `Run progress` plus `Next internal step`
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions from `config/next-actions.md`

If no useful next action exists, use `Next actions: No immediate next action`.
