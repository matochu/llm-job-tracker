---
name: job-tracker:apply
description: "Prepares and optionally submits a job application through browser MCP: opens the ATS form, scouts fields, prepares answers, fills only after review, and clicks submit only after explicit user confirmation in the same run."
argument-hint: "<company-or-application-url>"
---

Prepare an application form and optionally submit it after explicit confirmation.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `candidate/application-answers.md` (if present)
3. `config/settings.md`
4. the resolved profile from the Profile Resolution rules below
5. `config/language.md`
6. `config/paths.md`
7. `strategy/criteria.md`
8. `config/tracker-schema.md`
9. `style/cv-style.md`
10. `config/next-actions.md`

Also get the current date and timezone from the execution environment or system context before recording application, draft-state, or tracker update dates.

If the request names a tracked company, also read the matching tracker row, `data/companies/[slug]/prep-notes.md`, `data/companies/[slug]/resume.md`, and existing PDF outputs when present.

## Profile Resolution

1. Read the active profile from `config/settings.md`.
2. For untracked application URLs, use the active profile from settings.
3. For existing tracked vacancies, use the `Profile` value from the matching `data/tracker.md` row.
4. Treat all arguments as normal skill arguments; profiles are not passed in commands.

## Scope

This skill handles application form preparation, controlled filling, and optional submission.

It is separate from `job-tracker:draft`: `job-tracker:draft` prepares manual LinkedIn/email/referral message drafts. `job-tracker:apply` works with ATS/job application forms.

## Browser Rules

- Use browser MCP only, preferably Playwright MCP or Chrome DevTools MCP.
- Use browser MCP for LinkedIn, JavaScript-rendered ATS pages, browser filters, and login/session-dependent pages.
- If login is required, open the page and wait for the user to log in manually.
- Never enter passwords, create accounts, solve CAPTCHA, or bypass access controls.
- Never use web-search snippets instead of reading the actual form/source when browser access is required.

## Submit Gate

Default mode is preparation only.

The skill may click the final submit/apply button only when all conditions are true:

1. The application form was fully scouted and summarized.
2. The user reviewed the proposed field values.
3. The user explicitly confirmed submission in the current conversation with wording equivalent to `yes, submit this application`.
4. The final browser tool call that clicks submit includes this marker in its tool input: `USER_CONFIRMED_ATS_APPLICATION`.
5. The skill records the submission result and asks before updating tracker status if the status change is not obvious from the successful confirmation page.

If any condition is missing, stop before submit and list the exact manual user action.

Do not submit LinkedIn connection requests, LinkedIn messages, emails, or referral outreach. This skill is only for ATS/job application forms.

## Workflow

1. Resolve the target:
   - company name from tracker/prep notes
   - direct application URL
   - current browser tab if the user explicitly asks to use it
2. Verify prerequisites:
   - tailored CV exists or queue `job-tracker:cv`
   - PDF exists or queue `job-tracker:pdf`
   - fit review exists or recommend `job-tracker:fit` when needed
3. Open the application form with browser MCP.
4. Identify ATS or form type:
   - Ashby
   - Greenhouse
   - Lever
   - Workday
   - LinkedIn Easy Apply
   - other/unknown
5. Scout all visible fields before filling:
   - personal/contact fields
   - resume/CV upload fields
   - cover letter fields
   - work authorization / visa questions
   - salary expectations
   - custom screening questions
   - EEO / voluntary disclosure fields
   - required checkboxes or acknowledgements
6. Build a proposed application plan:
   - fields to fill from `candidate/candidate.md` (source of truth for all facts)
   - standard fields and reusable question answers from `candidate/application-answers.md`, filtered by the resolved profile: use rows where `Profile` equals the resolved profile or `all`; profile-specific rows override `all` rows for the same field
   - files to upload from `data/companies/[slug]/`
   - proposed answers to custom questions (company-specific questions such as "why this company" are generated fresh, not sourced from the bank)
   - fields that require user input
   - fields that should be skipped or set to `Decline to self-identify`
7. Stop and ask the user to review when:
   - any non-obvious answer is required
   - salary, visa, legal, EEO, relocation, or availability fields appear
   - the form is ready to submit
8. After user approves filling, fill fields via browser MCP and verify with a browser snapshot.
9. Before final submit, show a compact review:
   - company and role
   - uploaded file names
   - required fields filled
   - custom answers
   - unresolved caveats
10. If the user explicitly confirms submit, click the final submit/apply button via browser MCP with `USER_CONFIRMED_ATS_APPLICATION` included in the tool input.
11. Verify the result page or confirmation state.
12. Update tracker/prep notes narrowly only after successful submission or after the user asks to save draft state.
13. After a successful application, offer to save reusable answers back to `candidate/application-answers.md`:
    - For each confirmed custom answer that is not company-specific (i.e. could apply to other companies), ask the user: "Save this answer to the answer bank for future applications? (yes / profile-specific / no)"
    - If yes, append a new row to the Reusable Question Bank section with the question pattern, resolved profile (or `all` if the user says profile-independent), and the confirmed answer.
    - Only save answers the user explicitly approves. Never save fabricated answers; every saved answer must be consistent with `candidate/candidate.md`.

## ATS Notes

Use these as heuristics, not hardcoded assumptions:

- Ashby: often has name/email/phone/location/LinkedIn/resume fields; location may be a combobox.
- Greenhouse: may be embedded in an iframe; Playwright snapshots usually expose iframe fields.
- Lever: form can be below the job description; radio buttons may be custom styled.
- Workday: multi-step wizard; if account creation/login is required, stop and let the user handle it.
- LinkedIn Easy Apply: use logged-in browser MCP session; stop before final submit unless the submit gate is satisfied.

## Output

Reply in the configured assistant language and include:

- application target and resolved profile
- prerequisite status: CV, PDF, fit review, form access
- form fields found
- proposed answers and file uploads
- fields needing user input
- fill status: not filled / filled / blocked
- submit status: not submitted / submitted after explicit confirmation / blocked
- tracker/prep-note updates, if any
- manual user actions, when relevant, without shortcut letters
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions from `config/next-actions.md`

`Next actions` must contain only agent-runnable `job:*` actions.
