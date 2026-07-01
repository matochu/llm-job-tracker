import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { cloneAliases, mergeAlias, parseAliasTable } from '../lib/markdown-utils.js';

export { cloneAliases } from '../lib/markdown-utils.js';

export const sectionAliases = {
  active: ['Active Pipeline'],
  monitoring: ['Monitoring'],
  staging: ['Staging'],
  raw: ['Raw Pipeline'],
  submitted: ['Submitted / In Process', 'Submitted', 'In Process'],
  archive: ['Archive'],
};

export const fieldAliases = {
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

export function setSchemaRootFromTracker(trackerPath) {
  const fullPath = resolve(trackerPath);
  schemaRoot = dirname(dirname(fullPath));
  schemaCache = null;
}

export function getSchemaRoot() {
  return schemaRoot;
}

export function loadSchemaAliases(root) {
  if (root === undefined && schemaCache) return schemaCache;
  const schema = {
    sections: cloneAliases(sectionAliases),
    fields: cloneAliases(fieldAliases),
  };
  const schemaPath = resolve(root ?? schemaRoot, 'config', 'tracker-schema.md');
  if (existsSync(schemaPath)) {
    const markdown = readFileSync(schemaPath, 'utf8');
    parseAliasTable(markdown, '### Section Aliases', schema.sections);
    parseAliasTable(markdown, '### Field Aliases', schema.fields);
  }
  if (root === undefined) schemaCache = schema;
  return schema;
}

function _canonicalField(name, schema) {
  const normalized = String(name ?? '').trim().toLowerCase();
  for (const [canonical, aliases] of Object.entries(schema.fields)) {
    if (aliases.some((alias) => alias.toLowerCase() === normalized)) return canonical;
  }
  return normalized;
}

export function canonicalField(name) {
  return _canonicalField(name, loadSchemaAliases());
}

export function canonicalFieldWith(name, schema) {
  return _canonicalField(name, schema);
}

export function wantedSectionNames(section) {
  const schema = loadSchemaAliases();
  return schema.sections[section]?.map((name) => name.toLowerCase()) ?? [section.toLowerCase()];
}
