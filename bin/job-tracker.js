#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

const workspaceEntries = [
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
const excludedScriptEntries = new Set(['check-public.js']);

function usage() {
  console.log(`Usage:
  npx llm-job-tracker <target-dir> [--no-install] [--force]

Options:
  --no-install  Copy the workspace template without running node scripts/install.js all
  --force       Allow using a non-empty target directory
  --help        Show this help
`);
}

function parseArgs(argv) {
  const opts = {
    target: null,
    install: true,
    force: false,
  };

  for (const arg of argv) {
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
    if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    }
    if (opts.target) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    opts.target = arg;
  }

  if (!opts.target) {
    throw new Error('Target directory is required.');
  }

  return opts;
}

function isEmptyDir(path) {
  return existsSync(path) && statSync(path).isDirectory() && readdirSync(path).length === 0;
}

function ensureTarget(path, force) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
    return;
  }
  if (!statSync(path).isDirectory()) {
    throw new Error(`Target exists and is not a directory: ${path}`);
  }
  if (!force && !isEmptyDir(path)) {
    throw new Error(`Target directory is not empty: ${path}
Use --force to copy into it.`);
  }
}

function runInstall(target) {
  const result = spawnSync(process.execPath, ['scripts/install.js', 'all'], {
    cwd: target,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`node scripts/install.js all failed with exit code ${result.status}`);
  }
}

function copyWorkspace(target, force) {
  let copiedGitignore = false;

  for (const entry of workspaceEntries) {
    const src = resolve(repoRoot, entry);
    if (!existsSync(src)) continue;

    if (entry === 'scripts') {
      mkdirSync(resolve(target, 'scripts'), { recursive: true });
      for (const scriptEntry of readdirSync(src)) {
        if (excludedScriptEntries.has(scriptEntry)) continue;
        cpSync(resolve(src, scriptEntry), resolve(target, 'scripts', scriptEntry), {
          recursive: true,
          force,
          errorOnExist: !force,
        });
      }
      continue;
    }

    cpSync(src, resolve(target, entry), {
      recursive: true,
      force,
      errorOnExist: !force,
    });
    if (entry === '.gitignore') {
      copiedGitignore = true;
    }
  }

  if (!copiedGitignore && !existsSync(resolve(target, '.gitignore'))) {
    writeFileSync(resolve(target, '.gitignore'), defaultGitignore);
  }

  mkdirSync(resolve(target, 'data', 'companies'), { recursive: true });
  mkdirSync(resolve(target, 'candidate', 'cv'), { recursive: true });
  mkdirSync(resolve(target, 'strategy', 'search-profiles'), { recursive: true });
}

try {
  const opts = parseArgs(process.argv.slice(2));
  const target = resolve(process.cwd(), opts.target);

  ensureTarget(target, opts.force);
  copyWorkspace(target, opts.force);

  if (opts.install) {
    runInstall(target);
  }

  console.log(`
LLM job tracker workspace created:
${target}

Next steps:
  1. Fill candidate/candidate.md with real candidate facts.
  2. Put the base CV in candidate/cv/cv-base.md.
  3. Review config/settings.md and strategy/search-profiles/default.md.
  4. In your LLM tool, run: job:setup
`);
} catch (err) {
  console.error(`llm-job-tracker: ${err.message}`);
  console.error('');
  usage();
  process.exit(1);
}
