#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail() {
  printf 'check-public: %s\n' "$1" >&2
  exit 1
}

for path in .claude .codex .sessions .playwright-mcp tmp cv.md cv.pdf template job-search versions tracker.md companies; do
  [[ ! -e "$repo_root/$path" ]] || fail "forbidden public path exists: $path"
done

[[ ! -e "$repo_root/EXPORT_REVIEW.md" ]] || fail "EXPORT_REVIEW.md must not be published"
[[ -f "$repo_root/data/tracker.md" ]] || fail "data/tracker.md is missing"
[[ -f "$repo_root/candidate/candidate.md" ]] || fail "candidate/candidate.md is missing"
[[ -f "$repo_root/candidate/cv/cv-base.md" ]] || fail "candidate/cv/cv-base.md is missing"
[[ -f "$repo_root/strategy/search-profiles/default.md" ]] || fail "default search profile is missing"

if find "$repo_root/data/companies" -mindepth 1 -type f ! -name '.gitkeep' 2>/dev/null | grep -q .; then
  fail "data/companies must not contain live company artifacts"
fi

if find "$repo_root/candidate/cv" -mindepth 1 -maxdepth 1 ! -name 'cv-base.md' 2>/dev/null | grep -q .; then
  fail "candidate/cv must contain only cv-base.md"
fi

generic_private_pattern='ATATT|JIRA_API_TOKEN|CONFLUENCE_API_TOKEN|Documents/Claude/Projects/Resume|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+[0-9][0-9 ()-]{7,}'
if grep -RIE --exclude-dir=.git --exclude='package-lock.json' --exclude='check-public.sh' "$generic_private_pattern" "$repo_root" >/tmp/job-tracker-public-scan.txt; then
  cat /tmp/job-tracker-public-scan.txt >&2
  fail "private marker found"
fi

local_patterns="$repo_root/.public-scan-patterns.local"
if [[ -f "$local_patterns" ]]; then
  while IFS= read -r pattern; do
    [[ -n "$pattern" && ! "$pattern" =~ ^[[:space:]]*# ]] || continue
    if grep -RIE --exclude-dir=.git --exclude='package-lock.json' --exclude='check-public.sh' "$pattern" "$repo_root" >/tmp/job-tracker-local-scan.txt; then
      cat /tmp/job-tracker-local-scan.txt >&2
      fail "local private marker found"
    fi
  done < "$local_patterns"
fi

stale_pattern='job-search/|versions/|\]\(companies/|\]\(tracker\.md\)'
if grep -RIE --exclude-dir=.git --exclude='check-public.sh' "$stale_pattern" "$repo_root" >/tmp/job-tracker-stale-scan.txt; then
  cat /tmp/job-tracker-stale-scan.txt >&2
  fail "stale architecture path found"
fi

printf 'check-public: ok\n'
