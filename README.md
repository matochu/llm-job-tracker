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
- [Hard rules](#hard-rules)
- [Skills / commands](#skills--commands)
- [Profile mechanics](#profile-mechanics)
- [Configuration](#configuration)
- [Repository layout](#repository-layout)
- [Tracker rules](#tracker-rules)
- [Safety rules](#safety-rules)
- [Porting to another candidate](#porting-to-another-candidate)
- [Using with other LLMs](#using-with-other-llms)

## Create A Workspace

```bash
npx llm-job-tracker my-job-search
cd my-job-search
```

A global install exposes a shorter `job-tracker` binary:

```bash
npm install -g llm-job-tracker
job-tracker my-job-search
```

Flags:

- `--no-install` copies files only and skips `node scripts/install.js all`.
- `--force` copies into a non-empty target directory. Use it only when you mean to.

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
   job:setup
   ```

5. Start from current pipeline status:

   ```text
   job:status
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

## LLM Hooks

The project uses minimal command hooks that are compatible with both Codex and Claude Code. They are conservative and do not use Claude-only prompt, agent, HTTP, or MCP hook types.

Installed hooks:

- block agent-side outreach sending, applying, connecting, or pushing;
- allow final ATS application submit only when `job:apply` uses the explicit confirmation marker after user approval;
- block shell redirection overwrites of `data/tracker.md`, CV, and prep-note files;
- block direct prep-note claims that outreach, applications, LinkedIn messages, connection requests, or email were sent/submitted/contacted by the agent;
- remind the agent that `### Manual Message Drafts` should be produced through `job:draft`;
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

It reports missing dependencies without installing anything.

For Claude MCP verification the script runs `claude mcp list`. If `claude` is not in the non-interactive shell `PATH`, pass an explicit binary path:

```bash
CLAUDE_BIN=/path/to/claude node scripts/check-deps.js
```

PDF export uses `scripts/generate_pdf.py`. The generator looks for `weasyprint` in the current Python, then `scripts/.venv/bin/python3`, then `/tmp/resume-venv/bin/python3`.

## Typical Workflow

1. `job:run [profile?] [target]` can orchestrate the full path and update `data/tracker.md` after each stage.
2. `job:find` searches configured sources, verifies new leads, and adds accepted roles to `Raw Pipeline`.
3. `job:company [Company]` researches a promising company and creates or updates `data/companies/[company]/prep-notes.md`.
4. `job:draft [Company]` prepares manual recruiter, engineering, founder, or referral message drafts in prep notes. It never sends them.
5. `job:cv [Company]` creates or updates `data/companies/[company]/resume.md`.
6. `job:fit data/companies/[company]/resume.md [job-url]` checks fit, risks, and edits before user-side application decisions.
7. `job:stories [Company]` maps factual interview stories to the role when interview preparation or fit gaps need coverage.
8. `job:pdf data/companies/[company]/resume.md` generates the recruiter-ready PDF.
9. `job:apply [Company|application-url]` scouts/fills an ATS form and submits only after explicit user confirmation.
10. Update `data/tracker.md` after outreach, application, replies, interviews, closures, or deferrals.

During `job:run`, child-skill results are internal progress, not user-facing stop points. `job:run` should continue through its plan until the final summary or a hard blocker.

## Hard Rules

- Do not bypass `job:*` skills by writing their expected artifacts directly.
- Company research sections in `data/companies/*/prep-notes.md` must be produced through `job:company`.
- `### Manual Message Drafts` must be produced through `job:draft`.
- Having research, contact, or draft data already in context is not a valid reason to skip the relevant skill.
- `job:run` must call the relevant `job:*` skill instead of reconstructing that skill's output manually.
- Never mark outreach, applications, LinkedIn messages, connection requests, or email as sent/submitted unless the user explicitly says they did it outside the tool and asks to update status.
- `job:apply` is the only workflow that may submit an ATS/job application from the browser, and only after explicit user confirmation in the same run. It must never send LinkedIn messages, connection requests, emails, or referral outreach.

## Skills / Commands

Use `job:action` commands to run skills:

| Command | Runs |
|---|---|
| `job:setup` | run the first-step interactive readiness check before `job:run` |
| `job:health` | check tracker/profile/company/CV/PDF consistency and recommend narrow fixes |
| `job:status` | inspect tracker and recommend next actions |
| `job:run [profile?] [target]` | orchestrate search, company prep, manual message drafts, CV, fit, PDF, tracker updates, and final summary |
| `job:find` | find new leads, verify them at source, add them to `Raw Pipeline`, and report checked/skipped/blocked sources |
| `job:verify` | verify tracked jobs or run intake/prep/final reviewer passes |
| `job:profile [action]` | inspect, switch, validate, add, or remove job-search profiles |
| `job:company Company` | research one company, ATS, active roles, contacts, tech stack, and prep notes |
| `job:draft Company` | prepare and save manual recruiter, engineering-manager, founder, or referral message drafts |
| `job:cv Company` | create or update a company-specific Markdown CV |
| `job:fit resume.md job-url` | score a CV against a vacancy via subagent and suggest concrete edits |
| `job:stories [Company]` | map or maintain factual STAR stories for interview preparation |
| `job:pdf resume.md` | export a Markdown CV or cover letter to PDF using the configured generator |
| `job:apply Company\|url` | scout, prepare, fill, and optionally submit an ATS application after explicit confirmation |

Each skill reads `config/language.md` and replies in Ukrainian by default. CVs, cover letters, and manual message drafts are in English unless requested otherwise.

## Profile Mechanics

Profiles are positioning configs for different search strategies. They control search-specific fit signals, reject rules, priority rules, source/query focus, and CV/outreach emphasis.

Profile selection is simple:

- New discovery uses the active profile from `config/settings.md`.
- Existing tracked jobs use the row-level `Profile` value in `data/tracker.md`.
- Other job skills resolve the right profile themselves from those two rules.

`job:profile` manages profile configuration:

- `job:profile status` shows the active profile and profile health.
- `job:profile use <slug>` switches the active profile for future discovery.
- `job:profile add <slug>` creates a new profile.
- `job:profile remove <slug>` deletes an unused profile.
- `job:profile validate` checks settings, profile files, and tracker profile values.

Do not pass profile slugs to other job commands. The one exception is `job:run`, which may take a profile slug and switches the active profile via `job:profile use` before running.

## Configuration

- `candidate/candidate.md` — identity, contacts, real skills, and hard constraints.
- `config/settings.md` — active profile and profile selection rules.
- `config/language.md` — assistant reply language and document language.
- `config/paths.md` — tracker, company notes, CV, PDF generator paths.
- `strategy/criteria.md` — shared scoring labels and tracker row format.
- `strategy/sources.md` — job-search sources and verification rules.
- `config/tracker-schema.md` — tracker sections and update rules.
- `style/outreach-style.md` — outreach tone and message strategy.
- `style/cv-style.md` — CV house style and review rules.
- `candidate/stories.md` — factual STAR story bank for interview preparation.
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
    ├── check-deps.js
    ├── check-workspace.js
    ├── generate_pdf.py
    ├── install.js
    ├── llm-hooks/
    └── resume.css
```

## Tracker Rules

- Job tables must include a `Profile` column.
- New leads must store the active profile in `Profile`.
- Existing tracked vacancies must be processed using their row-level `Profile`, not the active profile.
- Add unresearched new leads to `Raw Pipeline` first.
- Move researched, active, prioritized roles to the active pipeline.
- Move closed, disappeared, rejected, skipped, or dead roles to Archive with date and reason.
- Move useful companies without active relevant roles to Monitoring.
- Keep tracker edits narrow and preserve user-authored notes.
- Do not duplicate companies across active pipeline and Raw Pipeline unless there are separate roles.

## Safety Rules

- Do not invent experience, metrics, contacts, job requirements, company facts, or source status.
- Verify job leads on the company careers page or ATS before adding them as active.
- Treat LinkedIn-only leads as unverified until confirmed at the source of truth.
- Outreach workflows prepare manual message drafts only and save them in prep notes. The user writes/sends manually outside the skills.
- Broad `job:find` runs must end with a source report showing checked, skipped, blocked, and found sources.
- LinkedIn, Djinni, browser-filtered boards, and JavaScript-rendered ATS pages must be checked through browser MCP, preferably Playwright MCP or Chrome DevTools MCP. If login is required, log in manually in the opened browser and let the agent continue. Do not replace these checks with plain web-search snippets.

## Porting To Another Candidate

To reuse this workspace for another person:

1. Replace `candidate/candidate.md`.
2. Adjust `config/language.md`.
3. Use `job:profile` to create, validate, or switch the active search profile.
4. Adjust `strategy/sources.md`.
5. Update `config/paths.md` only if the repository layout differs.
6. Replace `candidate/cv/cv-base.md` and company-specific CVs.
7. Run `node scripts/install.js all`.
8. Run `job:setup`.

The skill files should stay generic.

## Using With Other LLMs

For tools that do not support `SKILL.md` discovery, point the agent at:

- `config/agent-instructions.md` for durable project behavior;
- `skills/[skill]/SKILL.md` for workflow steps;
- `config/*.md`, `candidate/*.md`, `strategy/*.md`, and `style/*.md` for candidate configuration;
- `data/tracker.md` and `data/companies/*/prep-notes.md` for current state.

The workflow is plain Markdown, readable by Claude, Codex, or any other agent.
