---
name: job-tracker:run
description: "Orchestrates a full job-search pass: discovery or selected company, company prep, manual message drafts, CV, fit review, PDF when appropriate, tracker updates, and final summary."
argument-hint: "[profile-slug] [company-or-search-filter]"
---

Run a complete job-search pass by coordinating existing `job-tracker:*` skills.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the resolved profile from the Profile Resolution rules below
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `strategy/sources.md`
8. `config/tracker-schema.md`
9. `config/next-actions.md`
10. `config/session-reports.md`

Also get the current date and timezone from the execution environment or system context before creating Session Reports or updating tracker dates.

Do not read `candidate/stories.md` directly in `job-tracker:run`. Story-bank inspection and mapping belongs to `job-tracker:stories`; `job-tracker:run` should call `job-tracker:stories [company]` and consume its result.

## Profile Resolution

The first argument is an optional profile slug. Passing it here is a deliberate exception to the no-profile-argument rule: `job-tracker:run` does not honor a per-command profile silently, it switches the global active profile via `job-tracker:profile use`.

1. Read available profile slugs from `config/settings.md`.
2. If the first argument matches an available profile slug, run `job-tracker:profile use <slug>` before any other step.
3. After switching, re-read `config/settings.md` and the resolved profile file.
4. Treat remaining arguments as a company name, section, vacancy URL, or search filter.
5. For profile resolution per stage, follow the Profile Rules in `config/settings.md` (new discovery uses the active profile; tracked jobs use the row-level `Profile`).

## Scope

This skill is an orchestrator. It should not duplicate the implementation logic of `job-tracker:find`, `job-tracker:company`, `job-tracker:draft`, `job-tracker:cv`, `job-tracker:fit`, `job-tracker:stories`, or `job-tracker:pdf`.

It should run autonomously by default: run skills in sequence, inspect their results, update `data/tracker.md` between stages, and continue as far as safely possible without asking for confirmation after each step.

Do not stop for soft uncertainty. Record soft issues in `data/tracker.md` and the final summary, then continue with the next useful step or next company.

It never sends applications, emails, LinkedIn messages, connection requests, or outreach. `job-tracker:draft` prepares manual message drafts only.

QA reviewer gates (intake / prep / final) are defined in `## Reviewer Gates` below. Run each gate at the designated step. When subagent execution or a fresh context is available, run each gate in a fresh subagent so review context stays independent from the producing step.

Do not bypass child skills by reconstructing their expected artifacts manually. `job-tracker:run` must call `job-tracker:company` for prep-note research, `job-tracker:draft` for `### Manual Message Drafts`, `job-tracker:cv` for CV tailoring, `job-tracker:fit` for fit review, `job-tracker:stories` for interview story mapping, and `job-tracker:pdf` for PDF export.

## Reviewer Gates

Three QA passes run inside `job-tracker:run` to keep the orchestrator honest. Each gate runs as a **fresh subagent** when subagent execution is available: give it a reviewer stance (inspect artifacts, produce a verdict, do not rewrite producing-step work), the criteria block from this section, and only the target artifacts/tracker scope. If subagent execution is unavailable, run in the current context but keep the reviewer stance.

Gates return a verdict and, when `Continue: yes`, a `Next internal step`. When `job-tracker:run` receives `Continue: yes`, immediately execute the reported `Next internal step` or derive the next step from the internal action queue — do not treat a `Continue: yes` result as a user-facing stop point.

Verdict vocabulary: `pass` / `warning` / `needs_fix` / `blocked`. Include `Continue: yes` or `Continue: no`. Example:

```md
Verdict: pass
Continue: yes
Next internal step: run `job-tracker:company ExampleCo`
```

### Intake Gate

Run after `job-tracker:find` or before processing a batch.

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

Do not create prep notes, draft messages, tailor CVs, or export PDFs in this gate.

### Prep Gate

Run after `job-tracker:run` has processed a company or batch.

Review prepared state for each company:

- tracker row still points to an active or intentionally monitored role
- row-level `Profile` matches the profile used for prep and CV decisions
- `data/companies/[slug]/prep-notes.md` exists when company research was claimed
- prep notes separate verified facts from assumptions
- useful contacts are recorded without inventing relationship, availability, or willingness
- if contacts were found, `### Manual Message Drafts` exists or the missing draft is listed as a next action
- message drafts are clearly manual drafts only
- no artifact says or implies that the agent sent, applied, connected, submitted, or contacted anyone
- prep-note research and manual message draft sections appear to come from the required `job-tracker:company` and `job-tracker:draft` workflow, not from manual reconstruction by `job-tracker:run`
- CV exists only when the role is active and worth CV work
- fit review result is recorded when CV work was done
- PDF exists only when Markdown CV exists and PDF export was appropriate

Allowed updates:

- correct tracker statuses that overstate readiness
- add reviewer notes for missing prep/CV/PDF/manual-draft artifacts
- mark blockers or warnings for the final gate

Do not write new outreach text, rewrite CV content, or perform application/contact actions.

### Final Gate

Run before the final summary.

Audit the full run result:

- every changed tracker row has a `Profile`
- statuses, prep notes, CV, fit, PDF, and next actions agree with each other
- companies are not described as ready to apply, submit, send, or contact merely because artifacts exist
- manual message drafts are represented as `manual message draft prepared`; the user still writes/sends manually outside the skill
- prep notes and manual message drafts are not reported as produced by `job-tracker:run` directly; they must be attributed to `job-tracker:company` and `job-tracker:draft`
- manual user work is listed under `Manual user actions`, not as shortcut-based `Next actions`
- closed roles are archived or marked with a clear reason
- monitoring candidates have a reason and next check path
- remaining agent work is expressed as `job-tracker:action` next actions, not vague prose; manual user work is kept in `Manual user actions`

Return one reviewer verdict for the run and only the highest-signal issues.

## Orchestrator Mode

During `job-tracker:run`, do not stop after child skills just to ask for the next action. Child-skill outputs are internal progress signals, not user-facing stop points.

Treat `job-tracker:run` as a resumable state machine. Every response from `job-tracker:run` must be one of these states:

- `running`: internal work remains and no hard blocker exists. Continue executing; do not return control to the user.
- `paused-resumable`: the turn must stop even though the run can continue automatically from the Session Report.
- `blocked`: a hard blocker or required manual user action prevents the next internal step.
- `done`: the run plan is complete and final verification/summary are done.

Use a run plan and progress updates instead of intermediate `Next actions`:

- `Run plan`: the intended sequence for this run.
- `Run progress`: completed internal steps, tracker/prep/CV/PDF updates, and current blockers.
- `Next internal step`: the next child skill or tracker update that `job-tracker:run` will execute.

When a child skill returns a result inside `job-tracker:run`, rewrite that result as `Run progress` and continue with `Next internal step` whenever runnable internal work remains. Do not let child-skill result text become the final user-facing response unless the run is complete or blocked.

Do not print a `Next actions:` footer after profile switching, `job-tracker:find`, the intake reviewer gate, or a per-company child step unless the response state is `paused-resumable`, `blocked`, or `done`.

Only show user-facing `Next actions:` in the final summary, in a hard-blocker response, or in a `paused-resumable` response.

If there is any runnable internal step remaining, do not output final `Next actions`; continue the run.

When a reviewer gate returns `Continue: yes`, immediately execute its reported `Next internal step` or derive the next step from the internal action queue. A gate result that says `Continue: yes` is not a stopping point and must not become the final response.

Runnable internal steps include:

- intake reviewer gate (see `## Reviewer Gates`)
- `job-tracker:company`
- `job-tracker:draft`
- `job-tracker:cv`
- `job-tracker:fit`
- `job-tracker:stories`
- `job-tracker:pdf`
- tracker/prep-note updates
- prep reviewer gate (see `## Reviewer Gates`)
- final reviewer gate (see `## Reviewer Gates`)

Never list `job-tracker:fit` or `job-tracker:pdf` as final `Next actions` when `job-tracker:run` has enough inputs to run them internally.

Never end a `job-tracker:run` response with vague continuation prose such as `Next step: job-tracker:fit`, `Наступний крок: job-tracker:fit`, or `Continue with job-tracker:cv`. Use `Next internal step: run ...` while continuing internally, or the `paused-resumable` footer below if control must return to the user.

## Resumable Pause UX

Use `paused-resumable` only when the current turn must end even though the latest Session Report says `Can continue automatically: yes`. This is an interruption/resume state, not normal workflow completion.

A `paused-resumable` response must include:

- `Run plan` copied from the latest Session Report, with every item marked `[done]`, `[current]`, `[pending]`, `[skipped]`, or `[blocked]`.
- `Resume point` copied from the latest Session Report.
- `Run progress` with the last completed child step and files/artifacts changed.
- `Active profile: <slug>`.
- exactly one user-facing `Next actions` item:
  `- [n] Continue Run (Recommended) — resume `job-tracker:run` from the latest Session Report and execute the next internal step`

Do not list child skills such as `job-tracker:company`, `job-tracker:draft`, `job-tracker:cv`, `job-tracker:fit`, `job-tracker:stories`, or `job-tracker:pdf` as user-facing `Next actions` in `paused-resumable`. They belong inside the plan, `Resume point`, or `Next internal step`.

Template:

```md
Run plan:
1. [done] Verify ExampleCo roles
2. [done] Company research
3. [done] Manual message drafts
4. [done] CV tailoring
5. [current] Fit review
6. [pending] Story mapping if fit gaps appear
7. [pending] PDF export if fit is strong
8. [pending] Final verification

Resume point:
- Last completed step: `job-tracker:cv ExampleCo`
- Next safe step: `job-tracker:fit data/companies/exampleco/resume.md ExampleCo`
- Required input: none
- Can continue automatically: yes

Active profile: ai

Next actions:
- [n] Continue Run (Recommended) — resume `job-tracker:run` from the latest Session Report and execute the next internal step
```

## Internal Action Queue

Maintain an internal action queue during the run.

For each queued item, track:

- action: the exact `job-tracker:*` child skill or tracker update
- target: company, file path, vacancy URL, or tracker section
- status: pending / running / done / skipped / blocked
- reason: why it is queued, skipped, or blocked
- dependency: previous item or condition, such as fit score threshold before PDF export

Show the queue in progress updates when useful, but do not present it as user-facing `Next actions`.

When a child skill output suggests a next action that is already part of `job-tracker:run`, add it to the internal action queue and continue. Do not ask the user to choose it.

## Plan Tracking

At the start of the run, write a compact numbered run plan with the current profile, mode, target/filter, expected stages, and planned company work set when known. Use status markers in the Session Report and user-visible paused/final summaries: `[done]`, `[current]`, `[pending]`, `[skipped]`, `[blocked]`.

During the run, repeat and update the plan periodically:

- after profile switching
- after `job-tracker:find`
- after the intake reviewer gate
- after selecting the work set
- after every 2-3 company steps, or after each company when the run is small
- after any hard blocker or major soft-blocker cluster
- before the final summary

Each plan check-in should include:

- completed plan items
- current item
- next internal step
- changed assumptions or scope
- skipped/blocked companies with short reasons

If actual progress diverges from the plan, update the plan and continue. Do not ask the user to approve routine plan adjustments unless a hard blocker appears or the next action would send/apply/connect.

After every child step, update the Session Report plan markers so exactly one runnable item is `[current]` unless the run is `done` or `blocked`.

## Pause Rules

Pause only when:

- a hard blocker prevents the next internal action
- a manual user action is required before the next internal action can safely run
- a required input is missing and cannot be inferred from tracker, prep notes, vacancy source, or configured paths
- the next action would send/apply/connect or otherwise act outside draft-only/manual boundaries

Do not pause for fit risks, stack gaps, missing nice-to-have keywords, weak contact path, or uncertainty that `job-tracker:fit`, `job-tracker:verify`, or tracker notes can handle.

## Session Report

`job-tracker:run` writes one Session Report per run, following `config/session-reports.md`.

- At run start, create `.sessions/reports/[id].run.md` with `Status: running` and fill `Goal`, `Plan`, and `Resume Point`. Use a local-timezone timestamp `YYYY-MM-DDTHHMMSS` as the `ID`.
- Update the report after every child skill and tracker update, including `job-tracker:find`, `job-tracker:verify`, `job-tracker:company`, `job-tracker:draft`, `job-tracker:cv`, `job-tracker:fit`, `job-tracker:stories`, and `job-tracker:pdf`: refresh `Updated`, `Plan`, `Progress`, `Tracker Updates`, `Files Changed`, `Artifacts`, and `Resume Point`.
- `Resume Point` must always match the latest completed work. Do not leave `Last completed step` or `Next safe step` pointing to an older step after progress has advanced.
- Record `Decisions` and `Blockers` when they happen, not only at the end.
- On the final summary, set `Status: done` (or `blocked`/`abandoned`) and fill `Summary`, `Resume Point`, and `Agent Insights`.
- This report is internal run state, not a user-facing artifact. Do not list it in `Next actions`.

## Workflow

1. Determine mode:
   - no remaining arguments: broad run using the active profile
   - company-like argument: run for that company
   - source/filter-like argument: broad run with that filter
2. If no company is specified, run `job-tracker:find [filter]`.
3. Update `data/tracker.md` immediately after discovery:
   - add accepted leads to `Raw Pipeline`
   - store the active profile in `Profile`
   - record skipped/blocked sources when relevant
4. If discovery added or changed leads, run the **intake reviewer gate** (see `## Reviewer Gates`) before selecting the work set. Prefer fresh-subagent execution when available.
5. Select the work set:
   - prefer P1/P2, active roles, reachable contacts, and strong fit
   - mark closed, rejected, unclear, or low-ROI roles as skipped in `data/tracker.md` and continue with the next candidate
6. For each selected company:
   - run `job-tracker:company [company]`
   - update `data/tracker.md` after company research: active/monitoring/archive, verified date, prep status, role status
   - if useful contacts exist, run `job-tracker:draft [company]` so `### Manual Message Drafts` is prepared in prep notes
   - update `data/tracker.md` or prep notes after outreach draft preparation: mark manual drafts prepared, not sent
   - if the role remains active and worth applying to, run `job-tracker:cv [company]`
   - update `data/tracker.md` after CV tailoring: CV ready or blocked
   - run `job-tracker:fit [resume.md] [vacancy]`; `job-tracker:fit` must use subagent execution when supported
   - update `data/tracker.md` after fit review: score, risks, and recommended next state
   - run `job-tracker:stories [company]` when the fit review exposes important interview themes, gaps, or role-specific behavioral risks
   - run `job-tracker:pdf [resume.md]` only when the fit is strong enough and the Markdown CV is ready
   - update `data/tracker.md` after PDF export: PDF ready or skipped with reason
7. After a selected company or batch is processed, run the **prep reviewer gate** (see `## Reviewer Gates`). Prefer fresh-subagent execution when available. Apply narrow tracker/note fixes when the verdict is `needs_fix`, then continue unless the verdict is `blocked`.
8. Before the final summary, run the **final reviewer gate** (see `## Reviewer Gates`). Prefer fresh-subagent execution when available. The final summary must reflect its warnings, blockers, and continuation verdict.

## Autonomy And Blockers

Default behavior is to continue autonomously.

Hard blockers may pause the whole run:

- required login is not available after opening the source in browser MCP and waiting for the user
- browser MCP, source access, or network access blocks required verification
- vacancy text/source of truth is unavailable and no reliable role data exists
- the next required action would send/apply/connect or otherwise act outside draft-only/manual boundaries
- repository state prevents safe tracker/prep/CV edits

Soft blockers should not pause the whole run. Record them, skip the affected step or company when needed, and continue:

- no active verified role exists
- profile fit is weak or rejected
- role would benefit from clarification before CV work
- contact path is useful but no CV should be prepared yet
- `job-tracker:fit` reports a low score or serious truthfulness/style risk

When a soft blocker appears, update `data/tracker.md` with the reason and include the item in the final summary. Ask clarification questions only in the final summary unless the whole run is blocked by a hard blocker.

## Tracker Update Rules

Update `data/tracker.md` frequently, not only at the end:

- after `job-tracker:find`
- after each `job-tracker:company`
- after each `job-tracker:draft`
- after each `job-tracker:cv`
- after each `job-tracker:fit`
- after each `job-tracker:pdf`
- whenever a role is skipped, blocked, moved to Monitoring, or archived

Keep updates narrow and preserve user-authored notes.

## Output

Reply in the configured assistant language and include:

- active profile and whether it was switched at the start
- run state: `running`, `paused-resumable`, `blocked`, or `done`
- run plan with status markers
- internal action queue when runnable internal work remains
- run progress and next internal step for intermediate updates
- run mode and selection criteria
- source/search summary
- per-company table with company, profile, role, status, prep notes, manual message drafts, CV, fit score, PDF, tracker update, and next step
- files changed
- skipped or blocked items with reasons
- manual user actions, when relevant, without shortcut letters
- clarification options for unresolved soft decisions, such as:
  - choose whether to continue weak-fit role
  - choose contact/message variant
  - choose whether to export PDF despite fit risk
  - choose whether to move a company to Monitoring or Archive
- final recommended next action
- for `paused-resumable`, the exact single `[n] Continue Run` footer from the Resumable Pause UX section
- for `blocked` or `done`, a footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions using `config/next-actions.md`; `Next actions` must contain only agent-runnable `job-tracker:*` actions, while user-side LinkedIn/email/application work must be listed separately under `Manual user actions`

Never treat message drafts as permission to apply, submit, send, or contact anyone. Use wording like `manual message draft prepared`; the user still writes/sends manually outside the skill.
