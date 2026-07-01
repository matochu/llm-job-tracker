# Job Search Settings

## Active Profile

- **Profile slug:** `default`
- **Profile file:** `strategy/search-profiles/default.md`

## Profile Rules

For which profile a skill should use (active profile vs. a tracked row's `Profile` value, and the argument exceptions for `job-tracker:import`/`job-tracker:run`), see `config/profile-resolution.md`. This section covers what profiles are allowed to affect, not how one is selected.

- Profiles refine positioning, keywords, source priorities, and fit signals.
- Profiles do not override truthfulness rules, candidate identity, language rules, or tracker schema.

## Available Profiles

- `default` — baseline search profile for this candidate.
