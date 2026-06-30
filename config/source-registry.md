# Source Registry

This file owns source values, host patterns, and source-specific access policy. Skills should read this registry instead of hardcoding provider lists or source derivation tables.

## ATS Probe Providers

These providers are supported by `scripts/ats-probe.js` for discovery from public board/listing feeds. They are not liveness checks for a tracked direct job URL.

| Provider | Source value | Host patterns | Discovery feed | Liveness policy |
|---|---|---|---|---|
| `ashby` | `ashby` | `jobs.ashbyhq.com` | `https://api.ashbyhq.com/posting-api/job-board/[slug]?includeCompensation=true` | direct job URL via Browser MCP |
| `lever` | `lever` | `jobs.lever.co` | `https://api.lever.co/v0/postings/[slug]?mode=json` | direct job URL via Browser MCP |
| `greenhouse` | `greenhouse` | `*.greenhouse.io`, `job-boards*.greenhouse.io`, `boards.greenhouse.io` | `https://api.greenhouse.io/v1/boards/[slug]/jobs?content=true` | direct job URL via Browser MCP |
| `workable` | `workable` | `apply.workable.com` | `https://apply.workable.com/[slug]/jobs.md` | direct job URL via Browser MCP |
| `recruitee` | `recruitee` | `*.recruitee.com` | `https://[slug].recruitee.com/api/offers/` | direct job URL via Browser MCP |
| `smartrecruiters` | `smartrecruiters` | `*.smartrecruiters.com` | `https://api.smartrecruiters.com/v1/companies/[slug]/postings?limit=[limit]&offset=[offset]&status=PUBLIC` | direct job URL via Browser MCP |

## ATS Probe Search Defaults

`scripts/ats-probe.js` uses these defaults for discovery filtering. Profile hints can add more keywords, but final fit/reject decisions belong to skills and profile rules.

### Keywords

- frontend
- front-end
- front end
- product engineer
- fullstack
- full-stack
- full stack
- platform
- react
- typescript
- javascript
- design system

### Locations

- remote
- europe
- emea
- eu
- spain
- barcelona
- madrid
- portugal
- lisbon
- uk
- united kingdom
- ireland
- netherlands
- germany
- france

## Browser-Required Sources

Use Browser MCP for these sources. Do not replace them with plain web search when login, session state, filters, or JavaScript rendering are required.

| Source value | Host patterns / URLs | Why browser is required | Required access | Policy |
|---|---|---|---|---|
| `linkedin` | `*.linkedin.com` | login/session-dependent search, people, filters, Easy Apply | Playwright MCP with the user's logged-in account/session | never use API, WebFetch, curl, or web search as a substitute; open in Playwright and wait for user login when needed |
| `djinni` | `djinni.co` | login/session-dependent search, filters, private dashboard state | Playwright MCP with the user's logged-in account/session | never use API, WebFetch, curl, or web search as a substitute; open in Playwright and wait for user login when needed |
| `vc-board` | portfolio boards with JavaScript filters | dynamic filters and stale aggregate listings | Browser MCP when filters/rendering require it | use Browser MCP for discovery; verify final role at company/ATS source |
| `custom-board` | company-specific JavaScript boards | rendered content or custom redirects | Browser MCP when static fetch is incomplete | use Browser MCP when static fetch is incomplete |

## Source Derivation

`job-tracker:import` derives the tracker `Source` value from the canonical URL host using this table. If no pattern matches, use the bare root domain, for example `careers.acme.com` -> `acme`.

| Host pattern | Source value |
|---|---|
| `jobs.ashbyhq.com` | `ashby` |
| `jobs.lever.co` | `lever` |
| `*.greenhouse.io`, `job-boards*.greenhouse.io`, `boards.greenhouse.io` | `greenhouse` |
| `apply.workable.com` | `workable` |
| `*.recruitee.com` | `recruitee` |
| `*.smartrecruiters.com` | `smartrecruiters` |
| `*.teamtailor.com` | `teamtailor` |
| `jobs.wellfound.com`, `wellfound.com` | `wellfound` |
| `otta.com`, `app.otta.com` | `otta` |
| `*.linkedin.com` | `linkedin` |
| `djinni.co` | `djinni` |

## Tracker Source Values

Common tracker `Source` values:

- `linkedin`
- `djinni`
- `ashby`
- `lever`
- `greenhouse`
- `workable`
- `recruitee`
- `smartrecruiters`
- `teamtailor`
- `wellfound`
- `otta`
- `vc-board`
- `custom-board`
- `network`
- `hidden-market`
- `watchlist`

Add new reusable source values here before using them in tracker rows or skill docs.
