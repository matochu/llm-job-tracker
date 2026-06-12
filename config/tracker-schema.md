# Tracker Schema

The tracker is `data/tracker.md`.

## Main Sections

- `🎯 Active Pipeline`: verified active jobs with priority, status, contacts, and links.
- `💤 Monitoring`: companies worth monitoring but without an active relevant role.
- `🆕 Staging`: unverified or low-priority leads.
- `🧪 Raw Pipeline`: newly found leads awaiting company research / prioritization.
- `📬 Submitted / In Process`: submitted applications and next actions.
- `🗄 Archive`: closed, rejected, skipped, or dead roles.

## Update Rules

- Keep edits narrow and preserve existing user notes.
- Every job table must include a `Profile` column immediately after `Company`.
- `Profile` values must match a slug listed in `config/settings.md`.
- New leads added by `job-tracker:find` must use the active profile from `config/settings.md`.
- Existing tracked vacancies must be processed using their row-level `Profile`, not the active profile.
- Do not duplicate companies across active pipeline and Raw Pipeline unless there are separate roles.
- Move closed roles to Archive with the verification date and reason.
- Move companies with useful contacts but no role to Monitoring.
- Use the current date for `Updated`, `Checked`, `Added`, or archive status.
- Prefer Markdown links already used by the tracker.

## Table Requirements

Required job table shape for `Raw Pipeline`:

```md
| Company | Profile | Role | URL | Added | Status |
|---|---|---|---|---|---|
| Example | frontend | Senior Frontend Engineer | https://example.com/job | YYYY-MM-DD | ⬜ |
```

All active, staging, submitted, and archive job rows must preserve `Profile` when moved between sections.
