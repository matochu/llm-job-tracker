#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, '..');

const companyDirsIgnore = new Set();
const companyHealthIgnoreFile = '.health-ignore';
const urlPattern = /https?:\/\/[^\s\])>]+/g;
const companyLinkPattern = /data\/companies\/([a-z0-9][a-z0-9-]*)\//g;
const sessionIdPattern = /^\d{4}-\d{2}-\d{2}T\d{6}$/;
const sessionStatusPattern = /^- Status:\s*(running|blocked|done|abandoned)\s*$/m;
const sessionRequiredSections = [
  '## Goal',
  '## Plan',
  '## Progress',
  '## Decisions',
  '## Blockers',
  '## Resume Point',
  '## Tracker Updates',
  '## Files Changed',
  '## Artifacts',
  '## Agent Insights',
  '## Summary',
];

function usage() {
  console.log('Usage: node scripts/check-workspace.js [--root <path>]');
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

function issue(level, message) {
  return { level, message };
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function listMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => join(dir, entry))
    .sort();
}

function fileSize(path) {
  return statSync(path).size;
}

function listedProfiles(root) {
  const settings = readText(join(root, 'config', 'settings.md'));
  const profileSlugs = new Set();

  for (const match of settings.matchAll(/`([a-z0-9][a-z0-9-]*)`/g)) {
    const slug = match[1];
    if (existsSync(join(root, 'strategy', 'search-profiles', `${slug}.md`))) {
      profileSlugs.add(slug);
    }
  }

  const activeMatch = settings.match(/active profile\s*[:=]\s*`?([a-z0-9][a-z0-9-]*)`?/i);
  if (activeMatch) {
    profileSlugs.add(activeMatch[1]);
  }

  return profileSlugs;
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(' ', '')));
}

function trackerRows(root) {
  const tracker = join(root, 'data', 'tracker.md');
  const issues = [];
  const rows = [];

  if (!existsSync(tracker)) {
    return { rows, issues: [issue('error', 'data/tracker.md is missing')] };
  }

  let currentHeader = null;
  readText(tracker).split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    const stripped = line.trim();
    if (!stripped.startsWith('|') || !stripped.endsWith('|')) return;

    const cells = stripped.slice(1, -1).split('|').map((cell) => cell.trim());
    if (!cells.length || isSeparatorRow(cells)) return;

    const lowered = cells.map((cell) => cell.toLowerCase());
    if (lowered.includes('profile') && cells.some((cell) => ['company', 'компанія'].includes(cell.toLowerCase()))) {
      currentHeader = cells;
      const companyIdx = lowered.findIndex((cell) => ['company', 'компанія'].includes(cell));
      const profileIdx = lowered.indexOf('profile');
      if (companyIdx !== -1 && profileIdx !== companyIdx + 1) {
        issues.push(issue('warning', `data/tracker.md:${lineNo}: Profile column should be immediately after Company/Компанія`));
      }
      return;
    }

    if (currentHeader && cells.length === currentHeader.length) {
      const row = Object.fromEntries(currentHeader.map((header, cellIndex) => [header, cells[cellIndex]]));
      row._line = String(lineNo);
      rows.push(row);
    }
  });

  return { rows, issues };
}

function companySlug(value) {
  return value
    .replace(/\[[^\]]+\]\(([^)]+)\)/g, '$1')
    .replace(/https?:\/\//g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function allMatches(text, pattern) {
  return [...text.matchAll(pattern)].map((match) => match[1] ?? match[0]);
}

function checkSessionReports(root) {
  const issues = [];
  const gitignore = readText(join(root, '.gitignore'));

  if (!gitignore.includes('.sessions/')) {
    issues.push(issue('error', '.sessions/ is not gitignored'));
  }

  const sessionsDir = join(root, '.sessions');
  const reportsDir = join(sessionsDir, 'reports');
  if (!existsSync(sessionsDir)) return issues;

  if (!existsSync(reportsDir)) {
    issues.push(issue('warning', '.sessions/ exists but .sessions/reports/ is missing'));
    return issues;
  }

  for (const report of listMarkdownFiles(reportsDir)) {
    const rel = relative(root, report);
    const name = basename(report);

    if (!name.endsWith('.run.md')) {
      issues.push(issue('warning', `${rel}: Session Report filename should be [id].run.md`));
      continue;
    }

    const reportId = name.slice(0, -'.run.md'.length);
    if (!sessionIdPattern.test(reportId)) {
      issues.push(issue('warning', `${rel}: Session Report ID should use YYYY-MM-DDTHHMMSS`));
    }

    const text = readText(report);
    if (!text.includes(`- ID: ${reportId}`)) {
      issues.push(issue('warning', `${rel}: ID field does not match filename`));
    }

    const statusMatch = text.match(sessionStatusPattern);
    if (!statusMatch) {
      issues.push(issue('warning', `${rel}: missing or invalid Status`));
    } else if (['running', 'blocked'].includes(statusMatch[1])) {
      issues.push(issue('warning', `${rel}: unfinished Session Report status \`${statusMatch[1]}\``));
    }

    for (const section of sessionRequiredSections) {
      if (!text.includes(section)) {
        issues.push(issue('warning', `${rel}: missing required section \`${section}\``));
      }
    }
  }

  return issues;
}

function countValues(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function checkCompanies(root, trackerSlugs) {
  const issues = [];
  const companiesDir = join(root, 'data', 'companies');

  if (!existsSync(companiesDir)) {
    issues.push(issue('error', 'data/companies/ directory is missing'));
    return issues;
  }

  for (const entry of readdirSync(companiesDir, { withFileTypes: true }).filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const slug = entry.name;
    const companyDir = join(companiesDir, slug);
    if (companyDirsIgnore.has(slug)) continue;
    if (existsSync(join(companyDir, companyHealthIgnoreFile))) continue;

    const prep = join(companyDir, 'prep-notes.md');
    const resume = join(companyDir, 'resume.md');
    const pdfs = readdirSync(companyDir).filter((name) => name.endsWith('.pdf'));

    if (!trackerSlugs.has(slug)) {
      issues.push(issue('warning', `data/companies/${slug}/ exists but no matching tracker company slug was detected`));
    }
    if (!existsSync(prep)) {
      issues.push(issue('warning', `data/companies/${slug}/prep-notes.md is missing`));
    }
    if (pdfs.length && !existsSync(resume)) {
      issues.push(issue('warning', `data/companies/${slug}/ has PDF output but no resume.md`));
    }
    if (existsSync(resume) && fileSize(resume) === 0) {
      issues.push(issue('error', `data/companies/${slug}/resume.md is empty`));
    }
    if (existsSync(prep)) {
      const prepText = readText(prep);
      const hasDraftStatus = /manual message drafts?.*(prepared|ready)/i.test(prepText);
      if (hasDraftStatus && !prepText.includes('### Manual Message Drafts')) {
        issues.push(issue('warning', `data/companies/${slug}/prep-notes.md claims manual drafts are prepared but section is missing`));
      }
    }
  }

  return issues;
}

function main() {
  const root = parseArgs(process.argv.slice(2));
  const issues = [];
  const profiles = listedProfiles(root);
  const { rows, issues: trackerIssues } = trackerRows(root);
  issues.push(...trackerIssues);

  if (!profiles.size) {
    issues.push(issue('error', 'no profile slugs detected from config/settings.md'));
  }

  issues.push(...checkSessionReports(root));

  const companyNames = [];
  const linkedSlugs = new Set();
  const urls = [];

  for (const row of rows) {
    const company = row.Company || row['Компанія'] || '';
    const profile = (row.Profile || '').trim();
    const line = row._line || '?';

    if (company) companyNames.push(company);

    if (!profile) {
      issues.push(issue('error', `data/tracker.md:${line}: missing Profile value`));
    } else if (!profiles.has(profile)) {
      issues.push(issue('error', `data/tracker.md:${line}: unknown Profile \`${profile}\``));
    }

    for (const [key, cell] of Object.entries(row)) {
      if (key.startsWith('_')) continue;
      urls.push(...allMatches(cell, urlPattern));
      for (const slug of allMatches(cell, companyLinkPattern)) {
        linkedSlugs.add(slug);
      }
    }
  }

  for (const [url, count] of [...countValues(urls)].sort(([a], [b]) => a.localeCompare(b))) {
    if (count > 1) {
      issues.push(issue('warning', `duplicate URL appears ${count} times: ${url}`));
    }
  }

  const trackerSlugs = new Set(companyNames.map(companySlug).filter(Boolean));
  for (const slug of linkedSlugs) trackerSlugs.add(slug);
  issues.push(...checkCompanies(root, trackerSlugs));

  const baseCv = join(root, 'candidate', 'cv', 'cv-base.md');
  if (!existsSync(baseCv)) {
    issues.push(issue('error', 'candidate/cv/cv-base.md is missing'));
  } else if (fileSize(baseCv) === 0) {
    issues.push(issue('error', 'candidate/cv/cv-base.md is empty'));
  }

  const grouped = Map.groupBy(issues, (item) => item.level);

  console.log('Workspace health check');
  if (!issues.length) {
    console.log('✓ No workspace integrity issues detected');
    return 0;
  }

  for (const level of ['error', 'warning']) {
    const messages = grouped.get(level) ?? [];
    if (!messages.length) continue;
    console.log(`\n${level.toUpperCase()} (${messages.length})`);
    for (const item of messages) {
      console.log(`- ${item.message}`);
    }
  }

  return grouped.has('error') ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (err) {
  console.error(`check-workspace: ${err.message}`);
  process.exitCode = 1;
}
