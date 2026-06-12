#!/usr/bin/env python3
"""Shared parsing for job-search profile configuration.

Single source of truth for reading `config/settings.md` and
`strategy/search-profiles/*.md`, so the validators, hooks, and check-deps.js all
agree on the profile format instead of each re-implementing a fragile regex.

CLI (for script callers such as scripts/check-deps.js):

    profile_utils.py active-slug    # active profile slug
    profile_utils.py active-file    # active profile file path
    profile_utils.py list-slugs     # one listed profile slug per line
    profile_utils.py file-slugs     # one profiles/*.md slug per line
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


def repo_root() -> Path:
    path = Path.cwd().resolve()
    for candidate in [path, *path.parents]:
        if (candidate / ".git").exists():
            return candidate
    return path


def settings_path(root: Path) -> Path:
    return root / "config" / "settings.md"


def profiles_dir(root: Path) -> Path:
    return root / "strategy" / "search-profiles"


# Match a bulleted backtick item regardless of the delimiter that follows the
# closing backtick (space, dash, colon, end-of-line). Avoids silent drift when
# a profile entry is written as "- `slug`: desc" or "- `slug`".
_BULLET = re.compile(r"^-\s+`([^`]+)`")


def _section_lines(text: str, heading: str) -> list[str]:
    """Lines under a `## <heading>` section, up to the next `##` heading."""
    out: list[str] = []
    in_section = False
    for line in text.splitlines():
        if line.startswith("## "):
            in_section = line[3:].strip().lower() == heading.lower()
            continue
        if in_section:
            out.append(line)
    return out


def active_profile(root: Path) -> tuple[str | None, str | None]:
    """Return (slug, file) from the Active Profile section."""
    settings = settings_path(root)
    if not settings.exists():
        return None, None
    text = settings.read_text(encoding="utf-8")
    slug = file = None
    for line in text.splitlines():
        m = re.match(r"^- \*\*Profile slug:\*\* `([^`]+)`", line)
        if m:
            slug = m.group(1)
        m = re.match(r"^- \*\*Profile file:\*\* `([^`]+)`", line)
        if m:
            file = m.group(1)
    return slug, file


def listed_profiles(root: Path) -> set[str]:
    """Profile slugs declared under `## Available Profiles` in settings.md."""
    settings = settings_path(root)
    if not settings.exists():
        return set()
    text = settings.read_text(encoding="utf-8")
    slugs: set[str] = set()
    for line in _section_lines(text, "Available Profiles"):
        m = _BULLET.match(line.strip())
        if m:
            slugs.add(m.group(1))
    return slugs


def file_profiles(root: Path) -> set[str]:
    """Profile slugs that have a `strategy/search-profiles/<slug>.md` file."""
    d = profiles_dir(root)
    if not d.exists():
        return set()
    return {p.stem for p in d.glob("*.md")}


def _cli(arg: str) -> int:
    root = repo_root()
    if arg == "active-slug":
        slug, _ = active_profile(root)
        print(slug or "")
    elif arg == "active-file":
        _, file = active_profile(root)
        print(file or "")
    elif arg == "list-slugs":
        for slug in sorted(listed_profiles(root)):
            print(slug)
    elif arg == "file-slugs":
        for slug in sorted(file_profiles(root)):
            print(slug)
    else:
        print(f"unknown command: {arg}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv[1] if len(sys.argv) > 1 else ""))
