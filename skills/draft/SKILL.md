---
name: job-tracker:draft
description: "Prepares recruiter, engineering-manager, founder, or referral manual message drafts in company prep notes. The user writes/sends them manually outside the skill."
argument-hint: "<company-slug-or-name> [contact-name-or-role]"
---

Prepare manual message drafts. This skill never sends messages, connection requests, emails, LinkedIn messages, or applications. The user is the only one who writes/sends messages.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `candidate/application-answers.md` (if present)
3. `config/settings.md`
4. `config/profile-resolution.md`, then the profile it resolves to
5. `config/language.md`
6. `config/paths.md`
7. `style/outreach-style.md`
8. `config/next-actions.md`

## Profile Resolution

Follow `config/profile-resolution.md`.

## Workflow

1. Resolve the company slug/name.
2. Read `data/companies/[slug]/prep-notes.md`.
3. Identify the target role, strongest contacts, mutual connections, application strategy, and resolved profile positioning angle. Where available, reuse standing phrasing from `candidate/application-answers.md` (filtered by resolved profile: `Profile == resolved` or `all`, specific wins) for elements like short bio or positioning statement. Company-specific content ("why this company", role-specific framing) is always generated fresh.
4. Draft message variants for relevant recipient types:
   - recruiter / talent acquisition
   - engineering manager / tech lead
   - employee referral / 2nd-degree contact
   - founder / leadership, when appropriate
5. Use the configured document language and outreach tone.
6. Add or update the configured manual-message-drafts section in prep notes. Prefer `### Manual Message Drafts` for new files; preserve an existing localized heading if the file already uses one.
7. Treat the prep-notes update as the primary deliverable. Do not only print messages in chat when a prep-notes file exists.
8. Do not send messages, click send buttons, submit applications, or create connection requests.
9. Do not mark outreach as sent unless the user explicitly says they sent it outside the tool and asks to update status.

## Enforcement

This skill is the required path for producing or updating `### Manual Message Drafts`.

Do not bypass `job-tracker:draft` by writing manual message drafts directly from `job-tracker:company`, `job-tracker:run`, or general context. Having contacts or draft text already in context is not a valid reason to skip this skill.

Manual message drafts are prep material only. They must never be represented as sent, submitted, applied, connected, or contacted by the agent.

If this skill is called by `job-tracker:run`, its output is an internal draft-preparation result for the orchestrator. Follow-up CV, fit, PDF, verification, or tracker work must be added to the `job-tracker:run` internal action queue when inputs are available, not treated as user-facing stop points. Report `Run progress` and the exact `Next internal step:` instead of ending with only the draft summary.

Example inside `job-tracker:run`:

```md
Run progress:
- `/job-tracker:draft ExampleCo` done; manual message drafts prepared, not sent.

Next internal step: `/job-tracker:cv ExampleCo`

Active profile: ai
```

## Output

Reply in the configured assistant language and include:

- prep-notes path and manual-message-drafts section updated
- best first contact
- missing info the user may need before manually writing/sending
- manual user actions, when relevant, without shortcut letters
- when called by `job-tracker:run` and runnable internal work remains, `Run progress` plus `Next internal step` instead of a user-facing stop
- footer with `Active profile: <slug>` and context-specific `job-tracker:action` next actions using `config/next-actions.md`
