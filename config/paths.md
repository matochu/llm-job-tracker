# Repository Paths

All paths are relative to the repository root unless explicitly stated otherwise.

The workspace is organized into role-based zones. This file is the canonical
path registry; skills embed literal paths but must match the values listed here.

## Configuration Zones

- **Config (`config/`):** `config/settings.md`, `config/paths.md`, `config/language.md`, `config/next-actions.md`, `config/agent-instructions.md`, `config/tracker-schema.md`, `config/session-reports.md`
- **Candidate (`candidate/`):** `candidate/candidate.md`, `candidate/stories.md`, `candidate/application-answers.md`, base CVs under `candidate/cv/`
- **Strategy (`strategy/`):** `strategy/search-profiles/*.md`, `strategy/sources.md`, `strategy/criteria.md`
- **Style (`style/`):** `style/cv-style.md`, `style/outreach-style.md`
- **Templates (`templates/`):** `templates/resume-template.md`, `templates/prep-notes-template.md`, `templates/pr-backlog-template.md`
- **Data / runtime (`data/`):** `data/tracker.md`, `data/companies/`

## Runtime Artifacts

- **Tracker:** `data/tracker.md`
- **Companies directory:** `data/companies/`
- **Company prep notes:** `data/companies/[slug]/prep-notes.md`
- **Company CV:** `data/companies/[slug]/resume.md`
- **Base CV:** `candidate/cv/cv-base.md`
- **Story bank:** `candidate/stories.md`
- **Application answer bank:** `candidate/application-answers.md`
- **Templates directory:** `templates/`
- **Resume template reference:** `templates/resume-template.md`
- **PDF generator:** `scripts/generate_pdf.py`
- **PDF CSS:** `scripts/cv.css`
- **Session reports:** `.sessions/reports/[id].run.md`
- **Session logs:** `.sessions/logs/[id].log`

## PDF Output Directory

- PDF output directory: same directory as the source `resume.md`, i.e. `data/companies/[slug]/`.
- Always pass the full output path to the generator: `data/companies/[slug]/[Candidate Name] - CV.pdf`
- Never pass a bare filename without a directory — the generator will place it in CWD (repo root).

## PDF Naming

- Use the candidate name from `candidate/candidate.md`.
- Resume PDF: `[Candidate Name] - CV.pdf`
- Cover letter PDF: `[Candidate Name] - Cover Letter.pdf`
- Company-specific CVs are not variants by default. Do not add the company name to the PDF filename just because the Markdown lives under `data/companies/[slug]/`.
- Variant resume PDF: `[Candidate Name] - CV ([Variant]).pdf`
- Use a variant name only when one company needs multiple CV versions for different vacancies, levels, or tracks. Examples: `[Candidate Name] - CV (Frontend Platform).pdf`, `[Candidate Name] - CV (Fullstack).pdf`.
- Never use final filenames like `resume.pdf` or `cover-letter.pdf`.
