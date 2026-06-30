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
- New leads added by `job-tracker:find` must use the active profile from `config/settings.md`. `job-tracker:import` writes the row under its auto-selected best-fit profile (it switches the active profile first, so the row always matches the active profile at write time).
- Existing tracked vacancies must be processed using their row-level `Profile`, not the active profile.
- Do not duplicate companies across active pipeline and Raw Pipeline unless there are separate roles.
- Move closed roles to Archive with the verification date and reason.
- Move companies with useful contacts but no role to Monitoring.
- Use the current date for `Updated`, `Checked`, `Added`, or archive status.
- Prefer Markdown links already used by the tracker.

## Table Requirements

Required job table shape for `Raw Pipeline`:

```md
| Company | Profile | Role | URL | Added | Status | Source |
|---|---|---|---|---|---|---|
| Example | frontend | Senior Frontend Engineer | https://example.com/job | YYYY-MM-DD | ⬜ | linkedin |
```

The `Source` column records where the lead came from. Common values: `linkedin`, `ashby`, `greenhouse`, `lever`, `djinni`, `vc-board`, `network`, `hidden-market`, `watchlist`. Use `network` when the lead was discovered via `job-tracker:find network`. `job-tracker:import` derives the source automatically from the URL host (see `skills/import/SKILL.md` Source Derivation table). Leave blank or omit when the source is obvious from URL or ATS.

All active, staging, submitted, and archive job rows must preserve `Profile` when moved between sections.

For compact tables that do not include both `Role` and URL-like columns, updates must use a selector that uniquely identifies one row. Prefer URL-based updates when available; avoid company-only status changes when the same company can appear multiple times.

## CLI Schema Aliases

`scripts/tracker.js` treats these names as canonical aliases. Agents should use the canonical names in commands; table headers may use any configured label.

### Section Aliases

| Canonical | Labels |
|---|---|
| `active` | `Active Pipeline` |
| `monitoring` | `Monitoring` |
| `staging` | `Staging` |
| `raw` | `Raw Pipeline` |
| `submitted` | `Submitted / In Process`, `Submitted`, `In Process` |
| `archive` | `Archive` |

### Field Aliases

| Canonical | Labels |
|---|---|
| `company` | `Company` |
| `profile` | `Profile` |
| `role` | `Role`, `Position` |
| `url` | `URL`, `Url`, `Link`, `Links` |
| `location` | `Location` |
| `fit` | `Fit` |
| `priority` | `Pri`, `Priority` |
| `status` | `Status` |
| `contact` | `Contact / Channel`, `Contact`, `Channel` |
| `updated` | `Updated`, `Checked` |
| `added` | `Added` |
| `source` | `Source` |
| `notes` | `Notes`, `Note` |
| `detail` | `Detail`, `Details` |
| `date` | `Date` |
| `next` | `Next`, `Next Step` |

### Localized Field List

If the tracker uses translated headers or section names, add those labels to the alias tables above in this workspace. Do not add translations for languages that are not used by the tracker.
