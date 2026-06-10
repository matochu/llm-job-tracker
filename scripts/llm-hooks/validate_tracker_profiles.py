#!/usr/bin/env python3
"""Validate tracker job tables have a valid Profile column."""

from __future__ import annotations

import sys
from pathlib import Path

from profile_utils import (
    active_profile,
    file_profiles,
    listed_profiles,
    repo_root,
)


def cells(line: str) -> list[str]:
    return [part.strip() for part in line.strip().strip("|").split("|")]


def main() -> int:
    root = repo_root()
    tracker = root / "data/tracker.md"
    if not tracker.exists():
        print("data/tracker.md not found", file=sys.stderr)
        return 1

    profiles = listed_profiles(root)
    if not profiles:
        print("No profiles listed in config/settings.md", file=sys.stderr)
        return 1

    errors: list[str] = []

    # Cross-check settings entries against actual profile files (both ways), and
    # confirm the active profile is itself a listed, existing profile.
    files = file_profiles(root)
    for slug in sorted(profiles - files):
        errors.append(f"settings lists profile '{slug}' but strategy/search-profiles/{slug}.md is missing")
    for slug in sorted(files - profiles):
        errors.append(f"strategy/search-profiles/{slug}.md exists but is not listed in settings.md Available Profiles")

    active_slug, _ = active_profile(root)
    if not active_slug:
        errors.append("active Profile slug not found in config/settings.md")
    elif active_slug not in profiles:
        errors.append(f"active profile '{active_slug}' is not in settings.md Available Profiles")

    current_header: list[str] | None = None
    profile_index: int | None = None

    for lineno, line in enumerate(tracker.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.startswith("|"):
            current_header = None
            profile_index = None
            continue

        row = cells(line)
        if not row:
            continue

        first = row[0]
        if first in {"Company", "Компанія"}:
            current_header = row
            if "Profile" not in row:
                errors.append(f"line {lineno}: job table header missing Profile column")
                profile_index = None
            else:
                profile_index = row.index("Profile")
            continue

        if current_header is None or first == "---":
            continue

        if profile_index is None:
            continue
        if profile_index >= len(row):
            errors.append(f"line {lineno}: row missing Profile cell")
            continue

        value = row[profile_index].strip()
        if not value:
            errors.append(f"line {lineno}: empty Profile value")
        elif value not in profiles:
            errors.append(f"line {lineno}: unknown Profile '{value}'")

    if errors:
        print("Tracker profile validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Tracker profile validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

