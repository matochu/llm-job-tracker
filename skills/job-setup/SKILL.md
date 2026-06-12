---
name: job:setup
description: Runs the first-step interactive readiness check for job-search configuration, dependencies, profiles, base CV, tracker, sources, browser MCP, PDF setup, and run prerequisites.
argument-hint:
---

Check whether the workspace is ready for `job:run`.

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

## Scope

Run `job:setup` as the first user-facing step after installing this workspace.

This skill runs as an interactive setup dialog. It does not just report — it asks questions and immediately writes the answers into the appropriate config files.

Allowed actions:

- run `node scripts/check-deps.js`
- inspect configuration files and configured paths
- inspect installed hook/skill sync status reported by dependency checks
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
- do not start `job:run`

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
- LinkedIn, Djinni, browser-filtered boards, and JavaScript-rendered ATS sources are marked as browser-MCP-only where relevant
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
6. **Sources** — if `strategy/sources.md` has no usable entries for the active profile, ask which job boards/platforms the user wants to search.
7. **Tracker** — if `data/tracker.md` is missing, offer to create a scaffold with one confirmation question.
8. **Dependencies** — run `node scripts/check-deps.js` and report results.

Do not ask more than three questions in one response. After writing, always confirm: "Saved to `<path>`. Moving to next item."

## Verdicts

After completing all dialog rounds, return a final verdict:

- `pass`: ready for `job:run`
- `warning`: ready for `job:run`, but warnings should be addressed soon
- `blocked`: not ready for `job:run`; user input is required (shown mid-dialog when a blocker cannot be resolved automatically)

## Output

Reply in the configured assistant language when `config/language.md` exists, otherwise Ukrainian.

During the dialog, each response includes:

- what was just written (confirmation + file path)
- the next missing item being addressed
- up to three concrete questions
- progress indicator: `Setup: N/9 areas complete`

Final response (after all items resolved) includes:

- `Verdict: pass|warning|blocked`
- `Ready for job:run: yes|no`
- summary of what was configured this session
- warnings for items skipped or partially filled
- footer with `Active profile: <slug-or-missing>` and context-specific `job:action` next actions using `config/next-actions.md`
