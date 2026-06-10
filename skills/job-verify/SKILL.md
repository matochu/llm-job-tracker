---
name: job:verify
description: Reviews tracked jobs and prepared artifacts, verifies role/source status, and audits tracker, prep notes, manual message drafts, CV, fit, and PDF state.
argument-hint: [mode] [company-or-section]
---

Verify existing tracked jobs or review a job-search run stage.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the resolved profile from the Profile Resolution rules below
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `config/tracker-schema.md`
8. `config/next-actions.md`

Also get the current date and timezone from the execution environment or system context before writing verification, archive, or tracker update dates.

## Profile Resolution

1. Read the active profile from `config/settings.md`.
2. For new job discovery or untracked targets, use the active profile from settings.
3. For existing tracked vacancies, use the `Profile` value from the matching `data/tracker.md` row.
4. Treat all arguments as normal skill arguments; profiles are not passed in commands.

## Scope

This skill is a reviewer/verifier. It does not do broad job discovery, company research, outreach drafting, CV tailoring, fit scoring, or PDF export. Use the corresponding `job:*` skill to fix findings.

Default mode checks existing tracked roles. Run-stage modes are larger reviewer passes for `job:run`, not per-step micro-gates.

## Subagent Use

When this skill is called by `job:run` or another workflow and a fresh context/subagent is available, run `job:verify` in that subagent so review context stays independent from the producing step.

If subagent execution is not available, run it in the current context, but keep the reviewer stance: inspect artifacts, produce findings, and avoid rewriting unrelated work.

If this skill is called by `job:run`, its output is a reviewer signal for the orchestrator and must not be treated as a user-facing stop point unless the verdict is `blocked`.

When this skill is called by `job:run` in `intake`, `prep`, or `final` mode and returns `Continue: yes`, include `Next internal step:` with the exact child skill or tracker update the orchestrator should run next. If more than one runnable internal step remains, include a compact `Internal action queue:`. Do not rely on user-facing `Next actions` for work that `job:run` can still perform internally.

## Modes

Supported modes:

- default / `status`: role liveness and tracker verification for active tracked jobs.
- `intake`: after `job:find`, review newly added or selected leads before prep work.
- `prep`: after company prep, manual message drafts, CV, fit, and PDF work for a company or batch.
- `final`: end-of-run audit across tracker, notes, CV/PDF state, and next actions.

If the first argument is not one of these modes, treat it as a company, section, priority group, or tracker scope and use default mode.

## Workflow

1. Read the configured tracker.
2. Identify jobs to verify:
   - default: active pipeline
   - if requested: Raw Pipeline, Staging, one company, or one priority group
3. For each job:
   - open the URL or source board
   - prefer company/ATS source of truth over search snippets
   - use browser MCP, preferably Playwright MCP or Chrome DevTools MCP, for LinkedIn, Djinni, JavaScript-rendered boards, and logged-in sites
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
6. Suggest `job:company [company]` when an active role has no prep notes.

## Intake Review

Use `intake` after `job:find` or before processing a batch.

Review each candidate lead for:

- `Profile` column exists and is filled with the active profile used for discovery
- source URL or board URL exists
- role can be verified at company/ATS/source of truth
- role is active or unclear but worth retaining
- role does not obviously violate resolved profile reject rules
- duplicate company/role rows are not being introduced

Allowed updates:

- fix narrow tracker metadata such as checked date, source status, duplicate note, or profile value when the active profile is unambiguous
- move closed/disappeared roles to Archive
- mark inaccessible roles as blocked with reason

Do not create prep notes, draft messages, tailor CVs, or export PDFs in this mode.

## Prep Review

Use `prep` after `job:run` has processed a company or batch.

Review prepared state for each company:

- tracker row still points to an active or intentionally monitored role
- row-level `Profile` matches the profile used for prep and CV decisions
- `data/companies/[slug]/prep-notes.md` exists when company research was claimed
- prep notes separate verified facts from assumptions
- useful contacts are recorded without inventing relationship, availability, or willingness
- if contacts were found, `### Manual Message Drafts` exists or the missing draft is listed as a next action
- message drafts are clearly manual drafts only
- no artifact says or implies that the agent sent, applied, connected, submitted, or contacted anyone
- prep-note research and manual message draft sections appear to come from the required `job:company` and `job:draft` workflow, not from manual reconstruction by `job:run`
- CV exists only when the role is active and worth CV work
- fit review result is recorded when CV work was done
- PDF exists only when Markdown CV exists and PDF export was appropriate

Allowed updates:

- correct tracker statuses that overstate readiness
- add reviewer notes for missing prep/CV/PDF/manual-draft artifacts
- mark blockers or warnings for `job:run` final summary

Do not write new outreach text, rewrite CV content, or perform application/contact actions in this mode.

## Final Review

Use `final` at the end of `job:run`.

Audit the full run result:

- every changed tracker row has a `Profile`
- statuses, prep notes, CV, fit, PDF, and next actions agree with each other
- companies are not described as ready to apply, submit, send, or contact merely because artifacts exist
- manual message drafts are represented as `manual message draft prepared`; the user still writes/sends manually outside the skill
- prep notes and manual message drafts are not reported as produced by `job:run` directly; they must be attributed to `job:company` and `job:draft`
- manual user work is listed under `Manual user actions`, not as shortcut-based `Next actions`
- closed roles are archived or marked with a clear reason
- monitoring candidates have a reason and next check path
- remaining agent work is expressed as `job:action` next actions, not vague prose; manual user work is kept in `Manual user actions`

Return one reviewer verdict for the run and only the highest-signal issues.

## Verdicts

For each reviewed scope, return:

- `pass`: no material issues found
- `warning`: safe to continue, but the final summary should mention the issue
- `needs_fix`: continue only after a narrow tracker/note/status fix
- `blocked`: cannot continue without login, source access, missing required artifact, or user action

Include `Continue: yes` or `Continue: no` for `intake`, `prep`, and `final` modes.

If `Continue: yes` and the reviewed scope has runnable `job:run` work remaining, include the next executable internal action. Example:

```md
Verdict: pass
Continue: yes
Next internal step: run `job:company ExampleCo`
```

## Output

Reply in the configured assistant language and include:

- roles checked
- active / closed / unclear counts
- exact tracker changes made
- roles needing login or manual verification
- reviewer mode and verdict when using `intake`, `prep`, or `final`
- whether `job:run` may continue
- when `job:run` may continue and runnable internal work remains, the exact `Next internal step: run job:* ...` or tracker update
- highest-signal issues and the responsible `job:action` for each fix
- footer with `Active profile: <slug>` and context-specific `job:action` next actions using `config/next-actions.md`
