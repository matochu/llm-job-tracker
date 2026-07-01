import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cloneAliases, isSeparatorRow, parseAliasTable, splitMarkdownRow } from '../../lib/markdown-utils.js';
import { canonicalFieldWith as canonicalField, fieldAliases, sectionAliases } from '../../tracker/schema.js';

export function loadTrackerSchema(root, readText) {
  const schema = {
    sections: cloneAliases(sectionAliases),
    fields: cloneAliases(fieldAliases),
    issues: [],
  };
  const schemaPath = join(root, 'config', 'tracker-schema.md');
  if (!existsSync(schemaPath)) {
    schema.issues.push({ level: 'warning', message: 'config/tracker-schema.md is missing; run pending migrations or add tracker aliases before relying on tracker CLI checks' });
    return schema;
  }
  const markdown = readText(schemaPath);
  if (!markdown.includes('## CLI Schema Aliases')) {
    schema.issues.push({ level: 'warning', message: 'config/tracker-schema.md is missing `## CLI Schema Aliases`; run pending migrations or add tracker aliases' });
    return schema;
  }
  parseAliasTable(markdown, '### Section Aliases', schema.sections);
  parseAliasTable(markdown, '### Field Aliases', schema.fields);
  return schema;
}

export function trackerRows(root, schema, readText) {
  const tracker = join(root, 'data', 'tracker.md');
  const issues = [];
  const rows = [];

  if (!existsSync(tracker)) {
    return { rows, issues: [{ level: 'error', message: 'data/tracker.md is missing' }] };
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
      issues.push({ level: 'error', message: `data/tracker.md:${lineNo}: table has a configured Profile column but no configured Company column; add the company header label to config/tracker-schema.md` });
    }
    if (canonical.includes('company') && !canonical.includes('profile')) {
      issues.push({ level: 'error', message: `data/tracker.md:${lineNo}: table has a configured Company column but no configured Profile column; add the profile header label to config/tracker-schema.md` });
    }
    if (canonical.includes('profile') && canonical.includes('company')) {
      currentHeader = cells;
      currentCanonicalHeader = canonical;
      const companyIdx = canonical.indexOf('company');
      const profileIdx = canonical.indexOf('profile');
      if (companyIdx !== -1 && profileIdx !== companyIdx + 1) {
        issues.push({ level: 'warning', message: `data/tracker.md:${lineNo}: Profile column should be immediately after Company` });
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
