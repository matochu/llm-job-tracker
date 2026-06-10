#!/usr/bin/env python3
"""Return lightweight reminders after job-search files are edited."""

from __future__ import annotations

import subprocess
import sys

from hooklib import edited_paths, read_event, warn


def main() -> int:
    event = read_event()
    paths = edited_paths(event)
    if not paths:
        return 0

    reminders: list[str] = []
    if any(path == "data/tracker.md" for path in paths):
        reminders.append("Tracker edited: preserve user notes, avoid duplicates, and use current verification dates.")
    if any(path.endswith("/resume.md") or path.startswith("candidate/cv/") for path in paths):
        reminders.append("CV edited: keep it in English, do not invent metrics/stack, and follow style/cv-style.md.")
    if any(path.endswith("/prep-notes.md") for path in paths):
        reminders.append("Prep notes edited: distinguish sourced facts from inferred notes and keep outreach as drafts.")

    if reminders:
        warn("Job-search hook reminder: " + " ".join(reminders))

    if any(path == "data/tracker.md" for path in paths):
        result = subprocess.run(
            [sys.executable, "scripts/llm-hooks/validate_tracker_profiles.py"],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            if result.stdout:
                warn(result.stdout.strip())
            if result.stderr:
                warn(result.stderr.strip())
            return result.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
