# Job Search Settings

## Active Profile

- **Profile slug:** `default`
- **Profile file:** `strategy/search-profiles/default.md`

## Profile Rules

- Skills should read this file before choosing a profile.
- New job discovery uses the active profile above.
- Existing tracked vacancies use the `Profile` value stored in `data/tracker.md`.
- User-facing commands do not pass profiles as arguments, except `job:run`, which may take a profile slug and switches the active profile via `job:profile use` before running.
- Treat all other command arguments as normal skill arguments, such as company names, sections, keywords, paths, or vacancy URLs.
- Profiles refine positioning, keywords, source priorities, and fit signals.
- Profiles do not override truthfulness rules, candidate identity, language rules, or tracker schema.

## Available Profiles

- `default` — baseline search profile for this candidate.
