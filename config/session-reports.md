# Session Reports

Long-running skills may write one **Session Report** per pass. The report is
the resumable source of truth: plan, progress, decisions, blockers, resume
point, and insights all live in it. Raw logs are optional and never the source
of truth.

`job-tracker:run` must write one Session Report. Other long-running skills may adopt the
same format later; this file is the format authority.

## Paths

Configured in `config/paths.md`:

- **Session reports:** `.sessions/reports/[id].run.md`
- **Session logs (optional):** `.sessions/logs/[id].log`

`.sessions/` is runtime output and is gitignored.

## ID And Filename

- `ID` is a timestamp with the local timezone, compacted for filesystem use:
  `YYYY-MM-DDTHHMMSS` (no colons), e.g. `2026-06-07T103000`.
- Filename is `[id].run.md`, e.g. `2026-06-07T103000.run.md`.
  Skill identity is metadata inside the report, not part of the filename.
- The latest report is the newest file by timestamp. There is no index file
  and no `current` pointer.

## Status Lifecycle

`Status` is one of:

- `running` — the run is in progress.
- `blocked` — the run paused on a hard blocker and can be resumed.
- `done` — the run finished and produced a final summary.
- `abandoned` — the run was dropped without a final summary.

To resume the most recent unfinished run, take the newest report with
`Status: running` or `Status: blocked`.

`Status: running` with `Can continue automatically: yes` means a user-facing
pause is resumable. The user-facing next action for that state is always
`[n] Continue Run`, not a child skill.

## Report Format

```md
# Session Report

- ID: 2026-06-07T103000
- Skill: job-tracker:run
- Status: running
- Profile: <slug>
- Mode: broad | company | filter
- Target: <company / filter / —>
- Started: 2026-06-07T10:30:00+01:00
- Updated: 2026-06-07T10:30:00+01:00

## Goal

## Plan

Use numbered items with explicit state markers:

- `[done]` — completed.
- `[current]` — the next runnable step or the step currently being executed.
- `[pending]` — planned but not reached.
- `[skipped]` — intentionally skipped, with the reason in the item text or
  Decisions.
- `[blocked]` — blocked, with the reason in Blockers.

Exactly one item should be `[current]` while `Status: running`, unless the run
is between batches and the next current item is recorded in `Resume Point`.

## Progress

## Decisions

## Blockers

## Resume Point

- Last completed step:
- Next safe step:
- Required input:
- Can continue automatically: yes/no

## Tracker Updates

## Files Changed

## Artifacts

## Agent Insights

| Type | Severity | Insight | Suggested Fix |
|---|---|---|---|

## Summary
```

Section meaning:

- **Goal** — what this run is trying to achieve.
- **Plan** — the numbered workflow plan, mirrored from the orchestrator.
- Plan items must carry `[done]`, `[current]`, `[pending]`, `[skipped]`, or
  `[blocked]` markers so a paused run can show the user exactly where the run is.
- **Progress** — completed internal steps and current state.
- **Decisions** — choices made and why (profile switch, work-set selection, skips).
- **Blockers** — hard/soft blockers with reasons.
- **Resume Point** — the exact point from which the skill can safely continue.
  It must be updated after every child skill and tracker update, so it never
  points behind the latest Progress entry.
- **Tracker Updates** — what changed in `data/tracker.md` during the run.
- **Files Changed** — files created or edited.
- **Artifacts** — prep notes, CVs, PDFs, drafts, and any child reports produced.
- **Agent Insights** — meta-feedback about the skills/system itself surfaced
  during the run, so the workspace can be improved later. `Type` is e.g.
  `bug`, `friction`, `gap`, `idea`; `Severity` is `low`/`medium`/`high`.
- **Summary** — current or final summary. For `blocked`, include what happened
  and rely on `Resume Point` for continuation.

## Update Rules

- Create the report at run start with `Status: running` and fill Goal and Plan.
- Update the report after each child skill and tracker update (`job-tracker:find`,
  `job-tracker:verify`, `job-tracker:company`, `job-tracker:draft`, `job-tracker:cv`, `job-tracker:fit`, `job-tracker:stories`,
  `job-tracker:pdf`, tracker moves/metadata edits), refreshing `Updated`, Plan,
  Progress, Tracker Updates, Files Changed, Artifacts, and Resume Point.
- Keep `Plan`, `Progress`, and `Resume Point` consistent. If Progress says
  `job-tracker:cv ExampleCo` is done, Resume Point cannot still say the last completed
  step was `job-tracker:draft ExampleCo`.
- Record decisions and blockers when they happen, not only at the end.
- On final summary, set `Status: done` (or `blocked`/`abandoned`) and fill
  Summary, Resume Point, Files Changed, Artifacts, and Agent Insights.
- Logs are optional. When used, append plain chronological lines to the matching
  `.sessions/logs/[id].log`. Logs never replace the report.
