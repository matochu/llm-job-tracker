#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const defaultGitignore = `# Browser MCP
.playwright-mcp/*

# Codex/Claude project directories
.codex/
.claude/

# Agent instructions
CLAUDE.md
AGENTS.md

# Python cache
__pycache__/
*.pyc

# Backup files
*.backup.*

# Session artifacts (runtime, not content)
.sessions/

# Local export/review artifacts
tmp/
.DS_Store
`;

const initEntries = [
  '.gitignore',
  'README.md',
  'START_HERE.md',
  'config',
  'candidate',
  'strategy',
  'style',
  'templates',
  'data',
  'skills',
  'scripts',
];

const managedEntries = [
  'README.md',
  'START_HERE.md',
  'skills',
  'scripts',
  'templates',
  'config/agent-instructions.md',
  'config/next-actions.md',
  'config/tracker-schema.md',
  'config/session-reports.md',
];


const removedManagedEntries = [
  'scripts/resume.css',
  'scripts/check-deps.sh',
  'scripts/check-public.sh',
  'scripts/check-workspace.py',
  'scripts/export-starter.sh',
  'scripts/install.sh',
  'scripts/llm-hooks/hooklib.py',
  'scripts/llm-hooks/pre_tool_guard.py',
  'scripts/llm-hooks/post_tool_check.py',
  'scripts/llm-hooks/profile_utils.py',
  'scripts/llm-hooks/stop_check.py',
  'scripts/llm-hooks/validate_skill_footers.py',
  'scripts/llm-hooks/validate_tracker_profiles.py',
];

const protectedEntries = [
  'candidate',
  'strategy/search-profiles',
  'strategy/sources.md',
  'data',
  'config/settings.md',
  'config/language.md',
  'config/paths.md',
];

const excludedScriptEntries = new Set(['check-public.js']);
const updateExcludedScriptEntries = new Set(['check-public.js', 'cv.css']);
const workspaceMarkers = ['config/paths.md', 'config/settings.md', 'data/tracker.md', 'candidate/candidate.md'];

function usage() {
  console.log(`Usage:
  npx llm-job-tracker [target-dir] [--no-install] [--force]
  npx llm-job-tracker init [target-dir] [--no-install] [--force]
  npx llm-job-tracker update [target-dir] [--no-install] [--dry-run]

Defaults:
  target-dir defaults to the current directory.
  Without an explicit command, existing workspaces are updated and other targets are initialized.

Options:
  --no-install  Copy/update files without running node scripts/install.js all
  --force       Allow init into a non-empty non-workspace target
  --dry-run     Show update actions without writing files
  --help        Show this help
`);
}

function parseArgs(argv) {
  const opts = {
    command: 'auto',
    target: '.',
    install: true,
    force: false,
    dryRun: false,
  };
  let sawTarget = false;
  const args = [...argv];
  if (['init', 'update'].includes(args[0])) {
    opts.command = args.shift();
  }
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--no-install') {
      opts.install = false;
      continue;
    }
    if (arg === '--force') {
      opts.force = true;
      continue;
    }
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`);
    if (sawTarget) throw new Error(`Unexpected argument: ${arg}`);
    opts.target = arg;
    sawTarget = true;
  }
  if (opts.command === 'init' && opts.dryRun) throw new Error('--dry-run is only supported for update');
  return opts;
}

function isEmptyDir(path) {
  return existsSync(path) && statSync(path).isDirectory() && readdirSync(path).length === 0;
}

function isWorkspace(path) {
  return workspaceMarkers.some((marker) => existsSync(resolve(path, marker)));
}

function ensureInitTarget(path, force) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
    return;
  }
  if (!statSync(path).isDirectory()) throw new Error(`Target exists and is not a directory: ${path}`);
  if (!force && !isEmptyDir(path) && !isWorkspace(path)) {
    throw new Error(`Target directory is not empty and is not a job-tracker workspace: ${path}\nUse --force to initialize into it.`);
  }
}

function copyEntry(src, dest, force = true) {
  cpSync(src, dest, {
    recursive: true,
    force,
    errorOnExist: !force,
  });
}

function copyScripts(target, force, dryRun = false, excluded = excludedScriptEntries) {
  const src = resolve(repoRoot, 'scripts');
  const dest = resolve(target, 'scripts');
  if (!dryRun) mkdirSync(dest, { recursive: true });
  for (const scriptEntry of readdirSync(src)) {
    if (excluded.has(scriptEntry)) continue;
    const from = resolve(src, scriptEntry);
    const to = resolve(dest, scriptEntry);
    if (dryRun) console.log(`update ${resolve('scripts', scriptEntry)}`);
    else copyEntry(from, to, force);
  }
}

function copyWorkspace(target, force) {
  let copiedGitignore = false;
  for (const entry of initEntries) {
    const src = resolve(repoRoot, entry);
    if (!existsSync(src)) continue;
    if (entry === 'scripts') {
      copyScripts(target, force);
      continue;
    }
    copyEntry(src, resolve(target, entry), force);
    if (entry === '.gitignore') copiedGitignore = true;
  }
  if (!copiedGitignore && !existsSync(resolve(target, '.gitignore'))) writeFileSync(resolve(target, '.gitignore'), defaultGitignore);
  mkdirSync(resolve(target, 'data', 'companies'), { recursive: true });
  mkdirSync(resolve(target, 'candidate', 'cv'), { recursive: true });
  mkdirSync(resolve(target, 'strategy', 'search-profiles'), { recursive: true });
}

function updateWorkspace(target, dryRun = false) {
  if (!existsSync(target) || !statSync(target).isDirectory()) throw new Error(`Workspace target is not a directory: ${target}`);
  if (!isWorkspace(target)) throw new Error(`Refusing to update non-workspace target: ${target}`);
  for (const entry of removedManagedEntries) {
    const stale = resolve(target, entry);
    if (!existsSync(stale)) continue;
    if (dryRun) console.log(`remove ${entry}`);
    else rmSync(stale, { recursive: true, force: true });
  }
  for (const entry of managedEntries) {
    const src = resolve(repoRoot, entry);
    if (!existsSync(src)) continue;
    if (entry === 'scripts') {
      copyScripts(target, true, dryRun, updateExcludedScriptEntries);
      continue;
    }
    const dest = resolve(target, entry);
    if (dryRun) console.log(`update ${entry}`);
    else copyEntry(src, dest, true);
  }
  if (dryRun) {
    for (const entry of protectedEntries) console.log(`preserve ${entry}`);
  }
}

function runInstall(target) {
  const result = spawnSync(process.execPath, ['scripts/install.js'], {
    cwd: target,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`node scripts/install.js failed with exit code ${result.status}`);
}

function modeFor(opts, target) {
  if (opts.command !== 'auto') return opts.command;
  return existsSync(target) && isWorkspace(target) ? 'update' : 'init';
}

try {
  const opts = parseArgs(process.argv.slice(2));
  const target = resolve(process.cwd(), opts.target);
  const mode = modeFor(opts, target);

  if (mode === 'init') {
    ensureInitTarget(target, opts.force);
    copyWorkspace(target, opts.force || isWorkspace(target));
    if (opts.install) runInstall(target);
    console.log(`\nLLM job tracker workspace initialized:\n${target}`);
  } else {
    updateWorkspace(target, opts.dryRun);
    if (opts.install && !opts.dryRun) runInstall(target);
    console.log(`\nLLM job tracker workspace ${opts.dryRun ? 'update plan checked' : 'updated'}:\n${target}`);
  }

  console.log(`\nNext steps:\n  1. Review candidate/candidate.md and candidate/cv/cv-base.md.\n  2. Review config/settings.md and strategy/search-profiles/default.md.\n  3. In your LLM tool, run: job:setup\n`);
} catch (err) {
  console.error(`llm-job-tracker: ${err.message}`);
  console.error('');
  usage();
  process.exit(1);
}
