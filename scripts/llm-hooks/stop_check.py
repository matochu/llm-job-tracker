#!/usr/bin/env python3
"""At turn end, remind the agent what job-search output must include."""

from __future__ import annotations

import json
import re
import subprocess
import sys

from hooklib import read_event, repo_root, warn


VAGUE_NEXT_STEP_RE = re.compile(
    r"(?im)^\s*(?:next step|next action|continue with|наступний крок|далі)\s*:?\s*`?job:[a-z-]+"
)


def assistant_text(event: dict) -> str:
    """Best-effort extraction across Codex/Claude stop-hook event shapes."""
    candidates = [
        event.get("assistant_response"),
        event.get("assistantResponse"),
        event.get("response"),
        event.get("message"),
        event.get("text"),
        event.get("content"),
        event.get("raw_stdin"),
    ]
    transcript = event.get("transcript") or event.get("messages")
    if transcript is not None:
        candidates.append(transcript)

    parts: list[str] = []
    for value in candidates:
        if value is None:
            continue
        if isinstance(value, str):
            parts.append(value)
        else:
            parts.append(json.dumps(value, ensure_ascii=False))
    return "\n".join(parts)


def main() -> int:
    event = read_event()
    root = repo_root(event)
    if not (root / "job-search" / "language.md").exists():
        return 0

    validator = root / "scripts" / "llm-hooks" / "validate_skill_footers.py"
    if validator.exists():
        result = subprocess.run(
            [sys.executable, str(validator)],
            cwd=root,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
        if result.returncode != 0:
            warn(result.stderr.strip() or result.stdout.strip())
            return result.returncode

    text = assistant_text(event)
    has_vague_next_step = bool(VAGUE_NEXT_STEP_RE.search(text))
    has_framework_continuation = "Next internal step:" in text or "Next actions:" in text
    if has_vague_next_step and not has_framework_continuation:
        warn(
            "Job-search stop warning: vague `job:*` continuation detected. "
            "Use `Next internal step: run ...` for running `job:run`, or a proper `Next actions:` footer. "
            "For paused resumable `job:run`, show only `[n] Continue Run` with the compact run plan and resume point."
        )

    warn(
        "Job-search stop reminder: final reply should be Ukrainian unless producing recruiter-facing English; "
        "mention changed files, verification status, `Active profile: <slug>`, and concise `job:action` Next actions when useful."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
