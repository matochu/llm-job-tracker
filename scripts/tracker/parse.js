import { canonicalField, wantedSectionNames } from './schema.js';
import { isSeparatorRow, splitMarkdownRow } from '../lib/markdown-utils.js';

export function splitRow(line) {
  return splitMarkdownRow(line);
}

export function isSeparator(cells) {
  return cells.length > 0 && isSeparatorRow(cells);
}

export function rowLine(cells) {
  return `| ${cells.join(' | ')} |`;
}

function normalizeHeading(line) {
  return line.replace(/^#+\s*/, '').replace(/[^\p{L}\p{N}/ ]+/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function sectionMatches(line, section) {
  if (!line.trim().startsWith('#')) return false;
  const heading = normalizeHeading(line);
  return wantedSectionNames(section).some((name) => heading.includes(name.toLowerCase()));
}

export function parseTables(markdown) {
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

export function findTable(parsed, section) {
  const table = parsed.tables.find((candidate) => sectionMatches(candidate.section, section));
  if (!table) throw new Error(`Section table not found: ${section}`);
  return table;
}

export function headerIndex(table, canonical) {
  return table.header.findIndex((header) => canonicalField(header) === canonical);
}

export function cell(row, names) {
  const wanted = names.map(canonicalField);
  for (const [key, value] of Object.entries(row.data)) {
    if (wanted.includes(canonicalField(key))) return value;
  }
  return '';
}

export function stripMarkdownInline(value) {
  return String(value ?? '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 $2')
    .replace(/[*_~`]+/g, '')
    .trim();
}

export function plain(value) {
  return stripMarkdownInline(value)
    .replace(/https?:\/\//g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function extractPrimaryUrl(value) {
  const raw = String(value ?? '');
  const markdownLink = raw.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownLink) return markdownLink[1];
  const bare = raw.match(/https?:\/\/[^\s)<>,|]+/i);
  return bare ? bare[0] : raw.trim();
}

export function normalizeUrl(value) {
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

export function findRows(parsed, opts, section = '') {
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

export function requireSingleMatch(parsed, opts, section = '') {
  const matches = findRows(parsed, opts, section);
  if (matches.length !== 1) {
    const selector = opts.url ? `url ${opts.url}` : `${opts.company ?? '*'} / ${opts.role ?? '*'}`;
    throw new Error(`Expected exactly one matching row for ${selector}; found ${matches.length}`);
  }
  return matches[0];
}

export function setCell(lines, table, row, name, value) {
  const index = headerIndex(table, canonicalField(name));
  if (index === -1) return false;
  row.cells[index] = value;
  lines[row.lineIndex] = rowLine(row.cells);
  return true;
}

export function insertIntoTable(lines, table, cells) {
  lines.splice(table.endLine, 0, rowLine(cells));
}

export function removeRow(lines, row) {
  lines.splice(row.lineIndex, 1);
}
