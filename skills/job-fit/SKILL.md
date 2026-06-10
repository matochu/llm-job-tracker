---
name: job:fit
description: Scores a CV against a specific vacancy, checks configured CV style, keyword coverage, risks, interview readiness, and suggests concrete edits.
argument-hint: <path/to/resume.md> <vacancy-url-or-path-or-paste>
---

Review a CV against a specific vacancy.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the resolved profile from the Profile Resolution rules below
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `style/cv-style.md`
8. `candidate/stories.md`
9. `config/next-actions.md`

## Profile Resolution

1. Read the active profile from `config/settings.md`.
2. For new job discovery or untracked targets, use the active profile from settings.
3. For existing tracked vacancies, use the `Profile` value from the matching `data/tracker.md` row.
4. Treat all arguments as normal skill arguments; profiles are not passed in commands.

## Subagent Execution

Run the CV/vacancy fit review in a subagent when the current tool supports subagents.

Main agent responsibilities:

1. Resolve the CV path, vacancy source, and profile context.
2. Spawn one subagent with the bounded task: review this CV against this vacancy using the resolved profile and configured CV style.
3. Give the subagent only the relevant files, URL/text, and scoring/output requirements.
4. Do not ask the subagent to edit files.
5. Review the subagent result, then produce the final user-facing answer with the required footer.

Subagent responsibilities:

- read the CV, vacancy, resolved profile, `style/cv-style.md`, and `strategy/criteria.md`
- score fit, style, keyword coverage, risks, and interview readiness
- suggest concrete edits without applying them
- return a concise structured review for the main agent to integrate

If subagents are unavailable, perform the review in the main agent and state that subagent execution was unavailable.

If this skill is called by `job:run`, its output is an internal fit-review result for the orchestrator. Suggested CV edits, PDF export, or tracker updates must be added to the `job:run` internal action queue when appropriate, not treated as user-facing stop points. Report `Run progress` and the exact `Next internal step:` when runnable internal work remains.

## Workflow

1. Read the CV from the first argument or ask for it if missing.
2. Read the vacancy from URL, file path, or pasted text.
3. Parse vacancy:
   - level and IC/management shape
   - must-have requirements
   - nice-to-haves
   - domain
   - top responsibilities
   - location/work mode
4. Score fit using the configured rubric and resolved profile.
5. Check CV style and hygiene:
   - forbidden sections or phrases
   - career expectations quality
   - keyword coverage
   - over-targeting or invented evidence
   - readability and ATS compatibility
6. Suggest concrete edits. Do not apply edits unless the user asks.
7. Match existing interview stories from `candidate/stories.md` to the vacancy themes using story IDs. Report `Strong`, `Workable`, `Stretch`, or `Gap` for each important interview theme. If coverage is missing, suggest `job:stories [company-or-topic]` questions instead of inventing stories.
8. If the user asks, apply edits and suggest `job:pdf [resume.md]`.

## Output

Reply in the configured assistant language using this structure:

```md
# CV Fit Review — [Company / Role]

## Vacancy Snapshot

- Level / IC vs management:
- Must-have:
- Domain / mode:

## Score

| Criterion | Score | Comment |
|---|---:|---|

**Total: NN/60 — verdict**

## Style / Hygiene

- ...

## Top Gaps

1. ...

## Concrete Edits

- ...

## Risks

- ...

## Interview Stories To Prepare

- Use story IDs from `candidate/stories.md`.
- Include fit level and framing notes for each story.
- List gaps as questions for `job:stories`, not fabricated examples.

Active profile: <slug>

## Next actions

- context-specific `job:action` next actions from `config/next-actions.md`
```
