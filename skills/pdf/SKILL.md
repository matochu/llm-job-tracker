---
name: job-tracker:pdf
description: "Exports a Markdown CV or cover letter to a recruiter-ready PDF using the configured local PDF generator and naming rules."
argument-hint: "<path/to/resume-or-cover.md> [output.pdf]"
---

Export a Markdown CV or cover letter to PDF.

## Load Config

Before starting, read:

1. `config/language.md`
2. `config/settings.md`
3. `config/paths.md`
4. `config/next-actions.md`

## Workflow

1. Resolve the input Markdown path from `$ARGUMENTS`.
2. Determine output path:
   - use the second argument when provided
   - otherwise use the configured PDF naming rules
   - do not treat the company slug/name as a PDF variant by default
   - use a variant filename only when one company has multiple CV versions for different vacancies, levels, or tracks
3. Ensure `pandoc` and `weasyprint` are available.
   - Prefer the repository venv if available.
   - If the generator reports a fallback venv path, follow its error message.
4. Run the configured PDF generator:

```bash
python3 scripts/generate_pdf.py <input.md> <output.pdf>
```

Use the repository's available Python/venv command when one already works.

5. Verify that the output exists and is a valid PDF.
6. If practical, inspect the PDF visually or via metadata.

If this skill is called by `job-tracker:run`, its output is an internal PDF-export result for the orchestrator. Verification and tracker updates should feed the `job-tracker:run` internal action queue and final summary, not become user-facing stop points. Report `Run progress` and the exact `Next internal step:` when runnable internal work remains.

## Output

Reply in the configured assistant language and report:

- Markdown input path
- PDF output path
- verification result
- when called by `job-tracker:run` and runnable internal work remains, `Run progress` plus `Next internal step`
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions using `config/next-actions.md`
