import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function repoRoot() {
  let path = resolve(process.cwd());
  while (true) {
    if (existsSync(resolve(path, '.git'))) return path;
    const parent = resolve(path, '..');
    if (parent === path) return resolve(process.cwd());
    path = parent;
  }
}

export function settingsPath(root) {
  return resolve(root, 'config/settings.md');
}

export function profilesDir(root) {
  return resolve(root, 'strategy/search-profiles');
}

function readText(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

function sectionLines(text, heading) {
  const out = [];
  let inSection = false;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      inSection = line.slice(3).trim().toLowerCase() === heading.toLowerCase();
      continue;
    }
    if (inSection) out.push(line);
  }
  return out;
}

export function activeProfile(root) {
  const text = readText(settingsPath(root));
  let slug = null;
  let file = null;
  for (const line of text.split(/\r?\n/)) {
    let match = line.match(/^- \*\*Profile slug:\*\* `([^`]+)`/);
    if (match) slug = match[1];
    match = line.match(/^- \*\*Profile file:\*\* `([^`]+)`/);
    if (match) file = match[1];
  }
  return { slug, file };
}

export function listedProfiles(root) {
  const text = readText(settingsPath(root));
  const slugs = new Set();
  for (const line of sectionLines(text, 'Available Profiles')) {
    const match = line.trim().match(/^-\s+`([^`]+)`/);
    if (match) slugs.add(match[1]);
  }
  return slugs;
}

export function fileProfiles(root) {
  const dir = profilesDir(root);
  if (!existsSync(dir)) return new Set();
  return new Set(readdirSync(dir).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3)));
}

function main() {
  const root = repoRoot();
  const arg = process.argv[2] || '';
  if (arg === 'active-slug') console.log(activeProfile(root).slug || '');
  else if (arg === 'active-file') console.log(activeProfile(root).file || '');
  else if (arg === 'list-slugs') console.log([...listedProfiles(root)].sort().join('\n'));
  else if (arg === 'file-slugs') console.log([...fileProfiles(root)].sort().join('\n'));
  else {
    console.error(`unknown command: ${arg}`);
    process.exitCode = 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
