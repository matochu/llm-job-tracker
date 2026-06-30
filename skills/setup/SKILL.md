---
name: job-tracker:setup
description: "Runs the first-step interactive readiness check for job-search configuration, dependencies, profiles, base CV, tracker, sources, browser MCP, PDF setup, and run prerequisites."
argument-hint:
---

Check whether the workspace is ready for `job-tracker:run`.

This is an interactive setup assistant. It performs a full preflight and asks the user concrete questions for missing or weak configuration. It does not install the skill system and does not run `node scripts/install.js`.

## Load Config

Before starting, read existing files when present:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the active profile from settings
4. `config/language.md`
5. `config/paths.md`
6. `strategy/criteria.md`
7. `strategy/sources.md`
8. `config/tracker-schema.md`
9. `style/outreach-style.md`
10. `style/cv-style.md`
11. `config/next-actions.md`
12. `data/tracker.md`
13. configured base CV path, usually `candidate/cv/cv-base.md`
14. `config/source-registry.md`

## Scope

Run `job-tracker:setup` as the first user-facing step after installing this workspace.

This skill runs as an interactive setup dialog. It does not just report — it asks questions and immediately writes the answers into the appropriate config files.

Allowed actions:

- run `node scripts/check-deps.js`
- inspect configuration files and configured paths
- inspect installed hook/skill sync status reported by dependency checks
- run `node scripts/check-workspace.js` and treat missing/incomplete important config as setup work, not as a final-only warning
- ask the user for missing information (max 3 questions per response)
- write user answers directly into `candidate/candidate.md`, the active profile, `config/settings.md`, or other config files as appropriate
- create narrow scaffolds (tracker, profile, CV skeleton) after one confirmation question
- after writing, confirm what was saved and continue to the next missing item

Forbidden actions:

- do not run `node scripts/install.js`
- do not invent candidate experience, metrics, contacts, job requirements, or source strategy
- do not create a full base CV from scratch without user-provided resume content
- do not change the active profile without explicit user confirmation
- do not add job sources without user confirmation
- do not start `job-tracker:run`

## Review Checklist

Check:

- dependencies and hook sync via `node scripts/check-deps.js`
- active profile exists in `config/settings.md`
- every listed profile has a corresponding `strategy/search-profiles/*.md` file
- active profile has usable fit, reject, priority, and search/source guidance
- `candidate/candidate.md` exists and contains candidate identity, constraints, and real skills
- configured base CV exists, is Markdown, is non-empty, and contains real user-provided experience
- `config/language.md` exists
- `config/paths.md` points to usable tracker, company notes, CV, PDF generator, and base CV paths
- `data/tracker.md` exists and job tables include a `Profile` column
- `strategy/sources.md` exists and defines usable sources for the active profile
- `config/source-registry.md` exists and defines:
  - ATS probe providers with discovery feeds containing `[slug]`
  - ATS probe search defaults (`### Keywords` and `### Locations`)
  - browser-required sources and required access policy
  - LinkedIn and Djinni as Playwright MCP with the user's logged-in account/session only
  - URL host `Source` derivation rules
- PDF generator and CSS exist
- browser MCP readiness is reported for Codex and, when available, Claude
- hard rules are present in `config/agent-instructions.md`, `CLAUDE.md`, and `AGENTS.md`

## Interactive Dialog

Work iteratively. Each round: identify the highest-priority missing item, ask up to 3 concrete questions, wait for the user's answer, write it to the appropriate file, confirm what was saved, then move to the next missing item.

Dialog order (highest to lowest priority):

0. **PDF import** — at the start of the dialog, ask once: "Do you have an existing resume PDF? If so, paste the path or drag the file here." If the user provides a path:
   - Read the PDF using the Read tool (Claude can parse PDFs natively).
   - Extract all text content: name, contact details, work experience, education, skills, summary, languages.
   - Populate `candidate/candidate.md` and create/overwrite `candidate/cv/cv-base.md` with the extracted content converted to the repo Markdown resume format (see `templates/resume-template.md`).
   - Attempt visual style extraction: open the PDF in the browser via browser MCP (if available) and take a screenshot; otherwise describe what you can infer from the PDF structure. Extract: font family names if visible in metadata (`pdfinfo <path>` or `strings <path> | grep -i font`), color palette (background, text, accent), layout type (single/two-column, header style), section order.
   - Update `style/cv-style.md` with a `## Imported Style Notes` section describing the detected style. Do not overwrite the House Style rules — append only.
   - Based on extracted style, propose concrete changes to `scripts/cv.css`: accent color (`h2 color` and `@top-right color`), font family (`body font-family`), font size if different. Show the user a short diff-style preview, e.g.:
     ```
     h2 { color: #2563eb; }   /* was #888888 */
     body { font-family: 'Calibri', sans-serif; }  /* was Arial */
     ```
     Ask: "Apply these style changes to `scripts/cv.css`? (yes / no / edit)" — and wait for confirmation before writing. If the user says "edit", ask what to change. Write only after explicit yes.
   - After import confirm: "Imported from `<path>`. Created/updated `candidate/cv/cv-base.md`, `style/cv-style.md`" and, if CSS was updated, "`scripts/cv.css`."
   - If the user says no PDF or skips, proceed to step 1. Still mention: "`scripts/cv.css` controls PDF appearance — edit it any time to change fonts, colors, or spacing."

1. **Candidate identity** — if `candidate/candidate.md` has empty fields, ask: full name, location/timezone, primary email. Write answers into `candidate/candidate.md` immediately.
2. **Skills and constraints** — ask: core skills (comma-separated), hard-no rules (company types, work modes, locations to avoid), compensation expectations, English level. Write to `candidate/candidate.md`.
3. **Active profile** — if missing or default profile is empty, ask: target role family (e.g. "Senior Frontend Engineer"), preferred work mode (remote/hybrid/on-site), one-sentence positioning. Write to the active profile file.
4. **Profile fit rules** — ask: strong-fit signals (3-5 bullet points), reject signals. Write to profile.
5. **Base CV** — if still missing after step 0: ask for a path to an existing resume (PDF/DOCX/MD) or offer to paste content. If user pastes content, create `candidate/cv/cv-base.md` from it. Do not invent content.
6. **Source registry** — if `config/source-registry.md` is missing or `node scripts/check-workspace.js` reports source-registry errors, ask focused questions and write answers into `config/source-registry.md`.
   - If the file is missing, ask one confirmation to create it from the packaged starter registry.
   - If ATS probe providers or discovery feeds are missing, ask which configured providers should be enabled and confirm their feed templates before writing. Do not invent custom providers; if unsure, use the starter supported provider list from the packaged `config/source-registry.md`.
   - If ATS probe keywords/locations are missing, ask: target role keywords and allowed regions/work modes. Write them under `## ATS Probe Search Defaults`.
   - If browser-required source policy is missing, ask whether LinkedIn and Djinni should be checked through the user's logged-in Playwright session. Default recommendation: yes. Write `Playwright MCP with the user's logged-in account/session` for both when confirmed.
   - If source derivation is missing, ask which source values the tracker should use for known hosts, or copy the starter `## Source Derivation` table after confirmation.
   - After writing, run `node scripts/check-workspace.js` again. If it still reports source-registry errors, keep the setup dialog in `blocked` or continue asking; do not mark setup complete.
7. **Sources** — if `strategy/sources.md` has no usable entries for the active profile, ask which job boards/platforms the user wants to search.
8. **Tracker** — if `data/tracker.md` is missing, offer to create a scaffold with one confirmation question.
9. **Dependencies** — run `node scripts/check-deps.js` and report results.
10. **Version check** — detect install mode via `echo "$CLAUDE_PLUGIN_ROOT"`.
   - Plugin mode (`CLAUDE_PLUGIN_ROOT` set): read version from `$CLAUDE_PLUGIN_ROOT/.claude-plugin/plugin.json`, compare with the latest GitHub release (`gh release list --repo matochu/llm-job-tracker --limit 1`). If outdated, show what changed from `CHANGELOG.md` and tell the user to re-upload the latest plugin zip in Cowork (the agent cannot self-update a plugin).
   - Workspace mode (not set): read `config/.installed-version`, compare with `npm view llm-job-tracker version --json`. If outdated, show changes and suggest `npx llm-job-tracker update .` If `.installed-version` is missing, note as warning but do not block setup.

Do not ask more than three questions in one response. After writing, always confirm: "Saved to `<path>`. Moving to next item."

## Verdicts

After completing all dialog rounds, return a final verdict:

- `pass`: ready for `job-tracker:run`
- `warning`: ready for `job-tracker:run`, but warnings should be addressed soon
- `blocked`: not ready for `job-tracker:run`; user input is required (shown mid-dialog when a blocker cannot be resolved automatically)

## Output

Reply in the configured assistant language when `config/language.md` exists, otherwise Ukrainian.

During the dialog, each response includes:

- what was just written (confirmation + file path)
- the next missing item being addressed
- up to three concrete questions
- progress indicator: `Setup: N/11 areas complete`

Final response (after all items resolved) includes:

- `Verdict: pass|warning|blocked`
- `Ready for job-tracker:run: yes|no`
- summary of what was configured this session
- warnings for items skipped or partially filled
- footer with `Active profile: <slug-or-missing>` and context-specific `job-tracker:action` next actions using `config/next-actions.md`
