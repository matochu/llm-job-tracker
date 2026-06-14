#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, '..');

const forbiddenPaths = [
  '.claude',
  '.codex',
  '.sessions',
  '.playwright-mcp',
  'tmp',
  'cv.md',
  'cv.pdf',
  'template',
  'job-search',
  'versions',
  'tracker.md',
  'companies',
];

const requiredFiles = [
  'data/tracker.md',
  'candidate/candidate.md',
  'candidate/cv/cv-base.md',
  'strategy/search-profiles/default.md',
];

const genericPrivatePattern = /ATATT|JIRA_API_TOKEN|CONFLUENCE_API_TOKEN|Documents\/Claude\/Projects\/Resume|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+[0-9][0-9 ()-]{7,}/i;
const stalePathPattern = /job-search\/|versions\/|\]\(companies\/|\]\(tracker\.md\)/i;
const excludedDirs = new Set(['.git', 'node_modules']);
const forbiddenDirNames = new Set(['__pycache__']);
const excludedFiles = new Set(['package-lock.json', 'check-public.js']);

function usage() {
  console.log('Usage: node scripts/check-public.js [--root <path>]');
}

function parseArgs(argv) {
  let root = defaultRoot;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--root') {
      const value = argv[i + 1];
      if (!value) throw new Error('--root requires a path');
      root = resolve(value);
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return root;
}

function fail(message, matches = []) {
  for (const match of matches) {
    console.error(match);
  }
  console.error(`check-public: ${message}`);
  process.exit(1);
}

// Build the set of paths git would publish: tracked files plus untracked files
// that are not gitignored. Returns null when not in a git repo (e.g. an
// extracted package), in which case callers fall back to scanning the whole tree.
// This makes check-public ignore local-only, gitignored artifacts such as
// `.claude/`, `.sessions/`, and `data/network/*` that never reach a commit.
function gitVisibleSet(root) {
  try {
    const out = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard'],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const set = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (line) set.add(resolve(root, line));
    }
    return set;
  } catch {
    return null;
  }
}

function hasVisibleUnder(absPath, visibleSet) {
  const prefix = absPath.endsWith('/') ? absPath : `${absPath}/`;
  for (const visible of visibleSet) {
    if (visible === absPath || visible.startsWith(prefix)) return true;
  }
  return false;
}

function walkFiles(root, dir = root, files = [], visibleSet = null) {
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;

    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (forbiddenDirNames.has(entry.name)) {
        if (!visibleSet || hasVisibleUnder(path, visibleSet)) files.push(path);
        continue;
      }
      walkFiles(root, path, files, visibleSet);
    } else if (entry.isFile() && !excludedFiles.has(entry.name)) {
      if (!visibleSet || visibleSet.has(path)) files.push(path);
    }
  }

  return files;
}

function scanFiles(root, pattern, visibleSet = null) {
  const matches = [];

  for (const path of walkFiles(root, root, [], visibleSet)) {
    let text;
    try {
      text = readFileSync(path, 'utf8');
    } catch {
      continue;
    }

    text.split(/\r?\n/).forEach((line, index) => {
      if (pattern.test(line)) {
        const rel = relative(root, path) || path;
        matches.push(`${rel}:${index + 1}:${line}`);
      }
    });
  }

  return matches;
}

function hasLiveCompanyArtifacts(root, visibleSet) {
  const companiesDir = join(root, 'data', 'companies');
  if (!existsSync(companiesDir)) return false;
  return walkFiles(root, companiesDir, [], visibleSet).some((path) => basename(path) !== '.gitkeep');
}

function hasExtraCandidateCv(root) {
  const cvDir = join(root, 'candidate', 'cv');
  if (!existsSync(cvDir)) return false;
  return readdirSync(cvDir).some((entry) => entry !== 'cv-base.md');
}

function readLocalPatterns(root) {
  const file = join(root, '.public-scan-patterns.local');
  if (!existsSync(file)) return [];

  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => new RegExp(line, 'i'));
}

function main() {
  const root = parseArgs(process.argv.slice(2));
  const visibleSet = gitVisibleSet(root);

  for (const path of forbiddenPaths) {
    const abs = join(root, path);
    const present = visibleSet ? hasVisibleUnder(abs, visibleSet) : existsSync(abs);
    if (present) {
      fail(`forbidden public path exists: ${path}`);
    }
  }

  const exportReview = join(root, 'EXPORT_REVIEW.md');
  if (visibleSet ? visibleSet.has(exportReview) : existsSync(exportReview)) {
    fail('EXPORT_REVIEW.md must not be published');
  }

  const forbiddenGeneratedDirs = walkFiles(root, root, [], visibleSet).filter((path) => path.endsWith('/__pycache__'));
  if (forbiddenGeneratedDirs.length) {
    fail('generated Python cache directory found', forbiddenGeneratedDirs.map((path) => relative(root, path)));
  }

  for (const path of requiredFiles) {
    if (!existsSync(join(root, path))) {
      fail(`${path} is missing`);
    }
  }

  if (hasLiveCompanyArtifacts(root, visibleSet)) {
    fail('data/companies must not contain live company artifacts');
  }

  if (hasExtraCandidateCv(root)) {
    fail('candidate/cv must contain only cv-base.md');
  }

  let matches = scanFiles(root, genericPrivatePattern, visibleSet);
  if (matches.length) {
    fail('private marker found', matches);
  }

  for (const pattern of readLocalPatterns(root)) {
    matches = scanFiles(root, pattern, visibleSet);
    if (matches.length) {
      fail('local private marker found', matches);
    }
  }

  matches = scanFiles(root, stalePathPattern, visibleSet);
  if (matches.length) {
    fail('stale architecture path found', matches);
  }

  console.log('check-public: ok');
}

try {
  main();
} catch (err) {
  fail(err.message);
}
