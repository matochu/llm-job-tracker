# Network / Referral Sources

This directory holds personal contact and referral data. **It is gitignored** (except this file and `.gitkeep`) — your contacts stay local.

## What Goes Here

Any file that maps people to companies is a valid network source. Both `job-tracker:find network` and `job-tracker:company` read all files in this directory automatically.

### LinkedIn Connections CSV

Export your first-degree connections from LinkedIn:

1. LinkedIn → Settings → Data Privacy → Get a copy of your data → Connections
2. Save the downloaded CSV as `data/network/connections.csv`

Expected fields: `First Name,Last Name,URL,Email Address,Company,Position,Connected On`

### Curated Referral Notes

Any `.md` file works. Recommended table format for best results:

```md
| Name | Company | Role | LinkedIn | Email | Notes |
|---|---|---|---|---|---|
| [name] | [company] | [role] | [linkedin url] | [email] | [how you know them] |
```

Freeform text (lists, paragraphs) is also accepted — parsed best-effort.

### Legacy Files

Files matching `docs/*referrals*.md` or `docs/*network*.md` are still read as legacy sources. Migrate them here when convenient.

## Privacy

Do not commit personal contact data. Only `README.md` and `.gitkeep` are committed from this directory.
