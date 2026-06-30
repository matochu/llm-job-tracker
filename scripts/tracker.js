#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sectionAliases = {
  active: ['Active Pipeline'],
  monitoring: ['Monitoring'],
  staging: ['Staging'],
  raw: ['Raw Pipeline'],
  submitted: ['Submitted / In Process', 'Submitted', 'In Process'],
  archive: ['Archive'],
};

const fieldAliases = {
  company: ['Company'],
  profile: ['Profile'],
  role: ['Role', 'Position'],
  url: ['URL', 'Url', 'Link', 'Links'],
  location: ['Location'],
  fit: ['Fit'],
  priority: ['Pri', 'Priority'],
  status: ['Status'],
  contact: ['Contact / Channel', 'Contact', 'Channel'],
  updated: ['Updated', 'Checked'],
  added: ['Added'],
  checked: ['Checked'],
  source: ['Source'],
  notes: ['Notes', 'Note'],
  detail: ['Detail', 'Details'],
  date: ['Date'],
  next: ['Next', 'Next Step'],
};

let schemaCache = null;
let schemaRoot = process.cwd();

function cloneAliases(aliases) {
  return Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, [...values]]));
}

function labelsFromCell(cell) {
  const labels = [...String(cell ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
  if (labels.length) return labels;
  return String(cell ?? '').split(',').map((item) => item.trim()).filter(Boolean);
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
    const cells = splitRow(line);
    if (!cells || cells.length < 2 || isSeparator(cells) || cells[0].toLowerCase() === 'canonical') continue;
    const canonical = labelsFromCell(cells[0])[0] ?? cells[0].trim();
    mergeAlias(target, canonical, cells.slice(1).flatMap(labelsFromCell));
  }
}

function loadSchemaAliases() {
  if (schemaCache) return schemaCache;
  const schema = {
    sections: cloneAliases(sectionAliases),
    fields: cloneAliases(fieldAliases),
  };
  const schemaPath = resolve(schemaRoot, 'config', 'tracker-schema.md');
  if (existsSync(schemaPath)) {
    const markdown = readFileSync(schemaPath, 'utf8');
    parseAliasTable(markdown, '### Section Aliases', schema.sections);
    parseAliasTable(markdown, '### Field Aliases', schema.fields);
  }
  schemaCache = schema;
  return schema;
}

export function setSchemaRootFromTracker(trackerPath) {
  const fullPath = resolve(trackerPath);
  schemaRoot = dirname(dirname(fullPath));
  schemaCache = null;
}

function usage() {
  console.log(`Usage:
  node scripts/tracker.js list --section raw [--tracker data/tracker.md]
  node scripts/tracker.js validate [--tracker data/tracker.md] [--json]
  node scripts/tracker.js add-lead --company ... --profile ... --role ... --url ... --source ... --date YYYY-MM-DD
  node scripts/tracker.js move --company ... --role ... --from raw --to archive --date YYYY-MM-DD --reason ...
  node scripts/tracker.js set-status --company ... --role ... --status ... --date YYYY-MM-DD
  node scripts/tracker.js bump-date --company ... --role ... --field Added|Checked|Updated --date YYYY-MM-DD

Options:
  --dry-run  Print the updated tracker instead of writing it.
  --json     Print JSON for list/validate.
  --strict   Make validate warnings exit non-zero.
`);
}

function parseArgs(argv) {
  if (argv[0] === '--help' || argv[0] === '-h') {
    usage();
    process.exit(0);
  }
  const opts = { command: argv[0], tracker: 'data/tracker.md' };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--dry-run' || arg === '--json' || arg === '--strict') {
      opts[arg === '--dry-run' ? 'dryRun' : arg.slice(2)] = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (!value) throw new Error(`${arg} requires a value`);
    opts[arg.slice(2)] = value;
    i += 1;
  }
  if (!opts.command) throw new Error('command is required');
  return opts;
}

function splitRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null;
  return trimmed.slice(1, -1).split('|').map((cell) => cell.trim());
}

function isSeparator(cells) {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(' ', '')));
}

function rowLine(cells) {
  return `| ${cells.join(' | ')} |`;
}

function normalizeHeading(line) {
  return line.replace(/^#+\s*/, '').replace(/[^\p{L}\p{N}/ ]+/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function wantedSectionNames(section) {
  const schema = loadSchemaAliases();
  return schema.sections[section]?.map((name) => name.toLowerCase()) ?? [section.toLowerCase()];
}

function sectionMatches(line, section) {
  if (!line.trim().startsWith('#')) return false;
  const heading = normalizeHeading(line);
  return wantedSectionNames(section).some((name) => heading.includes(name.toLowerCase()));
}

function parseTables(markdown) {
  const lines = markdown.split(/\r?\n/);
  const tables = [];
  let currentSection = '';
  let sectionStart = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith('#')) {
      currentSection = line;
      sectionStart = index;
    }
    const header = splitRow(line);
    const separator = splitRow(lines[index + 1] ?? '');
    if (!header || !separator || !isSeparator(separator)) continue;
    const lowered = header.map(canonicalField);
    if (!lowered.includes('company')) continue;
    const rows = [];
    let cursor = index + 2;
    while (cursor < lines.length) {
      const cells = splitRow(lines[cursor]);
      if (!cells || cells.length !== header.length || isSeparator(cells)) break;
      rows.push({ lineIndex: cursor, cells, data: Object.fromEntries(header.map((key, cellIndex) => [key, cells[cellIndex]])) });
      cursor += 1;
    }
    tables.push({
      section: currentSection,
      sectionStart,
      headerLine: index,
      separatorLine: index + 1,
      endLine: cursor,
      header,
      rows,
    });
    index = cursor - 1;
  }
  return { lines, tables };
}

function findTable(parsed, section) {
  const table = parsed.tables.find((candidate) => sectionMatches(candidate.section, section));
  if (!table) throw new Error(`Section table not found: ${section}`);
  return table;
}

function canonicalField(name) {
  const normalized = String(name ?? '').trim().toLowerCase();
  const schema = loadSchemaAliases();
  for (const [canonical, aliases] of Object.entries(schema.fields)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalized)) return canonical;
  }
  return normalized;
}

function headerIndex(table, canonical) {
  return table.header.findIndex((header) => canonicalField(header) === canonical);
}

function cell(row, names) {
  const wanted = names.map(canonicalField);
  for (const [key, value] of Object.entries(row.data)) {
    if (wanted.includes(canonicalField(key))) return value;
  }
  return '';
}

function plain(value) {
  return stripMarkdownInline(value)
    .replace(/https?:\/\//g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function stripMarkdownInline(value) {
  return String(value ?? '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 $2')
    .replace(/[*_~`]+/g, '')
    .trim();
}

function extractPrimaryUrl(value) {
  const raw = String(value ?? '');
  const markdownLink = raw.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownLink) return markdownLink[1];
  const bare = raw.match(/https?:\/\/[^\s)<>,|]+/i);
  return bare ? bare[0] : raw.trim();
}

function normalizeUrl(value) {
  const raw = extractPrimaryUrl(value);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|gh_src$|rl$)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return raw.replace(/\/$/, '');
  }
}

function findRows(parsed, opts, section = '') {
  const tables = section ? [findTable(parsed, section)] : parsed.tables;
  const matches = [];
  for (const table of tables) {
    for (const row of table.rows) {
      const urlMatch = opts.url ? normalizeUrl(cell(row, ['url'])) === normalizeUrl(opts.url) : true;
      const companyMatch = opts.company ? plain(cell(row, ['company'])) === plain(opts.company) : true;
      const roleMatch = opts.role ? plain(cell(row, ['role'])) === plain(opts.role) : true;
      if (urlMatch && companyMatch && roleMatch) matches.push({ table, row });
    }
  }
  return matches;
}

function requireSingleMatch(parsed, opts, section = '') {
  const matches = findRows(parsed, opts, section);
  if (matches.length !== 1) {
    const selector = opts.url ? `url ${opts.url}` : `${opts.company ?? '*'} / ${opts.role ?? '*'}`;
    throw new Error(`Expected exactly one matching row for ${selector}; found ${matches.length}`);
  }
  return matches[0];
}

function setCell(lines, table, row, name, value) {
  const index = headerIndex(table, canonicalField(name));
  if (index === -1) return false;
  row.cells[index] = value;
  lines[row.lineIndex] = rowLine(row.cells);
  return true;
}

function insertIntoTable(lines, table, cells) {
  lines.splice(table.endLine, 0, rowLine(cells));
}

function removeRow(lines, row) {
  lines.splice(row.lineIndex, 1);
}

function rowForHeader(header, values) {
  return header.map((name) => {
    const canonical = canonicalField(name);
    if (canonical === 'company') return values.company ?? '';
    if (canonical === 'profile') return values.profile ?? '';
    if (canonical === 'role') return values.role ?? '';
    if (canonical === 'url') return values.url ?? '';
    if (canonical === 'added') return values.date ?? values.added ?? '';
    if (canonical === 'checked' || canonical === 'updated') return values.date ?? '';
    if (canonical === 'status') return values.status ?? '⬜';
    if (canonical === 'source') return values.source ?? '';
    if (canonical === 'notes' || canonical === 'detail') return values.reason ?? '';
    return '';
  });
}

function rowValueByCanonical(table, row, canonical) {
  const index = headerIndex(table, canonical);
  return index === -1 ? '' : row.cells[index] ?? '';
}

function rowObjectByCanonical(table, row) {
  const data = {};
  table.header.forEach((header, index) => {
    data[canonicalField(header)] = row.cells[index] ?? '';
  });
  return data;
}

function moveCellsForHeader(fromTable, row, toTable, values) {
  const source = rowObjectByCanonical(fromTable, row);
  const used = new Set();
  const next = toTable.header.map((header) => {
    const canonical = canonicalField(header);
    used.add(canonical);
    if (canonical === 'status' && values.reason) return `${values.date}: ${values.reason}`;
    if ((canonical === 'updated' || canonical === 'checked' || canonical === 'date') && values.date) {
      return source[canonical] || values.date;
    }
    if (source[canonical] != null) return source[canonical];
    if (canonical === 'detail' || canonical === 'notes') return values.reason ?? '';
    return '';
  });

  const leftovers = fromTable.header
    .map((header, index) => ({ header, canonical: canonicalField(header), value: row.cells[index] ?? '' }))
    .filter((item) => item.value && !used.has(item.canonical) && !['company', 'profile', 'role'].includes(item.canonical));
  if (leftovers.length) {
    const detailIndex = toTable.header.findIndex((header) => ['detail', 'notes'].includes(canonicalField(header)));
    if (detailIndex === -1) {
      throw new Error(`Destination section ${toTable.section} cannot preserve columns: ${leftovers.map((item) => item.header).join(', ')}`);
    }
    const suffix = leftovers.map((item) => `${item.header}: ${item.value}`).join('; ');
    next[detailIndex] = [next[detailIndex], suffix].filter(Boolean).join('; ');
  }

  return next;
}

export function listRows(markdown, section) {
  const parsed = parseTables(markdown);
  return findTable(parsed, section).rows.map((row) => row.data);
}

export function validateTracker(markdown) {
  const parsed = parseTables(markdown);
  const issues = [];
  const allUrls = new Map();

  for (const table of parsed.tables) {
    const lowered = table.header.map(canonicalField);
    const companyIndex = lowered.indexOf('company');
    const profileIndex = lowered.indexOf('profile');
    if (companyIndex !== -1 && profileIndex !== companyIndex + 1) {
      issues.push({
        level: 'error',
        line: table.headerLine + 1,
        message: 'Profile column should be immediately after Company',
      });
    }
    if (companyIndex === -1) {
      issues.push({ level: 'error', line: table.headerLine + 1, message: 'Missing Company column' });
    }
    if (profileIndex === -1) {
      issues.push({ level: 'error', line: table.headerLine + 1, message: 'Missing Profile column' });
    }
    for (const row of table.rows) {
      const url = normalizeUrl(cell(row, ['url']));
      if (!url) continue;
      if (allUrls.has(url)) {
        issues.push({
          level: 'warning',
          line: row.lineIndex + 1,
          message: `Duplicate URL also appears on line ${allUrls.get(url)}: ${url}`,
        });
      } else {
        allUrls.set(url, row.lineIndex + 1);
      }
    }
  }

  return {
    ok: !issues.some((item) => item.level === 'error'),
    tables: parsed.tables.length,
    rows: parsed.tables.reduce((sum, table) => sum + table.rows.length, 0),
    issues,
  };
}

export function addLead(markdown, values) {
  for (const required of ['company', 'profile', 'role', 'url', 'source', 'date']) {
    if (!values[required]) throw new Error(`--${required} is required`);
  }
  const parsed = parseTables(markdown);
  const existing = findRows(parsed, { url: values.url }, values.section ?? '');
  if (existing.length) throw new Error(`Tracker already contains URL: ${values.url}`);
  const table = findTable(parsed, 'raw');
  insertIntoTable(parsed.lines, table, rowForHeader(table.header, { ...values, status: values.status ?? '⬜' }));
  return parsed.lines.join('\n');
}

export function moveRow(markdown, values) {
  for (const required of ['from', 'to', 'date']) {
    if (!values[required]) throw new Error(`--${required} is required`);
  }
  const parsed = parseTables(markdown);
  const match = requireSingleMatch(parsed, values, values.from);
  const toTable = findTable(parsed, values.to);
  const moved = moveCellsForHeader(match.table, match.row, toTable, values);
  removeRow(parsed.lines, match.row);
  const reparsed = parseTables(parsed.lines.join('\n'));
  insertIntoTable(reparsed.lines, findTable(reparsed, values.to), moved);
  return reparsed.lines.join('\n');
}

export function setStatus(markdown, values) {
  if (!values.status) throw new Error('--status is required');
  const parsed = parseTables(markdown);
  const match = requireSingleMatch(parsed, values, values.section ?? '');
  if (!setCell(parsed.lines, match.table, match.row, 'Status', values.status)) throw new Error('Matched table has no Status column');
  if (values.date) {
    setCell(parsed.lines, match.table, match.row, 'Updated', values.date) ||
      setCell(parsed.lines, match.table, match.row, 'Checked', values.date) ||
      setCell(parsed.lines, match.table, match.row, 'Date', values.date);
  }
  return parsed.lines.join('\n');
}

export function bumpDate(markdown, values) {
  if (!values.field || !values.date) throw new Error('--field and --date are required');
  const canonicalFieldName = canonicalField(values.field);
  if (!['added', 'checked', 'updated', 'date'].includes(canonicalFieldName)) throw new Error('--field must be Added, Checked, Updated, Date, or a configured alias');
  const parsed = parseTables(markdown);
  const match = requireSingleMatch(parsed, values, values.section ?? '');
  if (!setCell(parsed.lines, match.table, match.row, canonicalFieldName, values.date)) {
    throw new Error(`Matched table has no ${values.field} column`);
  }
  return parsed.lines.join('\n');
}

function readTracker(path) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) throw new Error(`Tracker not found: ${path}`);
  return readFileSync(fullPath, 'utf8');
}

function writeTracker(path, text) {
  writeFileSync(resolve(path), text);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  setSchemaRootFromTracker(opts.tracker);
  const markdown = readTracker(opts.tracker);

  if (opts.command === 'list') {
    if (!opts.section) throw new Error('--section is required');
    const rows = listRows(markdown, opts.section);
    if (opts.json) console.log(JSON.stringify(rows, null, 2));
    else {
      for (const row of rows) console.log(Object.values(row).join(' | '));
    }
    return;
  }

  if (opts.command === 'validate') {
    const result = validateTracker(markdown);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else if (result.issues.length) {
      for (const issue of result.issues) console.log(`${issue.level}: line ${issue.line}: ${issue.message}`);
    } else {
      console.log(`tracker ok: ${result.tables} tables, ${result.rows} rows`);
    }
    process.exitCode = result.ok && !(opts.strict && result.issues.length) ? 0 : 1;
    return;
  }

  const commands = {
    'add-lead': addLead,
    move: moveRow,
    'set-status': setStatus,
    'bump-date': bumpDate,
  };
  const fn = commands[opts.command];
  if (!fn) throw new Error(`Unknown command: ${opts.command}`);
  const next = fn(markdown, opts);
  if (opts.dryRun) console.log(next);
  else {
    writeTracker(opts.tracker, next);
    console.log(`tracker updated: ${opts.command}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`tracker: ${err.message}`);
    console.error('');
    usage();
    process.exit(1);
  }
}
