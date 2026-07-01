# Profile Resolution

Shared rule for deciding which search profile a skill uses. Skills reference this file instead of restating the rule.

1. Read the active profile from `config/settings.md`.
2. For new or untracked work (job discovery, an untracked target, an untracked application URL), use the active profile from settings.
3. For an existing tracked vacancy, use the `Profile` value from the matching `data/tracker.md` row. Match by URL when one is available; otherwise match by Company + Role. If more than one row matches, ask the user to disambiguate instead of guessing.
4. Treat all arguments as normal skill arguments; profiles are not passed in commands.

Exceptions: `job-tracker:import` auto-selects the best-fit profile across all configured profiles, and `job-tracker:run` accepts an optional profile slug as its first argument. Those skills define their own profile logic and do not follow the rule above.
