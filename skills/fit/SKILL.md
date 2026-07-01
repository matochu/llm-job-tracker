---
name: job-tracker:fit
description: "Scores a CV against a specific vacancy, checks configured CV style, keyword coverage, risks, interview readiness, and suggests concrete edits."
argument-hint: "<path/to/resume.md> <vacancy-url-or-path-or-paste>"
---

Review a CV against a specific vacancy.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. `config/profile-resolution.md`, then the profile it resolves to
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md` (includes `## Fit Rubric` and `## Fit Score Bands`)
7. `style/cv-style.md`
8. `candidate/stories.md`
9. `config/next-actions.md`

Optionally, if the vacancy is already tracked, also read:
- the matching row in `data/tracker.md` (for resolved profile, status, and company context)
- `data/companies/[slug]/prep-notes.md` if it exists (Company-evidence for Culture & red flags dimension)

Absence of these optional files is fine — affected dimensions use `Unknown` / neutral 3 per the evidence matrix.

## Profile Resolution

Follow `config/profile-resolution.md`.

## Subagent Execution

Run the CV/vacancy fit review in a subagent when the current tool supports subagents.

When `job-tracker:run` needs multiple independent fit reviews, run them as a batch of parallel subagents when the tool runtime supports it. Each subagent receives only one CV/vacancy/profile context and must not edit files. If parallel subagents are unavailable, process the batch sequentially and state that batching was unavailable.

Main agent responsibilities:

1. Resolve the CV path, vacancy source, and profile context.
2. Spawn one subagent with the bounded task: review this CV against this vacancy using the resolved profile and configured CV style.
3. Give the subagent only the relevant files, URL/text, and scoring/output requirements.
4. Do not ask the subagent to edit files.
5. Review the subagent result, then produce the final user-facing answer with the required footer.

Subagent responsibilities:

- read the CV, vacancy, resolved profile, `style/cv-style.md`, and `strategy/criteria.md` (including `## Fit Rubric`)
- check Hard Gates (profile reject rules + candidate hard constraints) → PASS / DISQUALIFIED / UNRESOLVED
- score the 6-dimension rubric from `strategy/criteria.md`, citing only the evidence types that apply per the evidence matrix; mark Unknown + score 3 when evidence is absent; raise UNRESOLVED (not neutral 3) when logistics evidence is absent while a hard constraint applies
- never fabricate external signals (Glassdoor, comp, referral, reputation) not present in loaded files
- report any Hard Gate hit with the triggering rule or constraint
- score fit, style, keyword coverage, risks, and interview readiness
- suggest concrete edits without applying them
- return a concise structured review for the main agent to integrate

If subagents are unavailable, perform the review in the main agent and state that subagent execution was unavailable.

If this skill is called by `job-tracker:run`, its output is an internal fit-review result for the orchestrator. Suggested CV edits, PDF export, or tracker updates must be added to the `job-tracker:run` internal action queue when appropriate, not treated as user-facing stop points. Report `Run progress` and the exact `Next internal step:` when runnable internal work remains.

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
4. Hard Gates — before scoring, check:
   a. Profile reject rules from the resolved profile.
   b. Candidate hard constraints from `candidate/candidate.md` (work authorization, location/timezone, legal).
   Emit PASS / DISQUALIFIED / UNRESOLVED with the triggering rule or constraint.
   - DISQUALIFIED → record "Disqualified by rule: \<rule\>"; proceed to score for reference but override the verdict.
   - UNRESOLVED → record "UNRESOLVED: clarify \<constraint\>"; proceed to score normally but forbid "apply now" in the recommendation.
5. Score fit using the `## Fit Rubric` in `strategy/criteria.md`. Score each of the 6 dimensions 1–5 per the anchors and evidence matrix. `Total = (Σ of 6) × 2`. Apply the fit score bands from the resolved profile's `## Fit Score Bands` section to determine the verdict. If the profile has no `## Fit Score Bands` section, use the defaults from `strategy/criteria.md`.
   - If Hard Gate is DISQUALIFIED, override verdict to "Disqualified by rule" regardless of numeric score.
   - If Hard Gate is UNRESOLVED, keep the band verdict but change the recommendation to "clarify \<constraint\> first."
   - Application ROI / effort (referral, competition, deadline, tailoring cost) shapes the Recommendation only — do not add it to the total.
6. Check CV style and hygiene:
   - forbidden sections or phrases
   - career expectations quality
   - keyword coverage
   - over-targeting or invented evidence
   - readability and ATS compatibility
7. Suggest concrete edits. Do not apply edits unless the user asks.
8. Match existing interview stories from `candidate/stories.md` to the vacancy themes using story IDs. Report `Strong`, `Workable`, `Stretch`, or `Gap` for each important interview theme. If coverage is missing, suggest `job-tracker:stories [company-or-topic]` questions instead of inventing stories.
9. If the user asks, apply edits and suggest `job-tracker:pdf [resume.md]`.

## Output

Reply in the configured assistant language using this structure:

```md
# CV Fit Review — [Company / Role]

## Vacancy Snapshot

- Level / IC vs management:
- Must-have:
- Domain / mode:

## Hard Gates

- [PASS | DISQUALIFIED: \<rule or constraint\> | UNRESOLVED: \<constraint to clarify\>]

## Score

| Dimension | Score (1–5) | Evidence | Cited | Rationale |
|---|---:|---|---|---|
| Requirements match | | CV + JD | | |
| Profile alignment | | JD + Profile | | |
| Seniority & scope | | CV + JD | | |
| Compensation & logistics | | JD + Candidate | | |
| Culture & red flags | | Company + JD | | |
| Growth & trajectory | | CV + JD/Profile | | |

**Total: NN/60** — **Verdict: [Strong apply | Apply with tailoring | Low ROI / skip | Disqualified by rule]**

*(UNRESOLVED Hard Gate does not change the band but blocks an "apply now" recommendation.)*

## Application ROI / Effort

- referral path, competition, deadline, tailoring cost, pipeline capacity

**Recommendation:** [apply now | tailor top gaps first | get referral first | clarify \<constraint\> first | defer | skip]

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
- List gaps as questions for `job-tracker:stories`, not fabricated examples.

Active profile: <slug>

Next actions:

- context-specific `job-tracker:action` next actions from `config/next-actions.md`
```
