import { deriveSourceFromUrl } from '../lib/source-registry.js';
import { canonicalField, getSchemaRoot } from './schema.js';
import {
  cell, findRows, findTable, headerIndex, insertIntoTable, normalizeUrl, parseTables,
  removeRow, requireSingleMatch, rowLine, setCell,
} from './parse.js';

function rowObjectByCanonical(table, row) {
  const data = {};
  table.header.forEach((header, index) => {
    data[canonicalField(header)] = row.cells[index] ?? '';
  });
  return data;
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

// Raw-intake-only metadata: meaningful while a lead is unverified, but not
// required once a row moves on — dropping it silently is not data loss.
const DROPPABLE_ON_MOVE = new Set(['added', 'source']);

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
      // No Detail/Notes column to stash into. Raw-intake-only metadata (Added,
      // Source) is meaningless once a row moves on, so drop it silently instead
      // of blocking the move; anything else is a genuine, reportable conflict.
      const blocking = leftovers.filter((item) => !DROPPABLE_ON_MOVE.has(item.canonical));
      if (blocking.length) {
        throw new Error(`Destination section ${toTable.section} cannot preserve columns: ${blocking.map((item) => item.header).join(', ')}`);
      }
    } else {
      const suffix = leftovers.map((item) => `${item.header}: ${item.value}`).join('; ');
      next[detailIndex] = [next[detailIndex], suffix].filter(Boolean).join('; ');
    }
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
      issues.push({ level: 'error', line: table.headerLine + 1, message: 'Profile column should be immediately after Company' });
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
        issues.push({ level: 'warning', line: row.lineIndex + 1, message: `Duplicate URL also appears on line ${allUrls.get(url)}: ${url}` });
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
  if (!values.source && values.url) {
    try {
      const derived = deriveSourceFromUrl(values.url, { root: getSchemaRoot() });
      if (derived) values = { ...values, source: derived };
    } catch { /* registry missing — source validation below will report */ }
  }
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
