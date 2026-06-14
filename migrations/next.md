# Migration: next (staging)

Applied by `job-tracker:health` when `.migrated-version` < installed version.

---

## Step 1 — Add `## Fit Rubric` section to `strategy/criteria.md`

**Target file:** `strategy/criteria.md`.

**Check:** search the file for the exact string `## Fit Rubric`.
- If found → step is satisfied; skip.
- If not found → apply.

**Apply:** insert the following block immediately before the `## Fit Score Bands` heading (or at end of file if that heading is missing):

```md
## Fit Rubric

`job-tracker:fit` applies this rubric when scoring a CV against a vacancy. The rubric is the shared definition; the resolved profile's `## Fit Score Bands` determines the thresholds.

### Three-layer model

1. **Hard Gates** — checked before scoring. Three outcomes:
   - **PASS** — no profile reject rule or candidate hard constraint is violated.
   - **DISQUALIFIED** — a reject rule or constraint is clearly violated. Overrides the band to **Disqualified by rule** regardless of the numeric score.
   - **UNRESOLVED** — a hard constraint applies (work authorization, location, timezone) but the JD/sources do not state enough to verify it. Does **not** change the numeric score, but forbids an "apply now" recommendation — the recommendation becomes "clarify <constraint> first."

2. **Fit score (`/60`)** — six pure-fit dimensions, 1–5 each. `Total = (Σ of 6) × 2`.

3. **Application ROI / effort** — recommendation modifier only, never part of the total. Referral availability, competition, deadline, tailoring cost, pipeline capacity. Shapes the concrete recommendation (apply now / tailor first / get referral / defer) without changing the band.

### Six fit dimensions

| # | Dimension | 1 | 3 | 5 |
|---|---|---|---|---|
| 1 | **Requirements match** | Most must-haves missing | Mixed — some gaps, some strong | All must-haves met or clearly transferable |
| 2 | **Profile alignment** | Clearly outside target role family or work mode | Partial overlap | Strong match: role family, tech, work mode all align |
| 3 | **Seniority & scope** | Clear level mismatch (over/under) | Boundary or ambiguous | Level and IC/management shape match CV trajectory |
| 4 | **Compensation & logistics** | Constraint clearly violated | Partial uncertainty or minor mismatch | All constraints met or clearly compatible |
| 5 | **Culture & red flags** | Multiple red flags in company/JD | Neutral or one concern | Positive signals, no red flags |
| 6 | **Growth & trajectory** | Role moves backward or sideways | Neutral growth | Advances the candidate's stated direction |

`Total = (D1 + D2 + D3 + D4 + D5 + D6) × 2` → /60.

### Evidence matrix

Not every dimension has a CV line or JD requirement. Score only from evidence that applies; never fabricate missing signals.

| Dimension | Primary evidence | If primary not stated |
|---|---|---|
| Requirements match | CV + JD | n/a (JD always present) |
| Profile alignment | JD + Profile | n/a |
| Seniority & scope | CV + JD | n/a |
| Compensation & logistics | JD + Candidate (+ Company if available) | comp unknown → `Unknown`, score **3**; location/work-auth/timezone unknown **while a candidate hard constraint applies** → Hard Gate **UNRESOLVED**, not neutral 3 |
| Culture & red flags | Company + JD | mark `Unknown`, score **3** — do not invent reputation |
| Growth & trajectory | CV + JD/Profile | n/a |

When required evidence is absent, mark it `Unknown` and score **3** — never invent external signals (Glassdoor, comp, referral) that were not loaded.
```

**Success condition:** `## Fit Rubric` is present in the file after the write.

**Failure condition:** the file is not found or the string is absent after the write. Stop and report.

Reason: `strategy/criteria.md` is init-only (not in CLI `managedEntries`), so `update` does not refresh it — same pattern as the Fit Score Bands migration.

---

## Step 2 — Update session-report path in `config/paths.md`

**Target file:** `config/paths.md`.

**Check:** search the file for the exact string `[id].<skill>.md`.
- If found → step is satisfied; skip.

**Apply:** replace the line:
```
- **Session reports:** `.sessions/reports/[id].run.md`
```
with:
```
- **Session reports:** `.sessions/reports/[id].<skill>.md`
```

**Success condition:** `[id].<skill>.md` is present in the file after the write.

**Failure condition:** the anchor string `[id].run.md` is not found in the file, or `[id].<skill>.md` is absent after the write. Stop and report. Do not bump `.migrated-version`.

---

## Step 3 — Update profile-switch exception in `config/settings.md`

**Target file:** `config/settings.md`.

**Check:** search the Profile Rules section for the string `job-tracker:import`.
- If found → step is satisfied; skip.

**Apply:** **replace the entire bullet** that begins "User-facing commands do not pass profiles as arguments, except `job-tracker:run`" with the following (preserve surrounding bullets unchanged):

```
- User-facing commands do not pass profiles as arguments, except `job-tracker:run` (may take a profile slug) and `job-tracker:import` (takes no slug — auto-selects the best-fit profile and switches to it, asking on ties); both switch the active profile via `job-tracker:profile use`. Other skills read the active profile from `config/settings.md` for new discovery or the row-level `Profile` in `data/tracker.md` for tracked jobs.
```

Do **not** merely insert `and job-tracker:import` into the existing text — replace the full bullet to avoid implying that import takes a slug argument.

**Success condition:** the bullet contains both `job-tracker:run` and `job-tracker:import` with import described as no-slug/auto-select.

**Failure condition:** the anchor bullet starting with "User-facing commands do not pass profiles" is not found, or `job-tracker:import` is absent after the write. Stop and report. Do not blind-append. Do not bump `.migrated-version`.
