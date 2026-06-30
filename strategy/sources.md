# Job Sources

Use this file as the source checklist for `job-tracker:find`. Do not silently skip sources. If a source cannot be checked because of login, MCP/browser failure, rate limits, or network issues, record it in the final source report.

For browser-specific interaction rules, read `config/browser-patterns.md` before using Browser MCP.

## Search Modes

- **Web search:** good for discovering companies, job-board URLs, funding/news triggers, HN threads, and public ATS pages.
- **Browser MCP:** required for LinkedIn, Djinni, JavaScript-rendered ATS pages, portfolio boards with filters, and sites that need login/session state. Use Playwright MCP or Chrome DevTools MCP only for these sources; do not use plain web search as a fallback for logged-in or browser-rendered checks.
- **ATS APIs:** best for exact verification when available.
- **Company careers page:** final source of truth when API/search results disagree.

## Required Source Pass

Run these groups every broad search unless the user explicitly narrows the request:

1. LinkedIn Jobs
2. ATS direct discovery
3. VC portfolio boards
4. Spain / Iberia boards
5. Djinni
6. Target company watchlist
7. Hidden market: funding/news + Hacker News

Optional / secondary sources are listed later. Use them when required sources are weak or the user asks for a deeper pass.

For the `ai` profile, also run the AI / DevEx discovery pass when doing a broad search and include it in the source report.

## 1. LinkedIn Jobs

Use Browser MCP only, preferably Playwright MCP or Chrome DevTools MCP, because LinkedIn search and filters are session-dependent. If the browser is not authenticated, open LinkedIn in the browser and wait for the user to log in manually. Do not replace this with web-search snippets.

### Fast Queries

- `frontend engineer Barcelona`
- `senior frontend engineer Barcelona`
- `senior frontend engineer remote Europe`
- `staff frontend engineer remote Europe`
- `principal frontend engineer EMEA`
- `react typescript remote Europe`
- `frontend platform engineer Europe`
- `design systems frontend Europe`

### Filters

- Date posted: Past week first, then Past month.
- Experience: Mid-Senior, Director only if IC/Principal-like.
- Location: Barcelona, Spain, European Union, Remote, EMEA.
- Company type: prefer product/SaaS; reject agencies/outstaff.

### Verification

Do not add a LinkedIn-only lead directly. Open the company careers page or ATS page and verify the job is still active.

## 2. ATS Direct Discovery

Use web search and direct ATS URLs. Prefer current board/listing pages over old job IDs during discovery.

Treat ATS APIs as the highest-signal discovery layer. When a company has a known ATS slug, prefer the provider API/feed before browser search. Browser or web search is still required when the company uses a custom careers page, the ATS slug is unknown, or the provider API does not expose enough detail.

Canonical probe command:

```bash
node scripts/ats-probe.js [provider] [slug]
node scripts/ats-probe.js batch [provider] [slug...] --limit 10
node scripts/ats-probe.js discover [company-or-domain]
node scripts/ats-probe.js [provider] [slug] --json
```

Use this script for supported providers before writing one-off `curl`, shell loops, `jq`, or inline JSON parsing. It normalizes title, location, id, and URL.

Warning: ATS board APIs are for discovery only, not liveness verification.

Board listing endpoints such as `/posting-api/job-board/[slug]`, `/v0/postings/[slug]?mode=json`, and `/v1/boards/[slug]/jobs` return roles currently exposed on the public board. A role can still be active at its direct URL while absent from the board listing because it is paused, unlisted, hidden, or not featured. Never infer that a tracked job is closed because it is missing from a board API response. Use browser MCP, preferably Playwright, on the direct job URL to verify liveness.

### Ashby

Discovery queries:

- `site:jobs.ashbyhq.com "Senior Frontend Engineer" "Remote"`
- `site:jobs.ashbyhq.com "Staff Frontend Engineer" "Europe"`
- `site:jobs.ashbyhq.com "Product Engineer" "React" "Europe"`
- `site:jobs.ashbyhq.com "Frontend" "Barcelona"`

API pattern:

```bash
curl -s "https://api.ashbyhq.com/posting-api/job-board/[slug]?includeCompensation=true"
```

Check `jobs` or `jobPostings` for frontend/fullstack/product engineering roles.

### Greenhouse

Discovery queries:

- `site:job-boards.greenhouse.io "Senior Frontend Engineer" "Remote"`
- `site:job-boards.eu.greenhouse.io "Frontend" "Spain"`
- `site:boards.greenhouse.io "React" "TypeScript" "Europe"`

API pattern:

```bash
curl -s "https://api.greenhouse.io/v1/boards/[slug]/jobs?content=true"
```

### Lever

Discovery queries:

- `site:jobs.lever.co "Senior Frontend Engineer" "Spain"`
- `site:jobs.lever.co "Frontend Engineer" "Remote Europe"`
- `site:jobs.lever.co "React" "TypeScript" "Barcelona"`

API pattern:

```bash
curl -s "https://api.lever.co/v0/postings/[slug]?mode=json"
```

### Other ATS / Boards

Also check Workable, SmartRecruiters, Recruitee, Breezy, Personio, Teamtailor, Otta/Welcome to the Jungle, and custom company boards when discovered.

Provider patterns:

```bash
curl -s "https://apply.workable.com/[slug]/jobs.md"
curl -s "https://api.smartrecruiters.com/v1/companies/[slug]/postings?limit=100&offset=0&status=PUBLIC"
curl -s "https://[slug].recruitee.com/api/offers/"
```

Rules:

- Use provider APIs/feeds only for known trusted ATS hosts.
- Do not add old individual job IDs from search snippets unless the current board still lists the role.
- If an API/feed returns roles without enough detail, open the role URL and verify against the company page before adding it.
- If a board is rate-limited or slow, record `partial` in the source report instead of silently skipping it.

## 3. VC Portfolio Boards

High-signal source for product/startup roles. Use Browser MCP because filters often require JavaScript. If login or session setup is required, open the board in the browser and wait for the user.

### Required Boards

- Balderton: `https://talent.balderton.com`
- Accel: `https://jobs.accel.com`
- Index Ventures: `https://jobs.indexventures.com`
- Sequoia: `https://job-boards.sequoiacap.com`
- Point Nine: `https://jobs.pointnine.com`
- Creandum: `https://jobs.creandum.com`
- Atomico: `https://atomico.com/careers/job-board`
- Cherry Ventures: `https://jobs.cherry.vc`
- Northzone: search `Northzone portfolio jobs`
- EQT Ventures: search `EQT Ventures portfolio jobs`
- Project A: search `Project A portfolio jobs`
- Speedinvest: search `Speedinvest portfolio jobs`
- Insight Partners: `https://jobs.insightpartners.com`
- Bessemer Venture Partners: `https://jobs.bvp.com`
- Lightspeed: `https://jobs.lsvp.com`
- General Catalyst: `https://jobs.generalcatalyst.com`
- a16z: `https://a16z.com/jobs/`
- Runa Capital: search `Runa Capital portfolio jobs`

### Filters / Search Terms

- Function: Engineering / Software Engineering.
- Location: Remote, Europe, EMEA, Spain, Barcelona.
- Keywords: `frontend`, `front-end`, `react`, `typescript`, `fullstack`, `product engineer`, `design systems`, `platform`.
- For `ai`: also search `developer experience`, `devex`, `AI`, `agent`, `workflow`, `observability`, `dashboard`, `internal tools`, `SDK`.

### Verification

Open the company ATS/careers job page before adding to tracker. Portfolio boards can show stale roles.

## 4. Spain / Iberia Boards

Use Browser MCP for filters where available. If the board requires login/session state, open it in the browser and wait for the user.

### Landing.jobs

- URL: `https://landing.jobs/jobs`
- Search terms: `Frontend`, `React`, `TypeScript`, `Fullstack`, `Angular`.
- Filters: Spain, Portugal, Remote, Senior.
- Prefer transparent salary/product roles.

### Tecnoempleo

- URL: `https://www.tecnoempleo.com`
- Search terms:
  - `React Barcelona`
  - `Frontend Barcelona`
  - `Senior Frontend remoto`
  - `TypeScript remoto`
- Expect noise. Reject consulting/body-shop roles unless company is strategically useful.

### Manfred

- URL: `https://www.getmanfred.com`
- Search terms: `Frontend`, `React`, `TypeScript`, `Fullstack`.
- Prefer transparent salary and remote/hybrid Spain roles.

### Secondary Spain Sources

- InfoJobs: only targeted company checks, not broad search.
- Babel Profiles: useful for passive/local recruiter channel.
- Prometeo Talent: useful for senior IT/passive roles.

## 5. Djinni

Use Browser MCP only, preferably Playwright MCP or Chrome DevTools MCP. If redirected to login, open Djinni in the browser and wait for the user to log in manually. Do not replace this with plain web search.

### Required Passes

1. Dashboard: `https://djinni.co/my/dashboard/`
2. React product search:
   - `https://djinni.co/jobs/?all_keywords=React&search_type=basic-search&salary=4000&company_type=product`
3. Frontend product search:
   - `https://djinni.co/jobs/?all_keywords=Frontend&search_type=basic-search&salary=4000&company_type=product`
4. Angular product search:
   - `https://djinni.co/jobs/?all_keywords=Angular&search_type=basic-search&salary=4000&company_type=product`
5. Next.js product search:
   - `https://djinni.co/jobs/?all_keywords=Next.js&search_type=basic-search&salary=4000&company_type=product`

Run with and without `region=eu` when results look thin.

### Filters

- `company_type=product` preferred; `startup` acceptable.
- `english_level=intermediate` matches B1; do not force upper/fluent unless user asks.
- Reject outsource/outstaff/agency.

## 6. Target Company Watchlist

Check company careers pages directly for companies already in tracker monitoring/staging or current strategic shortlist.

### Typical Watchlist

- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo
- ExampleCo

### Developer Tools / Observability Watchlist

Use this as a high-signal discovery path for `ai` and frontend-platform searches. Check careers pages directly and verify each active role on the company source of truth.

- Observability / dashboards: ExampleCo, ExampleCo, ExampleCo, ExampleCo, ExampleCo, ExampleCo, ExampleCo.
- DevEx / SDK / platform: ExampleCo, ExampleCo, ExampleCo, ExampleCo, ExampleCo, ExampleCo, ExampleCo, ExampleCo, ExampleCo.
- AI workflow / agent UI: ExampleCo, ExampleCo, ExampleCo, ExampleCo, ExampleCo.
- Data-heavy product UI: ExampleCo, ExampleCo, ExampleCo, ExampleCo.

Search terms:

- `frontend platform`
- `developer experience`
- `SDK`
- `React TypeScript`
- `observability frontend`
- `dashboard frontend`
- `AI workflow frontend`
- `internal tools frontend`

Use tracker and `data/companies/*/prep-notes.md` as the source of the current watchlist. Do not assume this static list is exhaustive.

### Known ATS Watchlist

When a watched company has a known ATS URL or slug, check the ATS directly before using broad web search. Add new confirmed ATS URLs here as they are discovered.

| Company | ATS / Careers URL | Notes |
|---|---|---|
| ExampleCo | company careers / ATS page | verify active frontend, observability UI, and platform roles |
| ExampleCo | Ashby / company careers | strong DevEx, product analytics, and frontend platform signal |
| ExampleCo | Ashby / company careers | DevEx, platform, docs/DX, and frontend product roles |
| ExampleCo | Ashby / company careers | auth platform, developer experience, product engineering |
| ExampleCo | company careers / ATS page | observability, product UI, SDK/DX adjacent |
| ExampleCo | company careers / ATS page | DevEx, SDK, CMS product engineering |
| ExampleCo | company careers / ATS page | AI product UI and frontend roles |
| ExampleCo | company careers / ATS page | workflow automation, AI agents, frontend/fullstack |
| ExampleCo | company careers / ATS page | observability and dashboard-heavy frontend |

Keep this table lightweight. It is a routing aid for `job-tracker:find`, not a complete company database.

Known ATS slugs and URLs are reliable for discovery: finding new role IDs on the board. For liveness verification of a specific tracked job ID, always use browser MCP, preferably Playwright, on the direct job URL instead of the board API.

## 7. AI / DevEx Sources

Use this pass for the `ai` profile or when the user asks for AI-enabled frontend, DevEx, platform, observability, or internal-tools roles.

These sources are discovery layers, not sources of truth. Verify each interesting role on the company careers page or ATS before adding it to the tracker.

### AI Job Aggregators

- HiredinAI: `https://www.hiredinai.com/`
- TixelJobs: `https://www.tixeljobs.com/`
- DeepTechJobs.io: `https://deeptechjobs.io/`

### YC / Startup Sources

Use this pass for `ai`, startup, DevEx, product-engineering, or founding-engineer searches. These are discovery layers; verify roles on the employer ATS/careers page before adding them.

- YC Work at a Startup / Y Combinator jobs:
  - `site:ycombinator.com/jobs "Frontend" "React" remote`
  - `site:ycombinator.com/jobs "Developer Experience" OR "DevRel" OR "Product Engineer"`
  - `site:ycombinator.com/jobs "Applied AI" OR "AI Engineer" OR "AI Agent"`
  - `site:workatastartup.com "Frontend" OR "Product Engineer" OR "Applied AI" remote Europe`
- Wellfound / AngelList: use Browser MCP when filters or login/session state are needed.

### Hiring.cafe

Use Browser MCP only. Hiring.cafe is a discovery surface, not a source of truth.

Workflow:

1. Open `https://hiring.cafe` in browser MCP.
2. Search with profile-specific terms and apply location/timezone filters.
3. Extract only visible job cards or rows; do not dump full page text.
4. Open the direct employer/ATS URL for every promising result.
5. Add only the direct employer/ATS URL to the tracker, never a Hiring.cafe URL.

Suggested searches:

- `Senior Frontend Engineer React TypeScript Europe`
- `Frontend Platform Engineer Remote Europe`
- `Product Engineer React Remote Europe`
- `Developer Experience Engineer SDK Remote Europe`
- `AI Product Engineer Frontend Remote Europe`

### Search Terms

- `frontend`
- `react`
- `typescript`
- `product engineer`
- `developer experience`
- `frontend platform`
- `internal tools`
- `observability`
- `dashboard`
- `AI workflow`
- `agent UI`
- `copilot`
- `SDK`
- `Remote Europe`
- `EMEA`

### Reject Rules

- Reject ML-only, data science, AI research, backend-heavy AI infrastructure, and DevRel-only roles unless the frontend/platform ownership is explicit.
- Reject AI keyword-marketing roles where the product surface or team scope does not show real AI-enabled UI, workflow, platform, or developer-tooling work.
- Treat US-only timezone roles as low ROI unless the company explicitly supports EMEA overlap.

## 8. Hidden Market

### Funding / News Triggers

Search for recent European and Spanish startup funding:

- `site:sifted.eu Spain startup funding Series A frontend`
- `site:eu-startups.com/category/funding Spain SaaS funding`
- `site:tech.eu funding Barcelona startup Series A`
- `Barcelona startup raises Series A SaaS`
- `Europe startup raises Series B developer tools`
- `Europe startup raises Series A developer tools`
- `Europe startup raises Series B observability`
- `AI workflow startup Europe funding`
- `developer tools startup Europe funding`

When a strong company appears, add it to monitoring or suggest `job-tracker:company`, even if no frontend job is currently public.

### Hacker News "Who is hiring?"

- Source: `https://news.ycombinator.com/submitted?id=whoishiring`
- Open the latest monthly "Who is hiring?" thread.
- Search in-page for: `Remote`, `Europe`, `EMEA`, `Frontend`, `React`, `TypeScript`, `Barcelona`, `Spain`.
- Reject US-only timezone roles.

## Optional / Secondary Sources

Use when required sources are weak or when the user asks for a wider pass:

- Wellfound / AngelList
- Welcome to the Jungle
- Otta
- YC Work at a Startup
- Hiring.cafe
- Himalayas
- NoDesk frontend remote jobs
- remote-job.net
- RemoteDevJobs
- Workwise for DACH / EU remote frontend roles
- Indeed / Glassdoor, only with strict verification on company careers pages
- Company newsletters or engineering blogs
- Recruiter posts on LinkedIn

## Avoid By Default

- RemoteOK, WeWorkRemotely, Remote.co, Arc.dev for broad search: too US/timezone-heavy.
- FAANG direct unless user explicitly asks.
- UK/DE recruiter agencies unless there is a specific strong lead.

## Source Report

Every `job-tracker:find` run must end with a source report:

| Source group | Status | Method | Findings | Notes |
|---|---|---|---|---|
| LinkedIn Jobs | checked / partial / skipped | MCP / web | N leads | login, blockers, filters |
| ATS Direct | checked / partial / skipped | web/API/MCP | N leads | boards checked |
| ATS Providers | checked / partial / skipped | API/feed | N leads | Ashby, Greenhouse, Lever, Workable, SmartRecruiters, Recruitee |
| VC Boards | checked / partial / skipped | MCP/web | N leads | boards checked/skipped |
| Spain/Iberia | checked / partial / skipped | MCP/web | N leads | boards checked/skipped |
| Djinni | checked / partial / skipped | MCP | N leads | login/blockers |
| Watchlist | checked / partial / skipped | web/MCP | N leads | companies checked |
| AI / DevEx | checked / partial / skipped | web/MCP | N leads | sources checked |
| Startup / YC | checked / partial / skipped | web/MCP | N leads | YC, Wellfound, Hiring.cafe |
| Remote Aggregators | checked / partial / skipped | web/MCP | N leads | Himalayas, NoDesk, RemoteDevJobs |
| Hidden Market | checked / partial / skipped | web/MCP | N leads | sources checked |

Use `partial` when at least one source in the group could not be checked. Use `skipped` only when the user narrowed the request or a blocker prevented access.

## Network Sources

Network sources are local files that map people to companies. They are used by `job-tracker:find network` for lead discovery and by `job-tracker:company` for contact pre-population before LinkedIn live scan.

### Supported Sources

All available sources are always read — no fallback gating. Sources that exist are merged; sources that don't exist are silently skipped.

- **`data/network/connections.csv`** — LinkedIn first-degree export. Fields: `First Name,Last Name,URL,Email Address,Company,Position,Connected On`. Export from: LinkedIn → Settings → Data Privacy → Get a copy of your data → Connections.
- **`data/network/*.md`** — Curated referral/contact notes. Recommended format (freeform text also accepted, parsed best-effort):
  ```md
  | Name | Company | Role | LinkedIn | Email | Notes |
  |---|---|---|---|---|---|
  ```
- **`docs/*referrals*.md`** and **`docs/*network*.md`** — Legacy sources (e.g. hand-maintained pre-`data/network/` files). Always read if present; reported as `(legacy source)` in output. Migrate to `data/network/` when convenient.

### Source Normalization

Before any matching, all records from all sources are normalized into a flat internal list:

```
Name | Company | Role | LinkedIn | Email | Source file | Notes
```

- Company matching is **case-insensitive** and tolerates common suffixes: Inc, Ltd, GmbH, SL, LLC, S.A., B.V., etc.
- Duplicate records (same name + company) are merged; the source file is noted.
- CSV and markdown table rows are parsed structurally. Freeform text is parsed best-effort; table format gives more reliable results.

### `job-tracker:find network`

When `network` is passed as an argument to `job-tracker:find`:

1. Read and normalize all available network sources.
2. Group contacts by company.
3. Apply the active profile's fit/reject rules to each company group. Discard companies that clearly violate reject rules.
4. For qualifying companies **not yet in the tracker**: verify whether an active relevant role exists — check the company careers page or ATS. This step is required before any tracker mutation.
   - **Active role found:** add to Raw Pipeline with role, URL, `Source: network`, and active profile.
   - **No active role but useful contact exists:** add to Monitoring with `Notes: source: network; contacts: [names]`. Do not invent a role or URL.
   - **Inaccessible / careers page down:** note as `unverified` in the output; do not add to tracker.
5. For qualifying companies **already in the tracker**: surface as warm intro opportunities in the output summary — no tracker change.

Source report entry: add a `Network` row showing how many sources were read, how many contacts were found, how many companies were verified, and how many new Raw Pipeline / Monitoring entries were added.

### `job-tracker:company` — Local Network Check

During the People/Referrals research step, before opening LinkedIn browser MCP:

1. Read and normalize all network sources.
2. Match contacts against the target company (case-insensitive, suffix-tolerant).
3. Include local matches as **candidates** for the People/Referrals section alongside LinkedIn results.
4. Write/update `## People / Referrals` during the normal prep-notes update step — not before research is complete.

Local network contacts are marked with their source file in the `Mutual connections` or `Notes` column so the user can see where they came from.

### Privacy

`data/network/` is gitignored except for `.gitkeep` and `README.md`. Do not copy personal contact data into `docs/` unless the user explicitly wants that file committed or shared.

## Verification Rule

Web search snippets often surface stale job links. Always verify each lead on the current company careers page or ATS listing before adding it to the tracker.
