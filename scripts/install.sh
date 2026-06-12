#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  scripts/install.sh [target] [--copy]

Targets:
  claude   Link/copy skills into .claude/ and install CLAUDE.md
  codex    Link/copy skills into local .codex/skills/
  all      Install both targets

Options:
  --copy           Copy directories instead of symlinking

Notes:
  - Canonical skills directory is ./skills.
  - Canonical config zones are ./config, ./candidate, ./strategy, ./style, ./templates.
  - Canonical agent instructions are ./config/agent-instructions.md.
  - Claude project installs use .claude/skills.
  - Claude project installs CLAUDE.md.
  - Claude project creates .claude/settings.json hooks only when local settings are missing.
  - Codex installs each skill folder directly under local .codex/skills.
  - Codex installs AGENTS.md in the current repository.
  - Codex installs .codex/hooks.json hooks when available.
  - Codex installs project-local .codex/rules/ command rules when available.
  - Run node scripts/check-deps.js after setup to verify hook and PDF dependencies.
  - The repository-local .codex/ directory is intended to stay untracked.
USAGE
}

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${1:-}"
mode="symlink"

if [[ -z "$target" ]]; then
  while [[ -z "$target" ]]; do
    cat <<'PROMPT'
Install skills for:
1) Claude
2) Codex
3) All
4) Cancel
PROMPT
    read -r -p "Choice [3]: " choice
    choice="${choice:-3}"
    case "$choice" in
      1|claude|Claude)
        target="claude"
        ;;
      2|codex|Codex)
        target="codex"
        ;;
      3|all|All)
        target="all"
        ;;
      4|cancel|Cancel)
        echo "Cancelled."
        exit 0
        ;;
      *)
        echo "Choose 1, 2, 3, or 4."
        ;;
    esac
  done

  while true; do
    cat <<'PROMPT'
Install mode:
1) Symlink
2) Copy
PROMPT
    read -r -p "Choice [1]: " choice
    choice="${choice:-1}"
    case "$choice" in
      1|symlink|Symlink)
        mode="symlink"
        break
        ;;
      2|copy|Copy)
        mode="copy"
        break
        ;;
      *)
        echo "Choose 1 or 2."
        ;;
    esac
  done
fi

if [[ "${2:-}" == "--copy" ]]; then
  mode="copy"
fi

link_or_copy_dir() {
  local src="$1"
  local dest="$2"

  mkdir -p "$(dirname "$dest")"

  if [[ -L "$dest" ]]; then
    unlink "$dest"
  elif [[ -e "$dest" ]]; then
    rm -rf "$dest"
    echo "Replaced existing $dest"
  fi

  if [[ "$mode" == "copy" ]]; then
    cp -R "$src" "$dest"
  else
    ln -s "$src" "$dest"
  fi
}

install_agent_file() {
  local dest="$1"
  local src="$repo_root/config/agent-instructions.md"

  if [[ ! -f "$src" ]]; then
    echo "Missing canonical agent instructions: $src" >&2
    exit 1
  fi

  if [[ -L "$dest" ]]; then
    unlink "$dest"
  elif [[ -e "$dest" ]]; then
    if cmp -s "$src" "$dest"; then
      echo "$dest is already up to date"
      return
    fi
    rm -f "$dest"
    echo "Replaced existing $dest"
  fi

  cp "$src" "$dest"
  echo "Installed $dest"
}

install_optional_file() {
  local src="$1"
  local dest="$2"

  [[ -f "$src" ]] || return 0
  mkdir -p "$(dirname "$dest")"

  if [[ -L "$dest" ]]; then
    unlink "$dest"
  elif [[ -e "$dest" ]]; then
    if cmp -s "$src" "$dest"; then
      echo "$dest is already up to date"
      return
    fi
    rm -f "$dest"
    echo "Replaced existing $dest"
  fi

  cp "$src" "$dest"
  echo "Installed $dest"
}

install_optional_file_if_missing() {
  local src="$1"
  local dest="$2"

  [[ -f "$src" ]] || return 0
  mkdir -p "$(dirname "$dest")"

  if [[ -e "$dest" || -L "$dest" ]]; then
    echo "$dest exists; preserving local settings"
    return
  fi

  cp "$src" "$dest"
  echo "Installed $dest"
}

install_claude_project() {
  mkdir -p "$repo_root/.claude"
  link_or_copy_dir "$repo_root/skills" "$repo_root/.claude/skills"
  install_optional_file_if_missing "$repo_root/scripts/llm-hooks/claude-settings.json" "$repo_root/.claude/settings.json"
  install_agent_file "$repo_root/CLAUDE.md"
  echo "Installed Claude project skills in .claude/"
}

install_codex_project() {
  local codex_skills="$repo_root/.codex/skills"

  mkdir -p "$codex_skills"

  for skill_dir in "$repo_root"/skills/*; do
    [[ -d "$skill_dir" ]] || continue
    link_or_copy_dir "$skill_dir" "$codex_skills/$(basename "$skill_dir")"
  done

  echo "Installed Codex project skills in $codex_skills"
  install_optional_file "$repo_root/scripts/llm-hooks/codex-hooks.json" "$repo_root/.codex/hooks.json"
  if [[ -d "$repo_root/scripts/llm-hooks/codex-rules" ]]; then
    link_or_copy_dir "$repo_root/scripts/llm-hooks/codex-rules" "$repo_root/.codex/rules"
  fi
  install_agent_file "$repo_root/AGENTS.md"
}

case "$target" in
  claude)
    install_claude_project
    ;;
  codex)
    install_codex_project
    ;;
  all)
    install_claude_project
    install_codex_project
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac

echo "Next: run job:setup in your LLM tool to verify workspace readiness."
