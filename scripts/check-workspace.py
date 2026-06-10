#!/usr/bin/env python3
"""Check job-search workspace integrity beyond dependency availability."""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path


COMPANY_DIRS_IGNORE: set[str] = set()
COMPANY_HEALTH_IGNORE_FILE = ".health-ignore"
URL_RE = re.compile(r"https?://[^\s\])>]+")
COMPANY_LINK_RE = re.compile(r"data/companies/([a-z0-9][a-z0-9-]*)/")
SESSION_ID_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{6}$")
SESSION_STATUS_RE = re.compile(r"^- Status:\s*(running|blocked|done|abandoned)\s*$", re.M)
SESSION_REQUIRED_SECTIONS = (
    "## Goal",
    "## Plan",
    "## Progress",
    "## Decisions",
    "## Blockers",
    "## Resume Point",
    "## Tracker Updates",
    "## Files Changed",
    "## Artifacts",
    "## Agent Insights",
    "## Summary",
)


@dataclass
class Issue:
    level: str
    message: str


def repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8") if path.exists() else ""


def listed_profiles(root: Path) -> set[str]:
    settings = read_text(root / "config/settings.md")
    profile_slugs = set()

    for match in re.finditer(r"`([a-z0-9][a-z0-9-]*)`", settings):
        slug = match.group(1)
        if (root / "strategy/search-profiles" / f"{slug}.md").exists():
            profile_slugs.add(slug)

    active_match = re.search(r"active profile\s*[:=]\s*`?([a-z0-9][a-z0-9-]*)`?", settings, re.I)
    if active_match:
        profile_slugs.add(active_match.group(1))

    return profile_slugs


def tracker_rows(root: Path) -> tuple[list[dict[str, str]], list[Issue]]:
    tracker = root / "data/tracker.md"
    issues: list[Issue] = []
    rows: list[dict[str, str]] = []

    if not tracker.exists():
        return rows, [Issue("error", "data/tracker.md is missing")]

    current_header: list[str] | None = None
    for line_no, line in enumerate(read_text(tracker).splitlines(), start=1):
        stripped = line.strip()
        if not stripped.startswith("|") or not stripped.endswith("|"):
            continue

        cells = [cell.strip() for cell in stripped.strip("|").split("|")]
        if not cells:
            continue

        if all(re.fullmatch(r":?-{3,}:?", cell.replace(" ", "")) for cell in cells):
            continue

        lowered = [cell.lower() for cell in cells]
        if "profile" in lowered and any(cell.lower() in {"company", "компанія"} for cell in cells):
            current_header = cells
            company_idx = next((i for i, cell in enumerate(lowered) if cell in {"company", "компанія"}), None)
            profile_idx = lowered.index("profile")
            if company_idx is not None and profile_idx != company_idx + 1:
                issues.append(Issue("warning", f"data/tracker.md:{line_no}: Profile column should be immediately after Company/Компанія"))
            continue

        if current_header and len(cells) == len(current_header):
            row = dict(zip(current_header, cells))
            row["_line"] = str(line_no)
            rows.append(row)

    return rows, issues


def company_slug(value: str) -> str:
    value = re.sub(r"\[[^\]]+\]\(([^)]+)\)", r"\1", value)
    value = re.sub(r"https?://", "", value)
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def check_session_reports(root: Path) -> list[Issue]:
    issues: list[Issue] = []
    gitignore = read_text(root / ".gitignore")

    if ".sessions/" not in gitignore:
        issues.append(Issue("error", ".sessions/ is not gitignored"))

    sessions_dir = root / ".sessions"
    reports_dir = sessions_dir / "reports"
    if not sessions_dir.exists():
        return issues

    if not reports_dir.exists():
        issues.append(Issue("warning", ".sessions/ exists but .sessions/reports/ is missing"))
        return issues

    for report in sorted(reports_dir.glob("*.md")):
        rel = report.relative_to(root)
        if not report.name.endswith(".run.md"):
            issues.append(Issue("warning", f"{rel}: Session Report filename should be [id].run.md"))
            continue

        report_id = report.name.removesuffix(".run.md")
        if not SESSION_ID_RE.fullmatch(report_id):
            issues.append(Issue("warning", f"{rel}: Session Report ID should use YYYY-MM-DDTHHMMSS"))

        text = read_text(report)
        if f"- ID: {report_id}" not in text:
            issues.append(Issue("warning", f"{rel}: ID field does not match filename"))

        status_match = SESSION_STATUS_RE.search(text)
        if not status_match:
            issues.append(Issue("warning", f"{rel}: missing or invalid Status"))
        elif status_match.group(1) in {"running", "blocked"}:
            issues.append(Issue("warning", f"{rel}: unfinished Session Report status `{status_match.group(1)}`"))

        for section in SESSION_REQUIRED_SECTIONS:
            if section not in text:
                issues.append(Issue("warning", f"{rel}: missing required section `{section}`"))

    return issues


def main() -> int:
    root = repo_root()
    issues: list[Issue] = []
    profiles = listed_profiles(root)
    rows, tracker_issues = tracker_rows(root)
    issues.extend(tracker_issues)

    if not profiles:
        issues.append(Issue("error", "no profile slugs detected from config/settings.md"))

    issues.extend(check_session_reports(root))

    company_names: list[str] = []
    linked_slugs: set[str] = set()
    urls: list[str] = []

    for row in rows:
        company = row.get("Company") or row.get("Компанія") or ""
        profile = row.get("Profile", "").strip()
        line = row.get("_line", "?")

        if company:
            company_names.append(company)

        if not profile:
            issues.append(Issue("error", f"data/tracker.md:{line}: missing Profile value"))
        elif profile not in profiles:
            issues.append(Issue("error", f"data/tracker.md:{line}: unknown Profile `{profile}`"))

        for cell in row.values():
            if cell.startswith("_"):
                continue
            urls.extend(URL_RE.findall(cell))
            linked_slugs.update(COMPANY_LINK_RE.findall(cell))

    duplicate_urls = {url: count for url, count in Counter(urls).items() if count > 1}
    for url, count in sorted(duplicate_urls.items()):
        issues.append(Issue("warning", f"duplicate URL appears {count} times: {url}"))

    # A company directory is matched if its slug is derivable from a company name
    # or is referenced by a prep/cv link in the tracker. Link slugs are the
    # source of truth because display names like "Example Company" do not
    # normalize to the on-disk slug "example-company".
    tracker_slugs = {company_slug(name) for name in company_names if company_slug(name)}
    tracker_slugs |= linked_slugs

    companies_dir = root / "data/companies"
    if not companies_dir.exists():
        issues.append(Issue("error", "data/companies/ directory is missing"))
    else:
        for company_dir in sorted(path for path in companies_dir.iterdir() if path.is_dir()):
            slug = company_dir.name
            if slug in COMPANY_DIRS_IGNORE:
                continue
            if (company_dir / COMPANY_HEALTH_IGNORE_FILE).exists():
                continue

            prep = company_dir / "prep-notes.md"
            resume = company_dir / "resume.md"
            pdfs = sorted(company_dir.glob("*.pdf"))

            if slug not in tracker_slugs:
                issues.append(Issue("warning", f"data/companies/{slug}/ exists but no matching tracker company slug was detected"))
            if not prep.exists():
                issues.append(Issue("warning", f"data/companies/{slug}/prep-notes.md is missing"))
            if pdfs and not resume.exists():
                issues.append(Issue("warning", f"data/companies/{slug}/ has PDF output but no resume.md"))
            if resume.exists() and resume.stat().st_size == 0:
                issues.append(Issue("error", f"data/companies/{slug}/resume.md is empty"))
            if prep.exists():
                prep_text = read_text(prep)
                has_draft_status = re.search(r"manual message drafts?.*(prepared|ready)", prep_text, re.I)
                if has_draft_status and "### Manual Message Drafts" not in prep_text:
                    issues.append(Issue("warning", f"data/companies/{slug}/prep-notes.md claims manual drafts are prepared but section is missing"))

    base_cv = root / "candidate/cv/cv-base.md"
    if not base_cv.exists():
        issues.append(Issue("error", "candidate/cv/cv-base.md is missing"))
    elif base_cv.stat().st_size == 0:
        issues.append(Issue("error", "candidate/cv/cv-base.md is empty"))

    grouped: dict[str, list[str]] = defaultdict(list)
    for issue in issues:
        grouped[issue.level].append(issue.message)

    print("Workspace health check")
    if not issues:
        print("✓ No workspace integrity issues detected")
        return 0

    for level in ("error", "warning"):
        messages = grouped.get(level, [])
        if not messages:
            continue
        print(f"\n{level.upper()} ({len(messages)})")
        for message in messages:
            print(f"- {message}")

    return 1 if grouped.get("error") else 0


if __name__ == "__main__":
    raise SystemExit(main())
