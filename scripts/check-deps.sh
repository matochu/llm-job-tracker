#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
status=0

ok() {
  printf '✓ %s\n' "$1"
}

fail() {
  printf '✗ %s\n' "$1" >&2
  status=1
}

note() {
  printf '  %s\n' "$1"
}

has_command() {
  command -v "$1" >/dev/null 2>&1
}

check_file() {
  local path="$1"
  local label="$2"
  if [[ -e "$repo_root/$path" ]]; then
    ok "$label: $path"
  else
    fail "$label missing: $path"
  fi
}

check_json() {
  local path="$1"
  if [[ ! -f "$repo_root/$path" ]]; then
    fail "JSON config missing: $path"
    return
  fi
  if python3 -m json.tool "$repo_root/$path" >/dev/null; then
    ok "JSON valid: $path"
  else
    fail "JSON invalid: $path"
  fi
}

check_python_import() {
  local python_bin="$1"
  local module="$2"
  "$python_bin" -c "import $module" >/dev/null 2>&1
}

check_search_profile() {
  local settings_file="$repo_root/config/settings.md"
  local profile_slug
  local profile_file
  local listed_slug

  printf '\nProfile checks\n'

  if [[ ! -f "$settings_file" ]]; then
    fail "Search settings missing: config/settings.md"
    return
  fi
  ok "Search settings: config/settings.md"

  local profile_utils="$repo_root/scripts/llm-hooks/profile_utils.py"
  profile_slug="$(cd "$repo_root" && python3 "$profile_utils" active-slug)"
  profile_file="$(cd "$repo_root" && python3 "$profile_utils" active-file)"

  if [[ -z "$profile_slug" ]]; then
    fail "Active profile slug not found in config/settings.md"
  else
    ok "Active profile slug: $profile_slug"
  fi

  if [[ -z "$profile_file" ]]; then
    fail "Active profile file not found in config/settings.md"
  elif [[ -f "$repo_root/$profile_file" ]]; then
    ok "Active profile file: $profile_file"
  else
    fail "Active profile file missing: $profile_file"
  fi

  while IFS= read -r listed_slug; do
    [[ -n "$listed_slug" ]] || continue
    if [[ -f "$repo_root/strategy/search-profiles/$listed_slug.md" ]]; then
      ok "Listed profile exists: $listed_slug"
    else
      fail "Listed profile missing: strategy/search-profiles/$listed_slug.md"
    fi
  done < <(cd "$repo_root" && python3 "$profile_utils" list-slugs)
}

check_browser_mcp() {
  local found_codex_playwright=0
  local found_codex_chrome=0
  local found_claude_playwright=0
  local found_claude_chrome=0
  local checked_claude_runtime=0
  local checked_runtime=0

  printf '\nBrowser / MCP checks\n'

  if has_command node; then
    ok "node: $(command -v node)"
  else
    fail "node not found; npx-based browser MCP servers need Node.js"
  fi

  if has_command npx; then
    ok "npx: $(command -v npx)"
  else
    fail "npx not found; configured Playwright/Chrome DevTools MCP servers use npx"
  fi

  if has_command codex; then
    checked_runtime=1
    local codex_mcp_output
    if codex_mcp_output="$(codex mcp list 2>/dev/null)"; then
      if grep -Eq '^playwright[[:space:]]' <<<"$codex_mcp_output" && grep -Eq '^playwright[[:space:]].*enabled' <<<"$codex_mcp_output"; then
        ok "Codex MCP enabled: playwright"
        found_codex_playwright=1
      fi
      if grep -Eq '^chrome-devtools[[:space:]]' <<<"$codex_mcp_output" && grep -Eq '^chrome-devtools[[:space:]].*enabled' <<<"$codex_mcp_output"; then
        ok "Codex MCP enabled: chrome-devtools"
        found_codex_chrome=1
      fi
    else
      note "Could not run 'codex mcp list'; falling back to config-file checks"
    fi
  fi

  if [[ -f "$HOME/.codex/config.toml" ]]; then
    if grep -q '^\[mcp_servers\.playwright\]' "$HOME/.codex/config.toml"; then
      [[ "$found_codex_playwright" -eq 1 ]] || ok "Codex MCP configured: playwright"
      found_codex_playwright=1
    fi
    if grep -q '^\[mcp_servers\.chrome-devtools\]' "$HOME/.codex/config.toml"; then
      [[ "$found_codex_chrome" -eq 1 ]] || ok "Codex MCP configured: chrome-devtools"
      found_codex_chrome=1
    fi
  fi

  local claude_cmd="${CLAUDE_BIN:-claude}"
  if has_command "$claude_cmd" || [[ -x "$claude_cmd" ]]; then
    checked_claude_runtime=1
    local claude_mcp_output
    if claude_mcp_output="$("$claude_cmd" mcp list 2>/dev/null)"; then
      if grep -Eiq '^playwright:.*Connected' <<<"$claude_mcp_output"; then
        ok "Claude MCP connected: playwright"
        found_claude_playwright=1
      fi
      if grep -Eiq '^chrome-devtools:.*Connected' <<<"$claude_mcp_output"; then
        ok "Claude MCP connected: chrome-devtools"
        found_claude_chrome=1
      fi
    else
      fail "Could not run '$claude_cmd mcp list'; Claude browser MCP install cannot be verified"
    fi
  else
    fail "claude CLI not found; set CLAUDE_BIN=/path/to/claude to verify Claude browser MCP"
  fi

  if [[ "$found_codex_playwright" -eq 0 && "$found_codex_chrome" -eq 0 ]]; then
    fail "No Codex browser MCP detected; LinkedIn, Djinni, portfolio boards, and JS ATS checks may be blocked in Codex"
    note "Codex example: codex mcp add playwright -- npx -y @playwright/mcp@latest"
    note "Codex example: codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest"
  elif [[ "$found_codex_playwright" -eq 0 ]]; then
    note "Codex Playwright MCP not detected; Chrome DevTools MCP can cover browser work, but Playwright MCP is also useful"
  elif [[ "$found_codex_chrome" -eq 0 ]]; then
    note "Codex Chrome DevTools MCP not detected; Playwright MCP can cover browser work, but Chrome DevTools MCP is also useful"
  fi

  if [[ "$checked_claude_runtime" -eq 1 && "$found_claude_playwright" -eq 0 && "$found_claude_chrome" -eq 0 ]]; then
    fail "No connected Claude browser MCP detected via '$claude_cmd mcp list'"
    note "Claude example: claude mcp add playwright -- npx -y @playwright/mcp@latest"
    note "Claude example: claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest"
  fi

  if [[ "$checked_runtime" -eq 0 ]]; then
    note "Codex CLI not found; skipped live 'codex mcp list' check"
  fi
}

printf 'Dependency check for job-search workspace\n\n'

if has_command python3; then
  ok "python3: $(command -v python3)"
else
  fail "python3 not found; hooks and PDF generation need it"
fi

if has_command pandoc; then
  ok "pandoc: $(command -v pandoc)"
else
  fail "pandoc not found; PDF generation needs it"
  note "macOS: brew install pandoc"
fi

if has_command python3; then
  if check_python_import python3 weasyprint; then
    ok "weasyprint importable with python3"
  elif [[ -x "$repo_root/scripts/.venv/bin/python3" ]] && check_python_import "$repo_root/scripts/.venv/bin/python3" weasyprint; then
    ok "weasyprint importable with scripts/.venv/bin/python3"
  elif [[ -x "/tmp/resume-venv/bin/python3" ]] && check_python_import "/tmp/resume-venv/bin/python3" weasyprint; then
    ok "weasyprint importable with /tmp/resume-venv/bin/python3"
  else
    fail "weasyprint not importable; PDF generation needs the Python package"
    note "suggested: python3 -m venv /tmp/resume-venv && /tmp/resume-venv/bin/pip install weasyprint"
  fi
fi

check_search_profile
check_browser_mcp

check_file "scripts/generate_pdf.py" "PDF generator"
check_file "scripts/resume.css" "PDF CSS"
check_file "scripts/llm-hooks/pre_tool_guard.py" "PreToolUse hook"
check_file "scripts/llm-hooks/post_tool_check.py" "PostToolUse hook"
check_file "scripts/llm-hooks/stop_check.py" "Stop hook"
check_file "scripts/llm-hooks/validate_tracker_profiles.py" "Tracker profile validator"
check_file "scripts/llm-hooks/validate_skill_footers.py" "Skill output validator"
check_file "scripts/check-workspace.py" "Workspace health checker"
check_json "scripts/llm-hooks/codex-hooks.json"
check_json "scripts/llm-hooks/claude-settings.json"

if has_command python3; then
  if python3 -m py_compile \
    "$repo_root/scripts/generate_pdf.py" \
    "$repo_root/scripts/llm-hooks/hooklib.py" \
    "$repo_root/scripts/llm-hooks/pre_tool_guard.py" \
    "$repo_root/scripts/llm-hooks/post_tool_check.py" \
    "$repo_root/scripts/llm-hooks/validate_tracker_profiles.py" \
    "$repo_root/scripts/llm-hooks/validate_skill_footers.py" \
    "$repo_root/scripts/llm-hooks/stop_check.py" \
    "$repo_root/scripts/check-workspace.py"; then
    ok "Python scripts compile"
  else
    fail "Python script compile check failed"
  fi
fi

if has_command python3; then
  if (cd "$repo_root" && python3 scripts/llm-hooks/validate_skill_footers.py >/dev/null); then
    ok "Skill output requires active profile and job:action next actions"
  else
    fail "Skill output validation failed"
    (cd "$repo_root" && python3 scripts/llm-hooks/validate_skill_footers.py) || true
  fi
fi

if has_command python3; then
  if (cd "$repo_root" && python3 scripts/llm-hooks/validate_tracker_profiles.py >/dev/null); then
    ok "Tracker Profile columns are valid"
  else
    fail "Tracker Profile column validation failed"
    (cd "$repo_root" && python3 scripts/llm-hooks/validate_tracker_profiles.py) || true
  fi
fi

if [[ -f "$repo_root/.codex/hooks.json" ]]; then
  if cmp -s "$repo_root/scripts/llm-hooks/codex-hooks.json" "$repo_root/.codex/hooks.json"; then
    ok "Codex hooks installed and in sync"
  else
    fail "Codex hooks installed but out of sync; run scripts/install.sh codex"
  fi
else
  note "Codex hooks not installed locally; run scripts/install.sh codex if needed"
fi

if [[ -f "$repo_root/scripts/llm-hooks/codex-rules/default.rules" ]]; then
  if [[ -f "$repo_root/.codex/rules/default.rules" ]]; then
    if cmp -s "$repo_root/scripts/llm-hooks/codex-rules/default.rules" "$repo_root/.codex/rules/default.rules"; then
      ok "Codex command rules installed and in sync"
    else
      fail "Codex command rules installed but out of sync; run scripts/install.sh codex"
    fi
  else
    note "Codex command rules not installed locally; run scripts/install.sh codex if needed"
  fi
fi

if [[ -f "$repo_root/.claude/settings.json" ]]; then
  if grep -q "scripts/llm-hooks/pre_tool_guard.py" "$repo_root/.claude/settings.json" \
    && grep -q "scripts/llm-hooks/post_tool_check.py" "$repo_root/.claude/settings.json" \
    && grep -q "scripts/llm-hooks/stop_check.py" "$repo_root/.claude/settings.json"; then
    ok "Claude hooks present in local settings"
  else
    fail "Claude settings exist but required job-search hooks are missing"
  fi
else
  note "Claude hooks not installed locally; run scripts/install.sh claude if needed"
fi

if [[ "$status" -eq 0 ]]; then
  printf '\nAll required dependencies are available.\n'
else
  printf '\nMissing or broken dependencies detected.\n' >&2
fi

exit "$status"
