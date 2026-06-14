# Start Here

This is a sanitized starter workspace for a new candidate.

1. Fill `candidate/candidate.md` with real candidate facts.
2. Put the base CV in `candidate/cv/cv-base.md`.
3. Adjust `strategy/search-profiles/default.md` for the target search strategy.
4. Review `config/settings.md`.
5. Run:

```bash
node scripts/check-deps.js
```

Then in the LLM tool run:

```text
job-tracker:setup
```

Once configured, `job-tracker:status` is your home base — run it when unsure what to do next, or use `job-tracker:run` to start an autonomous pass.
