#!/usr/bin/env python3
"""Small helpers shared by Codex and Claude Code command hooks."""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any


def read_event() -> dict[str, Any]:
    raw = sys.stdin.read().strip()
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return {"raw_stdin": raw}
    return value if isinstance(value, dict) else {"value": value}


def repo_root(event: dict[str, Any]) -> Path:
    cwd = event.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    path = Path(str(cwd)).resolve()
    for candidate in [path, *path.parents]:
        if (candidate / ".git").exists():
            return candidate
    return path


def tool_name(event: dict[str, Any]) -> str:
    return str(event.get("tool_name") or event.get("toolName") or "")


def tool_input(event: dict[str, Any]) -> dict[str, Any]:
    value = event.get("tool_input") or event.get("toolInput") or {}
    return value if isinstance(value, dict) else {}


def command_text(event: dict[str, Any]) -> str:
    data = tool_input(event)
    candidates = [
        data.get("command"),
        data.get("cmd"),
        data.get("script"),
        data.get("url"),
        data.get("text"),
        data.get("element"),
        data.get("target"),
        data.get("value"),
        event.get("command"),
    ]
    return "\n".join(str(item) for item in candidates if item)


def edited_paths(event: dict[str, Any]) -> list[str]:
    data = tool_input(event)
    keys = ("file_path", "path", "filename", "target_file", "notebook_path")
    paths = [str(data[key]) for key in keys if data.get(key)]

    raw = json.dumps(data, ensure_ascii=False)
    for match in re.finditer(r"(data/companies/[^\"'\s]+|data/tracker\.md|candidate/cv/[^\"'\s]+)", raw):
        paths.append(match.group(1))

    seen: set[str] = set()
    result: list[str] = []
    for path in paths:
        if path not in seen:
            seen.add(path)
            result.append(path)
    return result


def print_claude_deny(reason: str, event_name: str = "PreToolUse") -> None:
    payload = {
        "hookSpecificOutput": {
            "hookEventName": event_name,
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }
    print(json.dumps(payload))


def warn(reason: str) -> None:
    print(reason, file=sys.stderr)
