# Contextual Next Actions

Use this file to build compact, context-dependent action menus at the end of job-search workflow replies.

## Core Rule

Next actions are generated for the current result. They are not a static global menu.

The "wait for user choice" rule applies to normal user-facing skill outputs. It does not apply to internal child-skill steps inside `job-tracker:run`. During `job-tracker:run`, child-skill next actions are advisory for the orchestrator; `job-tracker:run` should continue until the run plan is complete or a hard blocker appears.

For `job-tracker:run`, `Next actions` must not include work that `job-tracker:run` can still perform internally. If the action is in the `job-tracker:run` workflow and required inputs are available, it belongs to `Next internal step` or the internal action queue, not `Next actions`.

If `job-tracker:run` pauses while unfinished and the latest Session Report says `Can continue automatically: yes`, show exactly one user-facing next action:

```md
Active profile: ai

Next actions:
- [n] Continue Run (Recommended) — resume `job-tracker:run` from the latest Session Report and execute the next internal step
```

Do not list child skills such as `job-tracker:company`, `job-tracker:draft`, `job-tracker:cv`, `job-tracker:fit`, `job-tracker:stories`, or `job-tracker:pdf` in that resumable pause footer. The user chose the run plan; the child step belongs in `Run plan`, `Resume point`, or `Next internal step`.

Reviewer outputs inside `job-tracker:run` should make continuation explicit without using user-facing `Next actions`:

```md
Verdict: pass
Continue: yes
Next internal step: run `job-tracker:company ExampleCo`
Active profile: ai
```

`Next actions` are agent actions only: preparation, analysis, verification, drafting, generation, PDF export, tracker updates, or another `job:*` workflow the user can ask the agent to run.

Manual work the user must do outside the agent belongs in a separate `Manual user actions` section. Manual user actions include writing/sending LinkedIn messages or emails, clicking send/connect buttons, replying to recruiters, or manually checking private UI state.

Exception: `job-tracker:apply` may submit an ATS/job application only after explicit user confirmation in the same run. Until that confirmation exists, application submission remains a manual user action.

Do not assign shortcut letters to `Manual user actions`. They are reminders/checklist items, not commands.

## Selection Rules

- Always include the active profile before the action list, using `Active profile: <slug>`.
- Show 2-5 actions, ordered by practical priority.
- Generate shortcuts dynamically for the actions shown.
- Use letters close to the action meaning, preferring the first distinct meaningful letter.
- Avoid duplicate shortcuts within the same footer. If two actions want the same letter, choose the next recognizable letter.
- Do not include actions that are already done or irrelevant.
- If an action would run another job-search workflow, use the `job-tracker:action` command form.
- Every workflow action in `Next actions` must include an explicit `job:*` command.
- Do not include manual LinkedIn/email/application/user-side work in `Next actions`.
- Do not show legacy raw skill commands such as `find-jobs`, `company-research`, `tailor-cv`, or `write-outreach` in user-facing next actions.
- If an action mutates tracker/prep-notes, say what will change.
- Do not run the next action until the user chooses it.
- If the next action is obvious, mark it as `Recommended`.
- If no action is useful, output `Next actions: No immediate next action`.
- When several companies need the same `job-tracker:action`, group them into one action instead of listing repeated single-company actions. Example: `[c] CV ExampleCo, ExampleCo, ExampleCo — run job-tracker:cv for each listed company`.

## Shortcut Hints

These are preferred hints, not a fixed menu. The agent may create other shortcuts when context makes them clearer.

| Preferred key | Action | Meaning |
|---|---|---|
| `n` | run / continue run | Run `job-tracker:run [profile?] [target]`, or resume the latest unfinished `job-tracker:run` when the run is paused-resumable |
| `s` | search | Run `job-tracker:find` |
| `h` | health | Run `job-tracker:health` |
| `v` | verify | Run `job-tracker:verify` |
| `u` | profile | Run `job-tracker:profile status` or `job-tracker:profile use [slug]` |
| `r` | company | Run `job-tracker:company [company]` |
| `d` | draft | Prepare and save manual message drafts with `job-tracker:draft [company]` |
| `c` | cv | Run `job-tracker:cv [company]` |
| `p` | pdf | Run `job-tracker:pdf [resume.md]` |
| `f` | fit | Run `job-tracker:fit [resume.md] [job]` |
| `y` | stories | Run `job-tracker:stories [company-or-topic]` |
| `a` | apply | Run `job-tracker:apply [company-or-url]` |
| `l` | checklist | Prepare a manual application checklist |
| `m` | message | Prepare or refine a manual message draft |
| `t` | update | Update tracker/prep-notes status |
| `o` | defer | Move to monitoring / defer |
| `x` | archive | Archive / mark closed / skip |
| `q` | questions | List questions to clarify before action |

## Shortcut Generation

When building the footer:

1. List the concrete actions first.
2. Pick one lowercase shortcut per action.
3. Prefer meaningful letters:
   - `r` for research
   - `d` for draft/message drafting
   - `y` for stories
   - `c` for CV
   - `p` for PDF
   - `f` for fit review
   - `a` for application form prep/apply
   - `l` for checklist
   - `v` for verify
   - `o` for defer
   - `x` for archive/skip
   - `q` for questions
4. Resolve conflicts locally. Example: if both `CV` and `Clarify` appear, use `[c] CV` and `[q] Questions` or `[l] Clarify`.
5. Never reserve a shortcut for an action that is not shown.

## Footer Format

```md
Manual user actions:
- Acme — use the saved draft in `data/companies/acme/prep-notes.md` and write the recruiter manually.

Active profile: frontend

Next actions:
- [r] Company Research (Recommended) — run `job-tracker:company Acme`
- [d] Draft Messages — prepare and save drafts with `job-tracker:draft Acme`
- [o] Defer — move Acme to Monitoring
```

## Per-Skill Menus

### job-tracker:find

Use when new leads were found:

- Continue the full preparation path with `job-tracker:run`.
- Research strongest Raw Pipeline companies without prep notes.
- Verify when sources were partial/skipped or leads are uncertain.
- Search only for a narrowed follow-up query.
- Defer weak leads that should move to monitoring instead of research.

If no new leads were found:

- Search with different filters.
- Verify current pipeline.
- Ask questions to adjust criteria/sources.

### job-tracker:verify

Use:

- Archive closed/dead roles not yet moved.
- Defer active but weak-fit roles.
- Research active roles without prep notes.
- Prepare manual message drafts for active roles with contacts.
- Tailor CV for active roles that are ready but lack tailored CV.

### job-tracker:company

Use:

- Prepare manual message drafts when useful contacts exist but `### Manual Message Drafts` is missing.
- Tailor CV when the role is active and fit is P1/P2.
- Defer when role/company is weak or no role exists.
- Archive when role is closed or excluded.
- Ask questions when key info is missing.

### job-tracker:draft

Use:

- Refine message variant or tone.
- Save/update manual message drafts in prep notes.
- Tailor CV if a tailored CV should be prepared before manual outreach.
- Export PDF if a PDF should be prepared before manual outreach.
- Prepare application checklist if direct application is the next step.
- Prepare ATS application with `job-tracker:apply` when the CV/PDF are ready and the user wants browser-assisted form filling.

Do not offer to send messages. `job-tracker:draft` prepares and saves manual message drafts in prep notes; the user writes/sends manually outside the skill. Do not mark outreach as sent unless the user explicitly says they sent it outside the tool and asks to update status.

If manual drafts are already prepared, list the user's send/write step under `Manual user actions`, not `Next actions`.

### job-tracker:cv

Use:

- Review fit against the vacancy.
- Export PDF.
- Prepare manual message drafts after CV is ready.
- Prepare application checklist if CV is ready and no fit review is needed.
- Prepare ATS application with `job-tracker:apply` when the CV/PDF are ready.

### job-tracker:fit

Use:

- Update CV with recommended edits via `job-tracker:cv`.
- Map interview stories with `job-tracker:stories` when the fit review exposes important interview gaps or role-specific behavioral themes.
- Export PDF if score is strong and Markdown is ready.
- Prepare manual message drafts if referral/contact path should happen before applying.
- Prepare application checklist if score is strong and PDF is ready.
- Prepare ATS application with `job-tracker:apply` when score is strong and required files are ready.
- Ask questions for unresolved vacancy risks.

### job-tracker:pdf

Use:

- Prepare application checklist if PDF is ready.
- Prepare ATS application with `job-tracker:apply` if the user wants the form scouted or filled.
- Prepare a manual message draft that references the PDF.
- Review fit if the CV has not been reviewed against the vacancy.
- Update tracker/prep notes to mark CV/PDF ready.

### job-tracker:status

Use:

- Run a full pass with `job-tracker:run` when there are fresh leads or ready active roles.
- Research Raw Pipeline companies without prep notes.
- Prepare manual message drafts for active roles with contacts but no draft section.
- Tailor CV for active roles without tailored CV.
- Export PDF for tailored CVs without final PDF.
- Group repeated same-type follow-ups into one action when several active roles need the same `job-tracker:action`.
- Prepare application checklist for roles with CV/PDF ready and no application.
- Prepare ATS applications with `job-tracker:apply` for roles that have CV/PDF ready and a direct application path.
- Map interview stories for roles that are interview-ready or have specific story gaps.
- Verify stale roles or unclear status.
- Run `job-tracker:health` when tracker/files look inconsistent or there are suspected orphan artifacts.
- Defer weak-fit active roles.
- Archive closed/dead roles.
- Review profile settings with `job-tracker:profile status` if active profile or tracker profiles look inconsistent.

### job-tracker:profile

Use:

- Validate profile settings after changing profiles.
- Switch active profile when the user asks to change search strategy.
- Add a new profile when a distinct search strategy is needed.
- Remove a profile only when it is not active and not used in `data/tracker.md`.
- Run `job-tracker:status` after switching active profile.

### job-tracker:health

Use:

- Fix tracker/profile/company artifact issues that were reported.
- Run `job-tracker:status` after fixes to return to pipeline prioritization.
- Run `job-tracker:setup` if health issues are caused by missing base configuration.
- Run `job-tracker:verify` when health issues involve stale or unclear vacancy status.

### job-tracker:apply

Use:

- Run `job-tracker:fit` first if the role has not been reviewed.
- Run `job-tracker:pdf` first if the final PDF is missing.
- Update tracker/prep notes after successful submission or saved draft state.
- Return to `job-tracker:status` after application prep/submission.

Do not suggest sending LinkedIn messages, emails, or connection requests through `job-tracker:apply`.

### job-tracker:run

Use:

- For `paused-resumable`, show only `[n] Continue Run (Recommended)`.
- Include the compact run plan and resume point before the `[n]` action, so the user sees where the run stopped.
- Clarify unresolved decisions listed in the run summary only when the run is `blocked` or `done`.
- Continue with the highest-priority blocked or skipped company after the user chooses only when the run is `blocked` or `done`.
- Put user-side writing/sending from saved message drafts under `Manual user actions`, without shortcuts.
- Prepare manual application checklist when CV/PDF/message drafts are available.
- Map interview stories with `job-tracker:stories` after fit review when the run exposes important interview gaps.
- Run another pass with a different profile or narrowed target.
- Group repeated same-type follow-ups into one action when several companies still need the same `job-tracker:action`.
