#!/usr/bin/env python3
"""Validate that job-search skills require profile-aware user-facing output."""

from __future__ import annotations

import sys
from pathlib import Path


RAW_SKILL_COMMANDS = (
    "find-jobs",
    "verify-jobs",
    "company-research",
    "write-outreach",
    "status-next",
    "tailor-cv",
    "review-cv-fit",
    "export-cv-pdf",
)

EXPECTED_SKILL_NAMES = {
    "job-find": "job:find",
    "job-verify": "job:verify",
    "job-company": "job:company",
    "job-draft": "job:draft",
    "job-status": "job:status",
    "job-profile": "job:profile",
    "job-setup": "job:setup",
    "job-run": "job:run",
    "job-health": "job:health",
    "job-stories": "job:stories",
    "job-apply": "job:apply",
    "job-cv": "job:cv",
    "job-fit": "job:fit",
    "job-pdf": "job:pdf",
}


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def main() -> int:
    root = repo_root()
    skills_dir = root / "skills"
    errors: list[str] = []

    if not skills_dir.exists():
        print("skills directory not found", file=sys.stderr)
        return 1

    for skill_file in sorted(skills_dir.glob("*/SKILL.md")):
        text = skill_file.read_text(encoding="utf-8")
        rel = skill_file.relative_to(root)
        skill_dir = skill_file.parent.name
        expected_name = EXPECTED_SKILL_NAMES.get(skill_dir)

        if expected_name is None:
            errors.append(f"{rel}: unexpected skill directory `{skill_dir}`; expected a configured `job-*` directory")
        elif f"name: {expected_name}" not in text:
            errors.append(f"{rel}: expected skill name `name: {expected_name}`")

        # The `Active profile` footer requirement must live in the Output/footer
        # section, not just be mentioned somewhere in prose.
        output_section = text.split("## Output", 1)[1] if "## Output" in text else ""
        if "Active profile" not in output_section:
            errors.append(f"{rel}: missing `Active profile` requirement in `## Output` section")

        has_next_actions = "config/next-actions.md" in text
        has_job_action = "job:action" in text
        if not (has_next_actions and has_job_action):
            errors.append(f"{rel}: missing `job:action` next-actions footer requirement")

        for line_no, line in enumerate(text.splitlines(), start=1):
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith(("name:", "description:", "### ", "## ")):
                continue
            if "`job:action`" in stripped:
                continue
            lower = stripped.lower()
            if not any(command in lower for command in RAW_SKILL_COMMANDS):
                continue
            is_user_facing = any(
                marker in lower
                for marker in (
                    "suggest",
                    "use `",
                    "run `",
                    "next actions",
                    "output",
                    "include",
                    "footer",
                    "reply",
                    "provide",
                )
            )
            if is_user_facing and "`job:" not in stripped:
                errors.append(f"{rel}:{line_no}: use `job:action` instead of raw skill command in user-facing instruction")

    if errors:
        print("Skill output validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("Skill footer validation passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
