---
name: job:draft
description: Prepares recruiter, engineering-manager, founder, or referral manual message drafts in company prep notes. The user writes/sends them manually outside the skill.
argument-hint: <company-slug-or-name> [contact-name-or-role]
---

Prepare manual message drafts. This skill never sends messages, connection requests, emails, LinkedIn messages, or applications. The user is the only one who writes/sends messages.

## Load Config

Before starting, read:

1. `candidate/candidate.md`
2. `config/settings.md`
3. the resolved profile from the Profile Resolution rules below
4. `config/language.md`
5. `config/paths.md`
6. `style/outreach-style.md`
7. `config/next-actions.md`

## Profile Resolution

1. Read the active profile from `config/settings.md`.
2. For new job discovery or untracked targets, use the active profile from settings.
3. For existing tracked vacancies, use the `Profile` value from the matching `data/tracker.md` row.
4. Treat all arguments as normal skill arguments; profiles are not passed in commands.

## Workflow

1. Resolve the company slug/name.
2. Read `data/companies/[slug]/prep-notes.md`.
3. Identify the target role, strongest contacts, mutual connections, application strategy, and resolved profile positioning angle.
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

Do not bypass `job:draft` by writing manual message drafts directly from `job:company`, `job:run`, or general context. Having contacts or draft text already in context is not a valid reason to skip this skill.

Manual message drafts are prep material only. They must never be represented as sent, submitted, applied, connected, or contacted by the agent.

If this skill is called by `job:run`, its output is an internal draft-preparation result for the orchestrator. Follow-up CV, fit, PDF, verification, or tracker work must be added to the `job:run` internal action queue when inputs are available, not treated as user-facing stop points. Report `Run progress` and the exact `Next internal step:` instead of ending with only the draft summary.

Example inside `job:run`:

```md
Run progress:
- `job:draft ExampleCo` done; manual message drafts prepared, not sent.

Next internal step: run `job:cv ExampleCo`

Active profile: ai
```

## Output

Reply in the configured assistant language and include:

- prep-notes path and manual-message-drafts section updated
- best first contact
- missing info the user may need before manually writing/sending
- manual user actions, when relevant, without shortcut letters
- when called by `job:run` and runnable internal work remains, `Run progress` plus `Next internal step` instead of a user-facing stop
- footer with `Active profile: <slug>` and context-specific `job:action` next actions using `config/next-actions.md`
