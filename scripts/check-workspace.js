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

const defaultSectionAliases = {
  active: ['Active Pipeline'],
  monitoring: ['Monitoring'],
  staging: ['Staging'],
  raw: ['Raw Pipeline'],
  submitted: ['Submitted / In Process', 'Submitted', 'In Process'],
  archive: ['Archive'],
};

const defaultFieldAliases = {
  company: ['Company'],
  profile: ['Profile'],
  role: ['Role', 'Position'],
  url: ['URL', 'Url', 'Link', 'Links'],
  status: ['Status'],
};

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

function splitMarkdownRow(line) {
  const stripped = line.trim();
  if (!stripped.startsWith('|') || !stripped.endsWith('|')) return null;
  return stripped.slice(1, -1).split('|').map((cell) => cell.trim());
}

function labelsFromCell(cell) {
  const labels = [...String(cell ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
  if (labels.length) return labels;
  return String(cell ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

function cloneAliases(aliases) {
  return Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, [...values]]));
}

function mergeAlias(target, canonical, labels) {
  if (!canonical) return;
  target[canonical] ??= [];
  for (const label of labels) {
    if (label && !target[canonical].some((existing) => existing.toLowerCase() === label.toLowerCase())) {
      target[canonical].push(label);
    }
  }
}

function parseAliasTable(markdown, heading, target) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) return;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith('### ') && index > headingIndex + 1) break;
    const cells = splitMarkdownRow(line);
    if (!cells || cells.length < 2 || isSeparatorRow(cells) || cells[0].toLowerCase() === 'canonical') continue;
    const canonical = labelsFromCell(cells[0])[0] ?? cells[0].trim();
    mergeAlias(target, canonical, cells.slice(1).flatMap(labelsFromCell));
  }
}

function loadTrackerSchema(root) {
  const schema = {
    sections: cloneAliases(defaultSectionAliases),
    fields: cloneAliases(defaultFieldAliases),
    issues: [],
  };
  const schemaPath = join(root, 'config', 'tracker-schema.md');
  if (!existsSync(schemaPath)) {
    schema.issues.push(issue('warning', 'config/tracker-schema.md is missing; run pending migrations or add tracker aliases before relying on tracker CLI checks'));
    return schema;
  }
  const markdown = readText(schemaPath);
  if (!markdown.includes('## CLI Schema Aliases')) {
    schema.issues.push(issue('warning', 'config/tracker-schema.md is missing `## CLI Schema Aliases`; run pending migrations or add tracker aliases'));
    return schema;
  }
  parseAliasTable(markdown, '### Section Aliases', schema.sections);
  parseAliasTable(markdown, '### Field Aliases', schema.fields);
  return schema;
}

function tableRowsAfterHeading(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) return [];
  const rows = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith('## ') && index > headingIndex + 1) break;
    const cells = splitMarkdownRow(line);
    if (!cells || cells.length < 2 || isSeparatorRow(cells) || cells[0].toLowerCase().includes('provider')) continue;
    rows.push(cells);
  }
  return rows;
}

function bulletItemsAfterHeading(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) return [];
  const items = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^#{2,3}\s+/.test(line) && index > headingIndex + 1) break;
    const match = line.match(/^-\s+(.+)$/);
    if (match) items.push(match[1].trim());
  }
  return items;
}

function parseImplementedAtsProviders(scriptText) {
  const explicit = scriptText.match(/implementedProviderIds\s*=\s*\[([\s\S]*?)\]/);
  if (explicit) return [...explicit[1].matchAll(/['"`]([a-z0-9-]+)['"`]/g)].map((item) => item[1]);
  const match = scriptText.match(/const roleMappers = \{([\s\S]*?)\};/)
    ?? scriptText.match(/const mapper = \{([\s\S]*?)\}\[provider\]/);
  if (!match) return [];
  return [...match[1].matchAll(/^\s*([a-z0-9-]+):\s*roleFrom/mg)].map((item) => item[1]);
}

function checkSourceRegistry(root) {
  const issues = [];
  const registryPath = join(root, 'config', 'source-registry.md');
  if (!existsSync(registryPath)) {
    issues.push(issue('error', 'config/source-registry.md is missing; run job-tracker:setup to fill source registry settings before running discovery'));
    return issues;
  }

  const registry = readText(registryPath);
  for (const heading of ['## ATS Probe Providers', '## ATS Probe Search Defaults', '## Browser-Required Sources', '## Source Derivation']) {
    if (!registry.includes(heading)) {
      issues.push(issue('error', `config/source-registry.md is missing \`${heading}\`; run job-tracker:setup to fill source registry settings`));
    }
  }

  const providerRows = tableRowsAfterHeading(registry, '## ATS Probe Providers');
  const registryProviders = providerRows
    .map((cells) => labelsFromCell(cells[0])[0])
    .filter(Boolean)
    .sort();
  for (const cells of providerRows) {
    const provider = labelsFromCell(cells[0])[0];
    const feed = labelsFromCell(cells[3])[0] ?? cells[3] ?? '';
    if (provider && !feed.includes('[slug]')) {
      issues.push(issue('error', `config/source-registry.md ATS provider \`${provider}\` must define a Discovery feed containing [slug]; run job-tracker:setup to fill source registry settings`));
    }
  }
  for (const heading of ['### Keywords', '### Locations']) {
    if (!bulletItemsAfterHeading(registry, heading).length) {
      issues.push(issue('error', `config/source-registry.md is missing list items under \`${heading}\`; run job-tracker:setup to fill source registry settings`));
    }
  }
  const atsScript = readText(join(root, 'scripts', 'ats-probe.js'));
  const scriptProviders = parseImplementedAtsProviders(atsScript).sort();

  if (!scriptProviders.length) {
    issues.push(issue('warning', 'scripts/ats-probe.js provider normalizers could not be detected; cannot compare ATS provider registry'));
  } else if (registryProviders.join(',') !== scriptProviders.join(',')) {
    issues.push(issue('error', `config/source-registry.md ATS providers (${registryProviders.join(', ') || 'none'}) do not match scripts/ats-probe.js implemented providers (${scriptProviders.join(', ')}); run job-tracker:setup to review source registry settings`));
  }

  const hasDjinniBrowser = tableRowsAfterHeading(registry, '## Browser-Required Sources')
    .some((cells) => labelsFromCell(cells[0]).includes('djinni') || cells.join(' ').toLowerCase().includes('djinni.co'));
  const hasDjinniDerivation = tableRowsAfterHeading(registry, '## Source Derivation')
    .some((cells) => cells.join(' ').toLowerCase().includes('djinni'));
  if (!hasDjinniBrowser || !hasDjinniDerivation) {
    issues.push(issue('error', 'config/source-registry.md must define Djinni as browser-required and include `djinni.co` source derivation; run job-tracker:setup to review source registry settings'));
  }

  const browserRows = tableRowsAfterHeading(registry, '## Browser-Required Sources');
  for (const source of ['linkedin', 'djinni']) {
    const row = browserRows.find((cells) => labelsFromCell(cells[0]).includes(source));
    const policy = row?.join(' ').toLowerCase() ?? '';
    if (!row || !policy.includes('playwright') || !policy.includes('user') || !policy.includes('account') || !policy.includes('session')) {
      issues.push(issue('error', `config/source-registry.md must require Playwright MCP with the user's logged-in account/session for \`${source}\`; run job-tracker:setup to review source registry settings`));
    }
    if (policy.includes('web search as a substitute') && !policy.includes('never use')) {
      issues.push(issue('warning', `config/source-registry.md should explicitly forbid web-search/API substitutes for \`${source}\``));
    }
  }

  return issues;
}

function canonicalField(name, schema) {
  const normalized = String(name ?? '').trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(schema.fields)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalized)) return canonical;
  }
  return normalized;
}

function trackerRows(root, schema) {
  const tracker = join(root, 'data', 'tracker.md');
  const issues = [];
  const rows = [];

  if (!existsSync(tracker)) {
    return { rows, issues: [issue('error', 'data/tracker.md is missing')] };
  }

  let currentHeader = null;
  let currentCanonicalHeader = null;
  readText(tracker).split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    const cells = splitMarkdownRow(line);
    if (!cells) return;
    if (!cells.length || isSeparatorRow(cells)) return;

    const canonical = cells.map((cell) => canonicalField(cell, schema));
    if (canonical.includes('profile') && !canonical.includes('company')) {
      issues.push(issue('error', `data/tracker.md:${lineNo}: table has a configured Profile column but no configured Company column; add the company header label to config/tracker-schema.md`));
    }
    if (canonical.includes('company') && !canonical.includes('profile')) {
      issues.push(issue('error', `data/tracker.md:${lineNo}: table has a configured Company column but no configured Profile column; add the profile header label to config/tracker-schema.md`));
    }
    if (canonical.includes('profile') && canonical.includes('company')) {
      currentHeader = cells;
      currentCanonicalHeader = canonical;
      const companyIdx = canonical.indexOf('company');
      const profileIdx = canonical.indexOf('profile');
      if (companyIdx !== -1 && profileIdx !== companyIdx + 1) {
        issues.push(issue('warning', `data/tracker.md:${lineNo}: Profile column should be immediately after Company`));
      }
      return;
    }

    if (currentHeader && currentCanonicalHeader && cells.length === currentHeader.length) {
      const row = Object.fromEntries(currentHeader.map((header, cellIndex) => [header, cells[cellIndex]]));
      for (let cellIndex = 0; cellIndex < currentCanonicalHeader.length; cellIndex += 1) {
        const canonicalName = currentCanonicalHeader[cellIndex];
        if (!row[canonicalName]) row[canonicalName] = cells[cellIndex];
      }
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

    const sessionFilenameMatch = name.match(/^(\d{4}-\d{2}-\d{2}T\d{6})\.[a-z][a-z0-9-]*\.md$/);
    if (!sessionFilenameMatch) {
      issues.push(issue('warning', `${rel}: Session Report filename should be [id].<skill>.md`));
      continue;
    }

    const reportId = sessionFilenameMatch[1];
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
      // Only run reports are resumable; a blocked import report is a login-required snapshot,
      // not an unfinished run. Warn only for job-tracker:run reports.
      const isRunReport = name.endsWith('.run.md') || text.includes('Skill: job-tracker:run');
      if (isRunReport) {
        issues.push(issue('warning', `${rel}: unfinished Session Report status \`${statusMatch[1]}\``));
      }
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
  const schema = loadTrackerSchema(root);
  issues.push(...schema.issues);
  issues.push(...checkSourceRegistry(root));
  const { rows, issues: trackerIssues } = trackerRows(root, schema);
  issues.push(...trackerIssues);

  if (!profiles.size) {
    issues.push(issue('error', 'no profile slugs detected from config/settings.md'));
  }

  issues.push(...checkSessionReports(root));

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
      issues.push(issue('error', `data/tracker.md:${line}: missing Profile value`));
    } else if (!profiles.has(profile)) {
      issues.push(issue('error', `data/tracker.md:${line}: unknown Profile \`${profile}\``));
    }

    for (const [key, cell] of Object.entries(row)) {
      if (key.startsWith('_')) continue;
      for (const url of allMatches(cell, urlPattern)) rowUrls.add(url);
      for (const slug of allMatches(cell, companyLinkPattern)) {
        linkedSlugs.add(slug);
      }
    }
    urls.push(...rowUrls);
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
