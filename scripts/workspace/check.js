#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkSourceRegistry } from './checks/source-registry.js';
import { loadTrackerSchema, trackerRows } from './checks/tracker.js';
import { checkCompanies } from './checks/companies.js';
import { checkSessionReports } from './checks/sessions.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, '../..');

const urlPattern = /https?:\/\/[^\s\])>]+/g;
const companyLinkPattern = /data\/companies\/([a-z0-9][a-z0-9-]*)\//g;

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function usage() {
  console.log('Usage: node scripts/check-workspace.js [--root <path>]');
}

function parseArgs(argv) {
  let root = defaultRoot;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); process.exit(0); }
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
  if (activeMatch) profileSlugs.add(activeMatch[1]);
  return profileSlugs;
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

function countValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function main() {
  const root = parseArgs(process.argv.slice(2));
  const issues = [];
  const profiles = listedProfiles(root);
  const schema = loadTrackerSchema(root, readText);
  issues.push(...schema.issues);
  issues.push(...checkSourceRegistry(root, readText));
  const { rows, issues: trackerIssues } = trackerRows(root, schema, readText);
  issues.push(...trackerIssues);

  if (!profiles.size) {
    issues.push({ level: 'error', message: 'no profile slugs detected from config/settings.md' });
  }

  issues.push(...checkSessionReports(root, readText));

  const companyNames = [];
  const linkedSlugs = new Set();
  const urls = [];

  for (const row of rows) {
    const company = row.company || '';
    const profile = (row.profile || '').trim();
    const line = row._line || '?';
    const rowUrls = new Set();

    if (company) companyNames.push(company);

    if (!profile) {
      issues.push({ level: 'error', message: `data/tracker.md:${line}: missing Profile value` });
    } else if (!profiles.has(profile)) {
      issues.push({ level: 'error', message: `data/tracker.md:${line}: unknown Profile \`${profile}\`` });
    }

    for (const [key, cell] of Object.entries(row)) {
      if (key.startsWith('_')) continue;
      for (const url of allMatches(cell, urlPattern)) rowUrls.add(url);
      for (const slug of allMatches(cell, companyLinkPattern)) linkedSlugs.add(slug);
    }
    urls.push(...rowUrls);
  }

  for (const [url, count] of [...countValues(urls)].sort(([a], [b]) => a.localeCompare(b))) {
    if (count > 1) {
      issues.push({ level: 'warning', message: `duplicate URL appears ${count} times: ${url}` });
    }
  }

  const trackerSlugs = new Set(companyNames.map(companySlug).filter(Boolean));
  for (const slug of linkedSlugs) trackerSlugs.add(slug);
  issues.push(...checkCompanies(root, trackerSlugs, readText));

  const baseCv = join(root, 'candidate', 'cv', 'cv-base.md');
  if (!existsSync(baseCv)) {
    issues.push({ level: 'error', message: 'candidate/cv/cv-base.md is missing' });
  } else if (statSync(baseCv).size === 0) {
    issues.push({ level: 'error', message: 'candidate/cv/cv-base.md is empty' });
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
    for (const item of messages) console.log(`- ${item.message}`);
  }

  return grouped.has('error') ? 1 : 0;
}

export { main };
