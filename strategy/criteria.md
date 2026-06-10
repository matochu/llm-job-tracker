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
