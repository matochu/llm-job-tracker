#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
timestamp="$(date +"%Y%m%d-%H%M%S")"
dest="$repo_root/tmp/resume-workspace-starter-$timestamp"
write_review=1

usage() {
  cat <<'USAGE'
Usage:
  scripts/export-starter.sh
  scripts/export-starter.sh --dest PATH

Creates a sanitized starter copy in project-local tmp/ for manual review.
With --dest, writes the sanitized starter to PATH.
It does not create an archive and does not modify the source workspace.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --dest)
      if [[ -z "${2:-}" ]]; then
        printf 'error: --dest requires a path\n' >&2
        exit 2
      fi
      dest="$2"
      write_review=0
      shift 2
      ;;
    *)
      printf 'error: unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -e "$dest" ]]; then
  if [[ ! -d "$dest" ]]; then
    printf 'error: destination exists and is not a directory: %s\n' "$dest" >&2
    exit 1
  fi
  if find "$dest" -mindepth 1 -maxdepth 1 | grep -q .; then
    printf 'error: destination is not empty: %s\n' "$dest" >&2
    exit 1
  fi
fi

copy_dir() {
  local src="$1"
  local target="$2"

  if [[ -d "$repo_root/$src" ]]; then
    mkdir -p "$(dirname "$dest/$target")"
    cp -R "$repo_root/$src" "$dest/$target"
  fi
}

copy_file() {
  local src="$1"
  local target="${2:-$1}"

  if [[ -f "$repo_root/$src" ]]; then
    mkdir -p "$(dirname "$dest/$target")"
    cp "$repo_root/$src" "$dest/$target"
  fi
}

rm_if_exists() {
  local path="$1"
  [[ -e "$dest/$path" ]] && rm -rf "$dest/$path"
  return 0
}

mkdir -p "$dest"

copy_file "README.md"
copy_file ".gitignore"
copy_dir "skills" "skills"
copy_dir "scripts" "scripts"
copy_dir "config" "config"
copy_dir "candidate" "candidate"
copy_dir "strategy" "strategy"
copy_dir "style" "style"
copy_dir "templates" "templates"

rm_if_exists "scripts/.venv"
rm_if_exists "scripts/__pycache__"
rm_if_exists "scripts/llm-hooks/__pycache__"
rm_if_exists "strategy/search-profiles"
rm_if_exists "candidate/cv"
rm_if_exists "candidate/candidate.md"
rm_if_exists "candidate/stories.md"
rm_if_exists "data"
rm_if_exists "CLAUDE.md"
rm_if_exists "AGENTS.md"
rm_if_exists ".claude"
rm_if_exists ".codex"
rm_if_exists ".sessions"
rm_if_exists ".playwright-mcp"

mkdir -p "$dest/strategy/search-profiles"
mkdir -p "$dest/candidate/cv"
mkdir -p "$dest/data/companies"

cat > "$dest/START_HERE.md" <<'EOF'
# Start Here

This is a sanitized starter workspace for a new candidate.

1. Fill `candidate/candidate.md` with real candidate facts.
2. Put the base CV in `candidate/cv/cv-base.md`.
3. Adjust `strategy/search-profiles/default.md` for the target search strategy.
4. Review `config/settings.md`.
5. Run:

```bash
scripts/install.sh all
node scripts/check-deps.js
```

Then in the LLM tool run:

```text
job:setup
```
EOF

cat > "$dest/candidate/candidate.md" <<'EOF'
# Candidate Profile

## Identity

- **Name:**
- **Location:**
- **Email:**
- **LinkedIn:**
- **Phone:**

## Skills

- **Core:**
- **Frontend strengths:**
- **Backend strengths:**
- **Domain strengths:**
- **Bonus differentiators:**

## Constraints

- **English:**
- **Work authorization / visa:**
- **Location / remote limits:**
- **Compensation expectations:**
- **Hard no:**
EOF

cat > "$dest/config/settings.md" <<'EOF'
# Job Search Settings

## Active Profile

- **Profile slug:** `default`
- **Profile file:** `strategy/search-profiles/default.md`

## Profile Rules

- Skills should read this file before choosing a profile.
- New job discovery uses the active profile above.
- Existing tracked vacancies use the `Profile` value stored in `data/tracker.md`.
- User-facing commands do not pass profiles as arguments, except `job:run`, which may take a profile slug and switches the active profile via `job:profile use` before running.
- Treat all other command arguments as normal skill arguments, such as company names, sections, keywords, paths, or vacancy URLs.
- Profiles refine positioning, keywords, source priorities, and fit signals.
- Profiles do not override truthfulness rules, candidate identity, language rules, or tracker schema.

## Available Profiles

- `default` — baseline search profile for this candidate.
EOF

cat > "$dest/strategy/search-profiles/default.md" <<'EOF'
# Profile — Default

## Positioning

Describe the target role family and candidate positioning.

## Target Role Families

- 

## Strong Fit Signals

- 

## Work Mode

- 

## Medium Fit Signals

- 

## Reject / Low ROI

- 

## Baseline Priority Rules

- **P1:**
- **P2:**
- **P3:**

## Application Strategy

- 

## Search Queries

- 

## Priority Company Themes

- 

## CV / Outreach Emphasis

- 

## Tracker Tag

Use this tag in tracker notes when useful:

```md
- Search profile: default
```
EOF

cat > "$dest/candidate/stories.md" <<'EOF'
# Interview Story Bank

Use this file to keep reusable, factual interview stories for CV fit review, recruiter screens, and interview preparation.

Rules:

- Store only real experience from `candidate/candidate.md`, CVs, prep notes, or user-confirmed facts.
- Do not invent metrics, ownership, incidents, employers, tools, or outcomes.
- Mark weak or incomplete stories as `Needs user confirmation`.
- Keep stories reusable across companies; company-specific positioning belongs in `data/companies/*/prep-notes.md`.
- Prefer 5-10 strong master stories over many shallow examples.
- Every story must have a stable ID (`S001`, `S002`, ...). Use the ID in fit reviews, prep notes, and interview plans instead of repeating the full story.
- Keep the index row and full story details in sync.

## Story Index

| ID | Title | Status | Primary Skill | Secondary Skills | Impact | Domains | Best For | Strength | Use Count | Last Used | Source Evidence | Notes |
|---|---|---|---|---|---|---|---|---:|---:|---|---|---|

## Story Details

Add confirmed stories here as the search progresses.
EOF

cat > "$dest/candidate/cv/cv-base.md" <<'EOF'
# Candidate Name

Location · Email · LinkedIn · Phone

## Summary

Write a factual professional summary.

## Skills

- 

## Experience

### Company — Role

Dates · Location / remote

- 

## Education

- 
EOF

cat > "$dest/data/tracker.md" <<'EOF'
# Job Search Tracker

> Updated:
> Active profile: `default`

## Legend

Status lifecycle:
`new` → `verifying` → `active` → `applied` → `interview` → `offer`
side states: `monitoring`, `closed`, `rejected`, `skipped`

## Active Pipeline

| Company | Profile | Role | Location | Fit | Pri | Status | Contact / Channel | Updated | Links |
|---|---|---|---|---|---|---|---|---|---|

## Monitoring

| Company | Profile | Location | Contact | Checked | Next | Notes |
|---|---|---|---|---|---|---|

## Staging

| Company | Profile | Role | Location | Link | Notes |
|---|---|---|---|---|---|

## Raw Pipeline

| Company | Profile | Role | URL | Added | Status |
|---|---|---|---|---|---|

## Submitted / In Process

| Company | Profile | Date | Status | Next Step |
|---|---|---|---|---|

## Archive

| Company | Profile | Role | Status | Detail |
|---|---|---|---|---|
EOF

if [[ "$write_review" -eq 1 ]]; then
  cat > "$dest/EXPORT_REVIEW.md" <<EOF
# Export Review

Created: $timestamp
Source: $repo_root

This directory is a sanitized starter copy for review. It is not archived yet.

Sanitized or regenerated:

- candidate/candidate.md
- config/settings.md
- strategy/search-profiles/default.md
- candidate/stories.md
- candidate/cv/cv-base.md
- data/tracker.md
- data/companies/

Excluded from the source workspace:

- data/companies/* live artifacts
- data/tracker.md live data
- candidate/cv/* personal CVs/PDFs
- root cv.md / cv.pdf
- .claude/
- .codex/
- .sessions/
- .playwright-mcp/
- CLAUDE.md / AGENTS.md generated files
- scripts/.venv and Python caches
EOF
fi

if [[ "$write_review" -eq 1 ]]; then
  printf 'Starter workspace created for review:\n%s\n' "$dest"
else
  printf 'Starter workspace created:\n%s\n' "$dest"
fi
