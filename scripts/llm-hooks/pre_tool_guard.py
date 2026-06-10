#!/usr/bin/env python3
"""Block a few high-risk job-search actions before a tool executes."""

from __future__ import annotations

import re
import sys

from hooklib import command_text, print_claude_deny, read_event, tool_input, tool_name, warn


SEND_PATTERNS = [
    r"\b(send|submit|apply)\b.*\b(linkedin|email|gmail|mail|message|connection|connect)\b",
    r"\b(linkedin|email|gmail|mail|message|connection|connect)\b.*\b(send|submit|apply)\b",
    r"\bmailto:",
    r"\bgh\s+pr\s+merge\b",
    r"\bgit\s+push\b",
]

BROWSER_SEND_PATTERNS = [
    r"\b(send|submit|apply|connect)\b",
    r"\b(connection request|send message|send email)\b",
]

APPLICATION_SUBMIT_ALLOW_MARKER = "USER_CONFIRMED_ATS_APPLICATION"

RISKY_REDIRECT_PATTERNS = [
    r">\s*tracker\.md\b",
    r">\s*data/companies/[^ ]+/resume\.md\b",
    r">\s*data/companies/[^ ]+/prep-notes\.md\b",
    r">\s*candidate/cv/cv-base\.md\b",
]

PREP_NOTES_PATH_PATTERN = r"data/companies/[^\"'\s]+/prep-notes\.md"

PREP_NOTES_DRAFT_WARNING_PATTERNS = [
    r"###\s+Manual Message Drafts",
]

PREP_NOTES_CLAIM_BLOCK_PATTERNS = [
    r"\b(outreach|message|email|linkedin|connection|application)\s+status\s*:\s*(sent|submitted|applied|contacted|connected)\b",
    r"\b(marked|set|updated)\s+(as|to)\s+(sent|submitted|applied|contacted|connected)\b",
    r"\b(message|email|linkedin message|connection request|application|outreach)\s+(sent|submitted|applied|contacted|connected)\b",
]


def main() -> int:
    event = read_event()
    name = tool_name(event)
    text = command_text(event)
    raw_input = str(tool_input(event))
    combined_text = "\n".join(item for item in (text, raw_input) if item)

    if not combined_text:
        return 0

    normalized = combined_text.lower()

    if any(token in name.lower() for token in ("browser", "playwright", "chrome")):
        for pattern in BROWSER_SEND_PATTERNS:
            if re.search(pattern, normalized):
                is_application_submit = re.search(r"\b(submit|apply)\b", normalized) and re.search(
                    r"\b(application|ats|job application|application form)\b", normalized
                )
                is_outreach_action = re.search(r"\b(send|connect|connection request|send message|send email|linkedin|email|gmail|mail|message)\b", normalized)
                if APPLICATION_SUBMIT_ALLOW_MARKER.lower() in normalized and is_application_submit and not is_outreach_action:
                    continue
                reason = "Blocked by job-search hook: browser outreach/application actions must remain manual."
                print_claude_deny(reason)
                print(reason, file=sys.stderr)
                return 2

    if name in {"Bash", "bash", "functions.exec_command"}:
        for pattern in SEND_PATTERNS:
            if re.search(pattern, normalized):
                reason = "Blocked by job-search hook: draft outreach only; do not send/apply/connect from the agent."
                print_claude_deny(reason)
                print(reason, file=sys.stderr)
                return 2
        for pattern in RISKY_REDIRECT_PATTERNS:
            if re.search(pattern, combined_text):
                reason = "Blocked by job-search hook: edit tracker/CV/prep-notes with a structured edit tool, not shell redirection."
                print_claude_deny(reason)
                print(reason, file=sys.stderr)
                return 2

    if re.search(PREP_NOTES_PATH_PATTERN, combined_text):
        for pattern in PREP_NOTES_CLAIM_BLOCK_PATTERNS:
            if re.search(pattern, normalized, flags=re.IGNORECASE):
                reason = "Blocked by job-search hook: sent/applied/contacted outreach claims require explicit user confirmation and must not be created by direct prep-notes edits."
                print_claude_deny(reason)
                print(reason, file=sys.stderr)
                return 2
        for pattern in PREP_NOTES_DRAFT_WARNING_PATTERNS:
            if re.search(pattern, combined_text, flags=re.IGNORECASE):
                warn("Job-search hook reminder: Manual Message Drafts should be produced by job:draft, not reconstructed directly from context.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
