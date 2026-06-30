#!/usr/bin/env node
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');

function promptTarget() {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve('all');
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Install for: [1] Claude (default)  [2] Codex  [3] Both\n> ', (answer) => {
      rl.close();
      const map = { '': 'claude', '1': 'claude', '2': 'codex', '3': 'all' };
      resolve(map[answer.trim()] ?? 'claude');
    });
  });
}

function usage() {
  console.log(`Usage:
  node scripts/install.js [target] [--copy]

Targets:
  claude   Link/copy skills into .claude/ and install CLAUDE.md
  codex    Link/copy skills into local .codex/skills/
  all      Install both targets (non-interactive / CI)

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

  if (target !== null && !['claude', 'codex', 'all'].includes(target)) {
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


function installClaudeSettings(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dirname(dest), { recursive: true });

  if (!existsSync(dest) && !isSymlink(dest)) {
    cpSync(src, dest);
    console.log(`Installed ${dest}`);
    return;
  }

  try {
    const source = JSON.parse(readFileSync(src, 'utf8'));
    const local = JSON.parse(readFileSync(dest, 'utf8'));
    local.hooks = source.hooks;
    writeFileSync(dest, `${JSON.stringify(local, null, 2)}\n`);
    console.log(`Updated hooks in ${dest}; preserved local settings`);
  } catch {
    console.log(`${dest} exists; preserving local settings`);
  }
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

function pruneStaleSkills(skillsDir, canonicalNames) {
  if (!existsSync(skillsDir)) return;
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!canonicalNames.has(entry.name)) {
      const stale = join(skillsDir, entry.name);
      rmSync(stale, { recursive: true, force: true });
      console.log(`Removed stale skill: ${entry.name}`);
    }
  }
}

function installClaudeProject(mode) {
  mkdirSync(join(repoRoot, '.claude'), { recursive: true });
  const claudeSkills = join(repoRoot, '.claude', 'skills');
  const canonicalSkills = join(repoRoot, 'skills');
  const canonicalNames = new Set(readdirSync(canonicalSkills, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name));

  // If .claude/skills exists as a non-symlink dir, prune stale entries before replacing
  if (existsSync(claudeSkills) && !lstatSync(claudeSkills).isSymbolicLink()) {
    pruneStaleSkills(claudeSkills, canonicalNames);
  }
  linkOrCopyDir(canonicalSkills, claudeSkills, mode);
  installClaudeSettings(join(repoRoot, 'scripts/llm-hooks/claude-settings.json'), join(repoRoot, '.claude/settings.json'));
  installAgentFile(join(repoRoot, 'CLAUDE.md'));
  console.log('Installed Claude project skills in .claude/');
}

function installCodexProject(mode) {
  const codexSkills = join(repoRoot, '.codex', 'skills');
  mkdirSync(codexSkills, { recursive: true });

  const canonicalNames = new Set(readdirSync(join(repoRoot, 'skills'), { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name));
  pruneStaleSkills(codexSkills, canonicalNames);

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
  const parsed = parseArgs(process.argv.slice(2));
  const target = parsed.target ?? await promptTarget();
  const { mode } = parsed;

  if (target === 'claude') {
    installClaudeProject(mode);
  } else if (target === 'codex') {
    installCodexProject(mode);
  } else {
    installClaudeProject(mode);
    installCodexProject(mode);
  }

  if (process.env.JOB_TRACKER_INSTALL_CONTEXT !== 'update') {
    console.log('Next: run job-tracker:setup in your LLM tool to verify workspace readiness.');
  }
} catch (err) {
  console.error(`install: ${err.message}`);
  console.error('');
  usage();
  process.exit(1);
}
