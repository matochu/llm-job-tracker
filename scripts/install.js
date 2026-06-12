#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

function usage() {
  console.log(`Usage:
  node scripts/install.js [target] [--copy]

Targets:
  claude   Link/copy skills into .claude/ and install CLAUDE.md
  codex    Link/copy skills into local .codex/skills/
  all      Install both targets

Options:
  --copy   Copy directories instead of symlinking
  --help   Show this help

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
`);
}

function parseArgs(argv) {
  let target = null;
  let mode = 'symlink';

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h' || arg === 'help') {
      usage();
      process.exit(0);
    }
    if (arg === '--copy') {
      mode = 'copy';
      continue;
    }
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (target) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    target = arg;
  }

  target ??= 'all';

  if (!['claude', 'codex', 'all'].includes(target)) {
    throw new Error(`Unknown install target: ${target}`);
  }

  return { target, mode };
}

function isSymlink(path) {
  return existsSync(path) && lstatSync(path).isSymbolicLink();
}

function removeExisting(path) {
  if (isSymlink(path)) {
    unlinkSync(path);
    return true;
  }
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    console.log(`Replaced existing ${path}`);
    return true;
  }
  return false;
}

function sameFile(a, b) {
  if (!existsSync(a) || !existsSync(b)) return false;
  return readFileSync(a).equals(readFileSync(b));
}

function linkOrCopyDir(src, dest, mode) {
  mkdirSync(dirname(dest), { recursive: true });
  removeExisting(dest);

  if (mode === 'copy') {
    cpSync(src, dest, { recursive: true });
  } else {
    symlinkSync(src, dest, 'dir');
  }
}

function installAgentFile(dest) {
  const src = join(repoRoot, 'config', 'agent-instructions.md');
  if (!existsSync(src)) {
    throw new Error(`Missing canonical agent instructions: ${src}`);
  }

  if (isSymlink(dest)) {
    unlinkSync(dest);
  } else if (existsSync(dest)) {
    if (sameFile(src, dest)) {
      console.log(`${dest} is already up to date`);
      return;
    }
    rmSync(dest, { force: true });
    console.log(`Replaced existing ${dest}`);
  }

  cpSync(src, dest);
  console.log(`Installed ${dest}`);
}

function installOptionalFile(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dirname(dest), { recursive: true });

  if (isSymlink(dest)) {
    unlinkSync(dest);
  } else if (existsSync(dest)) {
    if (sameFile(src, dest)) {
      console.log(`${dest} is already up to date`);
      return;
    }
    rmSync(dest, { force: true });
    console.log(`Replaced existing ${dest}`);
  }

  cpSync(src, dest);
  console.log(`Installed ${dest}`);
}

function installOptionalFileIfMissing(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dirname(dest), { recursive: true });

  if (existsSync(dest) || isSymlink(dest)) {
    console.log(`${dest} exists; preserving local settings`);
    return;
  }

  cpSync(src, dest);
  console.log(`Installed ${dest}`);
}

function installClaudeProject(mode) {
  mkdirSync(join(repoRoot, '.claude'), { recursive: true });
  linkOrCopyDir(join(repoRoot, 'skills'), join(repoRoot, '.claude', 'skills'), mode);
  installOptionalFileIfMissing(join(repoRoot, 'scripts/llm-hooks/claude-settings.json'), join(repoRoot, '.claude/settings.json'));
  installAgentFile(join(repoRoot, 'CLAUDE.md'));
  console.log('Installed Claude project skills in .claude/');
}

function installCodexProject(mode) {
  const codexSkills = join(repoRoot, '.codex', 'skills');
  mkdirSync(codexSkills, { recursive: true });

  for (const entry of readdirSync(join(repoRoot, 'skills'), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillDir = join(repoRoot, 'skills', entry.name);
    linkOrCopyDir(skillDir, join(codexSkills, basename(skillDir)), mode);
  }

  console.log(`Installed Codex project skills in ${codexSkills}`);
  installOptionalFile(join(repoRoot, 'scripts/llm-hooks/codex-hooks.json'), join(repoRoot, '.codex/hooks.json'));
  if (existsSync(join(repoRoot, 'scripts/llm-hooks/codex-rules'))) {
    linkOrCopyDir(join(repoRoot, 'scripts/llm-hooks/codex-rules'), join(repoRoot, '.codex/rules'), mode);
  }
  installAgentFile(join(repoRoot, 'AGENTS.md'));
}

try {
  const { target, mode } = parseArgs(process.argv.slice(2));

  if (target === 'claude') {
    installClaudeProject(mode);
  } else if (target === 'codex') {
    installCodexProject(mode);
  } else {
    installClaudeProject(mode);
    installCodexProject(mode);
  }

  console.log('Next: run job:setup in your LLM tool to verify workspace readiness.');
} catch (err) {
  console.error(`install: ${err.message}`);
  console.error('');
  usage();
  process.exit(1);
}
