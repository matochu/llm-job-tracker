# Job Search Scoring

Search-specific fit, reject, and priority rules live in `strategy/search-profiles/*.md`.

Use this file only for shared scoring mechanics that should not vary by profile.

Tracker table shapes and column rules live in `config/tracker-schema.md`. Do not
redefine tracker row formats here.

## Priority Labels

- **P1:** primary target for the active profile.
- **P2:** good fit with one or more manageable risks.
- **P3:** backup, weak fit, or needs clarification before investing time.

Always explain the concrete reason for the priority using the active profile.

## Fit Score Bands

Fit score verdict thresholds are **profile-specific** and live in each `strategy/search-profiles/*.md` under `## Fit Score Bands`.

`job-tracker:fit` reads the resolved profile and applies its thresholds. If a profile has no `## Fit Score Bands` section, use these defaults:

- **Strong apply (≥45/60):** apply immediately, no tailoring needed.
- **Apply with tailoring (35–44/60):** worth applying; address top gaps in CV before sending.
- **Low ROI (<35/60):** skip unless there is a strong referral or very low competition.

Adjust thresholds in the profile to match search strategy: a broader/aggressive search may lower the strong-apply bar; a selective/senior-only search may raise it.
