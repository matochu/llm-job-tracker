# LLM Job Tracker

A local-first job-search workspace for LLM agents. Everything is Markdown, everything stays on your machine.

The npm package scaffolds the workspace and installs Claude and Codex integrations. Your agent then runs the workflows: find jobs, research companies, tailor CVs, draft outreach, review fit, prepare interview stories, fill application forms, and export PDFs.

## Contents

- [Create a workspace](#create-a-workspace)
- [What it creates](#what-it-creates)
- [Quick start](#quick-start-inside-the-workspace)
- [Local LLM integrations](#local-llm-integrations)
- [LLM hooks](#llm-hooks)
- [Dependency check](#dependency-check)
- [Typical workflow](#typical-workflow)
- [Agent CLI utilities](#agent-cli-utilities)
- [Hard rules](#hard-rules)
- [Skills / commands](#skills--commands)
- [Profile mechanics](#profile-mechanics)
- [Configuration](#configuration)
- [Repository layout](#repository-layout)
- [Tracker rules](#tracker-rules)
- [Safety rules](#safety-rules)
- [Porting to another candidate](#porting-to-another-candidate)
- [Using with other LLMs](#using-with-other-llms)

## Create Or Update A Workspace

Create a new workspace in a named directory:

```bash
npx llm-job-tracker my-job-search
cd my-job-search
```

Create in the current directory:

```bash
mkdir my-job-search
cd my-job-search
npx llm-job-tracker
```

Update an existing workspace in place:

```bash
cd my-job-search
npx llm-job-tracker
# then in your LLM tool:
# job-tracker:health
```

The CLI updates managed files (`skills/`, `scripts/`, `templates/`, `migrations/`, shared `config/` files). It never overwrites your data: `candidate/`, `data/`, `strategy/search-profiles/`, and personal `config/` files are protected. After the CLI update, run `job-tracker:health` — it seeds any missing protected-zone files and applies pending in-file migrations (adding new sections to existing files) with your confirmation.

The CLI defaults to the current directory. Without an explicit command, it initializes empty/non-workspace targets and updates existing job-tracker workspaces.

Explicit commands are also available:

```bash
npx llm-job-tracker init .
npx llm-job-tracker update .
npx llm-job-tracker update . --dry-run
```

A global install exposes a shorter `job-tracker` binary:

```bash
npm install -g llm-job-tracker
job-tracker
job-tracker update .
```

Flags:

- `--no-install` copies or updates files only and skips `node scripts/install.js all`.
- `--force` allows init into a non-empty non-workspace target. Use it only when you mean to.
- `--dry-run` shows update actions without writing files.

## What It Creates

The workspace separates reusable workflows from candidate-specific data:

- `skills/` contains generic agent workflows.
- `config/` contains settings, paths, language, next-actions, tracker schema, session report schema, and durable agent instructions.
- `candidate/` contains candidate facts, stories, and base CVs under `candidate/cv/`.
- `strategy/` contains search profiles, sources, and scoring criteria.
- `style/` contains CV and outreach house style.
- `templates/` contains reusable document templates.
- `data/companies/` and `data/tracker.md` contain live job-search artifacts.

## Quick Start Inside The Workspace

1. Review and update the candidate configuration:
   - `candidate/candidate.md`
   - `candidate/cv/cv-base.md`
   - `config/language.md`
   - `strategy/search-profiles/default.md`
   - `strategy/criteria.md`
   - `strategy/sources.md`
   - `config/settings.md`
2. Install local LLM integrations if you used `--no-install`:

   ```bash
   node scripts/install.js all
   ```

3. Verify local script, hook, browser MCP, and PDF dependencies:

   ```bash
   node scripts/check-deps.js
   ```

4. Run the interactive workspace readiness check in your LLM tool:

   ```text
   job-tracker:setup
   ```

5. Start from current pipeline status:

   ```text
   job-tracker:status
   ```

## Local LLM Integrations

Use `node scripts/install.js` to install the canonical skills, instructions, and hook configs for a tool:

```bash
node scripts/install.js
node scripts/install.js claude
node scripts/install.js codex
node scripts/install.js all
```

The script creates symlinks where possible. Use `--copy` when the target tool cannot follow symlinks:

```bash
node scripts/install.js codex --copy
```

Targets:

- `claude` installs `skills/` into `.claude/skills`, writes `CLAUDE.md`, and installs `.claude/settings.json` only when it is missing.
- `codex` installs each skill under `.codex/skills/`, installs `.codex/hooks.json`, installs `.codex/rules/`, and writes `AGENTS.md`.
- `all` installs both targets.

Canonical source files:

- `config/agent-instructions.md` -> `CLAUDE.md` and `AGENTS.md`
- `skills/` -> `.claude/skills` and `.codex/skills`
- `scripts/llm-hooks/claude-settings.json` -> `.claude/settings.json` only when local settings are missing
- `scripts/llm-hooks/codex-hooks.json` -> `.codex/hooks.json`
- `scripts/llm-hooks/codex-rules/` -> `.codex/rules/`

Codex may require reviewing or trusting changed local hooks via `/hooks`. Claude Code may also prompt depending on local policy.

Claude `permissions.allow` and Codex permissions are not the same format. Codex command allow rules live in `.codex/rules/*.rules`; filesystem/network permission profiles live in `.codex/config.toml` or `~/.codex/config.toml`.

Generated local integration targets are ignored by git:

- `.claude/`
- `.codex/`
- `CLAUDE.md`
- `AGENTS.md`

## Install As A Claude Code / Cowork Plugin

The same skills ship as a Claude Code plugin. Use this if you prefer Claude Cowork (desktop) or the Claude Code marketplace over the `npx` workspace scaffolder.

1. Download the plugin zip from the latest [GitHub release](https://github.com/matochu/llm-job-tracker/releases).
2. In Claude Cowork, open **Plugins** in the sidebar, click **+**, choose **Upload plugin**, and drop the zip.
3. Open the folder you want to keep your job search in (this becomes the workspace).
4. Run `/job-tracker:setup` to scaffold and configure the workspace.

Commands are namespaced the same way in both the plugin and the `npx` workspace: `/job-tracker:run`, `/job-tracker:find`, `/job-tracker:status`, and so on.

Your data (`candidate/`, `config/`, `data/`) lives in the working directory you open, not inside the plugin. Update the plugin by uploading a newer release zip; `/job-tracker:health` reports when a newer version is available.

## LLM Hooks

The project uses minimal command hooks that are compatible with both Codex and Claude Code. They are conservative and do not use Claude-only prompt, agent, HTTP, or MCP hook types.

Installed hooks:

- block agent-side outreach sending, applying, connecting, or pushing;
- allow final ATS application submit only when `job-tracker:apply` uses the explicit confirmation marker after user approval;
- block shell redirection overwrites of `data/tracker.md`, CV, and prep-note files;
- block direct prep-note claims that outreach, applications, LinkedIn messages, connection requests, or email were sent/submitted/contacted by the agent;
- remind the agent that `### Manual Message Drafts` should be produced through `job-tracker:draft`;
- remind the agent about CV/tracker/prep-note rules after edits;
- remind the agent at turn end to report changed files, verification status, and relevant next actions.

Shared implementation lives in `scripts/llm-hooks/*.js`.

## Dependency Check

Run:

```bash
node scripts/check-deps.js
```

The check verifies:

- `python3`
- `pandoc`
- Python `weasyprint`
- Node.js and `npx` for npx-based MCP servers
- Codex browser MCP setup for Playwright and Chrome DevTools when available
- Claude browser MCP setup via `claude mcp list` with no config-file fallback
- PDF generator and CSS files
- hook scripts and JSON configs
- Python syntax for local scripts
- installed Codex hook/rules sync and Claude hook presence in local settings
- active profile settings and target file existence
- workspace integrity script availability
- ATS probe and structured tracker CLI availability

It reports missing dependencies without installing anything.

For Claude MCP verification the script runs `claude mcp list`. If `claude` is not in the non-interactive shell `PATH`, pass an explicit binary path:

```bash
CLAUDE_BIN=/path/to/claude node scripts/check-deps.js
```

PDF export uses `scripts/generate_pdf.py`. The generator looks for `weasyprint` in the current Python, then `scripts/.venv/bin/python3`, then `/tmp/resume-venv/bin/python3`.

## Typical Workflow

1. `job-tracker:run [profile?] [target]` can orchestrate the full path and update `data/tracker.md` after each stage.
2. `job-tracker:find` searches configured sources, verifies new leads, and adds accepted roles to `Raw Pipeline`. For a single posting URL discovered manually, use `job-tracker:import <url>` as a faster single-URL bridge into `Raw Pipeline`.
3. `job-tracker:company [Company]` researches a promising company and creates or updates `data/companies/[company]/prep-notes.md`.
4. `job-tracker:draft [Company]` prepares manual recruiter, engineering, founder, or referral message drafts in prep notes. It never sends them.
5. `job-tracker:cv [Company]` creates or updates `data/companies/[company]/resume.md`.
6. `job-tracker:fit data/companies/[company]/resume.md [job-url]` checks fit, risks, and edits before user-side application decisions.
7. `job-tracker:stories [Company]` maps factual interview stories to the role when interview preparation or fit gaps need coverage.
8. `job-tracker:pdf data/companies/[company]/resume.md` generates the recruiter-ready PDF.
9. `job-tracker:apply [Company|application-url]` scouts/fills an ATS form and submits only after explicit user confirmation.
10. Update `data/tracker.md` after outreach, application, replies, interviews, closures, or deferrals. Agents should prefer `node scripts/tracker.js` for row updates instead of manual Markdown table surgery.

During `job-tracker:run`, child-skill results are internal progress, not user-facing stop points. `job-tracker:run` should continue through its plan until the final summary or a hard blocker. It must not report `done` while selected leads remain in the internal queue, background subagents are running, or skipped selected leads lack tracker-recorded real reasons. If a turn must end while the run can continue automatically, it should return the `paused-resumable` state with the single `Continue Run` next action.

## Agent CLI Utilities

These scripts are for agents and maintainers. They are not separate user-facing workflows; skills call them when useful.

### ATS Probe

Use the ATS probe for supported provider boards before writing one-off `curl` or inline JSON parsing:

```bash
node scripts/ats-probe.js ashby langfuse
node scripts/ats-probe.js batch ashby checkly sentry posthog --limit 10
node scripts/ats-probe.js discover langfuse.com
node scripts/ats-probe.js lever company-slug --json
```

Supported providers:

- `ashby`
- `lever`
- `greenhouse`
- `workable`
- `recruitee`
- `smartrecruiters`

Default output is:

```text
title | location | id | url
```

`discover <company-or-domain>` derives likely ATS slugs from a company name or domain and probes the supported providers. It is deterministic provider probing, not web search.

`batch <provider> <slug...>` probes multiple known ATS slugs without shell loops or `jq`.

`--json` returns normalized records for filtering or tests. The probe filters for frontend/product/fullstack/platform-style roles in EU-compatible locations. `--profile <slug>` adds keyword hints from the configured profile; it is not a fit/reject engine. Final profile fit, work-mode, priority, and reject decisions still belong to the skills and profile rules.

### Tracker CLI

Use the tracker CLI for narrow, structured edits to `data/tracker.md`:

```bash
node scripts/tracker.js list --section raw
node scripts/tracker.js validate --strict --json
node scripts/tracker.js add-lead --company Acme --profile frontend --role "Senior Frontend Engineer" --url https://example.com/job --source ashby --date 2026-06-29
node scripts/tracker.js move --company Acme --role "Senior Frontend Engineer" --from raw --to archive --date 2026-06-29 --reason closed
node scripts/tracker.js set-status --company Acme --role "Senior Frontend Engineer" --section raw --status "🟡 unclear" --date 2026-06-29 --dry-run
node scripts/tracker.js bump-date --company Acme --role "Senior Frontend Engineer" --field Updated --date 2026-06-29
```

The CLI parses Markdown tables structurally, preserves user notes outside the target row, treats emoji/status text as opaque strings, and refuses ambiguous updates unless an explicit `--url` identifies the row. Use `--dry-run` to inspect changes before writing, `--json` for `list`/`validate`, `--strict` to make validation warnings fail, and `--section` to narrow row matching for `set-status`, `bump-date`, and duplicate checks during `add-lead`.

Tracker section and field aliases live in `config/tracker-schema.md`. The starter schema is English, and localized or custom labels are supported by adding them to that config instead of changing JavaScript code.

Tables without a role or URL column, such as compact submitted/application-status tables, need a unique selector. Prefer `--url` when available; otherwise use section plus enough fields to avoid ambiguous company-only updates.

## Hard Rules

- Do not bypass `job-tracker:*` skills by writing their expected artifacts directly.
- Company research sections in `data/companies/*/prep-notes.md` must be produced through `job-tracker:company`.
- `### Manual Message Drafts` must be produced through `job-tracker:draft`.
- Having research, contact, or draft data already in context is not a valid reason to skip the relevant skill.
- `job-tracker:run` must call the relevant `job-tracker:*` skill instead of reconstructing that skill's output manually.
- Never mark outreach, applications, LinkedIn messages, connection requests, or email as sent/submitted unless the user explicitly says they did it outside the tool and asks to update status.
- `job-tracker:apply` is the only workflow that may submit an ATS/job application from the browser, and only after explicit user confirmation in the same run. It must never send LinkedIn messages, connection requests, emails, or referral outreach.

## Skills / Commands

Use `job-tracker:action` commands to run skills:

**Entry — start here**

| Command | Runs |
|---|---|
| `job-tracker:status` | home base: pipeline state, top priorities, and what to do next |
| `job-tracker:run [profile?] [target]` | autonomous pass: search, company prep, manual message drafts, CV, fit, PDF, tracker updates, and final summary |

**Helpers**

| Command | Runs |
|---|---|
| `job-tracker:setup` | first-step interactive readiness check before `job-tracker:run` |
| `job-tracker:health` | workspace integrity lint and pending migrations |
| `job-tracker:verify` | liveness re-check of tracked roles at source |
| `job-tracker:find` | find new leads, verify them at source, add them to `Raw Pipeline` |
| `job-tracker:import <url>` | import one posting URL: verify, auto-select best-fit profile, add to `Raw Pipeline` |
| `job-tracker:profile [action]` | inspect, switch, validate, add, or remove job-search profiles |

**Per-company**

| Command | Runs |
|---|---|
| `job-tracker:company Company` | research one company, ATS, active roles, contacts, tech stack, and prep notes |
| `job-tracker:draft Company` | prepare and save manual recruiter, engineering-manager, founder, or referral message drafts |
| `job-tracker:cv Company` | create or update a company-specific Markdown CV |
| `job-tracker:fit resume.md job-url` | score a CV against a vacancy via subagent and suggest concrete edits |
| `job-tracker:stories [Company]` | map or maintain factual STAR stories for interview preparation |
| `job-tracker:pdf resume.md` | export a Markdown CV or cover letter to PDF using the configured generator |
| `job-tracker:apply Company\|url` | scout, prepare, fill, and optionally submit an ATS application after explicit confirmation |

Each skill reads `config/language.md` and replies in Ukrainian by default. CVs, cover letters, and manual message drafts are in English unless requested otherwise.

## Profile Mechanics

Profiles are positioning configs for different search strategies. They control search-specific fit signals, reject rules, priority rules, source/query focus, and CV/outreach emphasis.

Profile selection is simple:

- New discovery uses the active profile from `config/settings.md`.
- Existing tracked jobs use the row-level `Profile` value in `data/tracker.md`.
- Other job skills resolve the right profile themselves from those two rules.

`job-tracker:profile` manages profile configuration:

- `job-tracker:profile status` shows the active profile and profile health.
- `job-tracker:profile use <slug>` switches the active profile for future discovery.
- `job-tracker:profile add <slug>` creates a new profile.
- `job-tracker:profile remove <slug>` deletes an unused profile.
- `job-tracker:profile validate` checks settings, profile files, and tracker profile values.

Do not pass profile slugs to other job commands. Two exceptions may switch the active profile via `job-tracker:profile use`: `job-tracker:run` (takes a profile slug argument) and `job-tracker:import` (takes no slug — auto-selects the best-fit profile and switches to it, asking on ties).

## Configuration

- `candidate/candidate.md` — identity, contacts, real skills, and hard constraints.
- `config/settings.md` — active profile and profile selection rules.
- `config/language.md` — assistant reply language and document language.
- `config/paths.md` — tracker, company notes, CV, PDF generator paths.
- `config/browser-patterns.md` — Browser MCP interaction rules for JavaScript-rendered and login-required sources.
- `strategy/criteria.md` — shared scoring labels and tracker row format.
- `strategy/sources.md` — job-search sources and verification rules.
- `config/tracker-schema.md` — tracker sections, update rules, and CLI aliases for localized section/field labels.
- `style/outreach-style.md` — outreach tone and message strategy.
- `style/cv-style.md` — CV house style and review rules.
- `candidate/stories.md` — factual STAR story bank for interview preparation.
- `candidate/application-answers.md` — profile-aware reusable answers for ATS forms and outreach.
- `config/next-actions.md` — dynamic next-action shortcut rules.
- `strategy/search-profiles/*.md` — named profiles with search-specific fit/reject/priority rules.

All configured paths are relative to the repository root.

## Repository Layout

```text
.
├── skills/
│   └── [skill]/
│       └── SKILL.md
├── config/
│   ├── settings.md
│   ├── paths.md
│   ├── language.md
│   ├── next-actions.md
│   ├── agent-instructions.md
│   ├── browser-patterns.md
│   ├── tracker-schema.md
│   └── session-reports.md
├── candidate/
│   ├── candidate.md
│   ├── stories.md
│   └── cv/
│       └── cv-base.md
├── strategy/
│   ├── search-profiles/
│   ├── sources.md
│   └── criteria.md
├── style/
│   ├── cv-style.md
│   └── outreach-style.md
├── templates/
├── data/
│   ├── tracker.md
│   └── companies/
│       └── [company]/
│           ├── prep-notes.md
│           ├── resume.md
│           └── pr-backlog.md
└── scripts/
    ├── ats-probe.js
    ├── check-deps.js
    ├── check-workspace.js
    ├── generate_pdf.py
    ├── install.js
    ├── tracker.js
    ├── llm-hooks/
    └── cv.css
```

## Tracker Rules

- Job tables must include a `Profile` column.
- New leads must store the active profile in `Profile`. `job-tracker:import` uses the auto-selected best-fit profile (made active before the row is written).
- Existing tracked vacancies must be processed using their row-level `Profile`, not the active profile.
- Add unresearched new leads to `Raw Pipeline` first.
- Move researched, active, prioritized roles to the active pipeline.
- Move closed, disappeared, rejected, skipped, or dead roles to Archive with date and reason.
- Move useful companies without active relevant roles to Monitoring.
- Keep tracker edits narrow and preserve user-authored notes.
- Prefer `node scripts/tracker.js` for tracker row updates when the target row can be identified structurally.
- Do not duplicate companies across active pipeline and Raw Pipeline unless there are separate roles.

## Safety Rules

- Do not invent experience, metrics, contacts, job requirements, company facts, or source status.
- Verify job leads on the company careers page or ATS before adding them as active.
- Treat LinkedIn-only leads as unverified until confirmed at the source of truth.
- Outreach workflows prepare manual message drafts only and save them in prep notes. The user writes/sends manually outside the skills.
- Broad `job-tracker:find` runs must end with a source report showing checked, skipped, blocked, and found sources.
- LinkedIn, Djinni, browser-filtered boards, and JavaScript-rendered ATS pages must be checked through browser MCP, preferably Playwright MCP or Chrome DevTools MCP. If login is required, log in manually in the opened browser and let the agent continue. Do not replace these checks with plain web-search snippets.

## Porting To Another Candidate

To reuse this workspace for another person:

1. Replace `candidate/candidate.md`.
2. Adjust `config/language.md`.
3. Use `job-tracker:profile` to create, validate, or switch the active search profile.
4. Adjust `strategy/sources.md`.
5. Update `config/paths.md` only if the repository layout differs.
6. Replace `candidate/cv/cv-base.md` and company-specific CVs.
7. Run `node scripts/install.js all`.
8. Run `job-tracker:setup`.

The skill files should stay generic.

## Using With Other LLMs

For tools that do not support `SKILL.md` discovery, point the agent at:

- `config/agent-instructions.md` for durable project behavior;
- `skills/[skill]/SKILL.md` for workflow steps;
- `config/*.md`, `candidate/*.md`, `strategy/*.md`, and `style/*.md` for candidate configuration;
- `data/tracker.md` and `data/companies/*/prep-notes.md` for current state.

The workflow is plain Markdown, readable by Claude, Codex, or any other agent.
