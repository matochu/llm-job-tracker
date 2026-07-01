import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bulletItemsAfterHeading, labelsFromCell, tableRowsAfterHeading } from './markdown-utils.js';

export { bulletItemsAfterHeading, cloneAliases, isSeparatorRow, labelsFromCell, mergeAlias, parseAliasTable, splitMarkdownRow, tableRowsAfterHeading } from './markdown-utils.js';

const libRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const _cache = new Map();

function parseRegistryMarkdown(markdown) {
  const providerFeeds = new Map();
  for (const cells of tableRowsAfterHeading(markdown, '## ATS Probe Providers')) {
    const provider = labelsFromCell(cells[0])[0]?.toLowerCase();
    const feed = labelsFromCell(cells[3])[0] ?? cells[3];
    if (provider && feed) providerFeeds.set(provider, feed);
  }

  const browserRequiredSources = [];
  for (const cells of tableRowsAfterHeading(markdown, '## Browser-Required Sources')) {
    const source = labelsFromCell(cells[0])[0];
    if (!source || /\s/.test(source)) continue;
    browserRequiredSources.push({
      source,
      hostPatterns: labelsFromCell(cells[1] ?? ''),
      why: cells[2] ?? '',
      requiredAccess: cells[3] ?? '',
      policy: cells[4] ?? '',
    });
  }

  return {
    providerIds: [...providerFeeds.keys()],
    providerFeeds,
    keywords: bulletItemsAfterHeading(markdown, '### Keywords'),
    locations: bulletItemsAfterHeading(markdown, '### Locations'),
    sourceDerivation: tableRowsAfterHeading(markdown, '## Source Derivation')
      .flatMap((cells) => labelsFromCell(cells[0]).map((pattern) => ({
        pattern: pattern.toLowerCase(),
        source: labelsFromCell(cells[1])[0] ?? cells[1],
      })))
      .filter((entry) => entry.pattern && entry.source),
    browserRequiredSources,
  };
}

function _load(root) {
  const candidates = [
    resolve(root, 'config', 'source-registry.md'),
    resolve(libRoot, 'config', 'source-registry.md'),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error('config/source-registry.md is missing. Run job-tracker:setup to fill source registry settings.');
  const markdown = readFileSync(path, 'utf8');
  const registry = { path, ...parseRegistryMarkdown(markdown) };

  const missing = [];
  if (!registry.providerIds.length) missing.push('ATS Probe Providers');
  if (!registry.keywords.length) missing.push('ATS Probe Search Defaults / Keywords');
  if (!registry.locations.length) missing.push('ATS Probe Search Defaults / Locations');
  for (const provider of registry.providerIds) {
    const feed = registry.providerFeeds.get(provider) ?? '';
    if (!feed.includes('[slug]')) missing.push(`Discovery feed with [slug] for ${provider}`);
  }
  if (missing.length) {
    throw new Error(`config/source-registry.md is incomplete: ${missing.join(', ')}. Run job-tracker:setup to fill source registry settings.`);
  }

  return registry;
}

export function loadSourceRegistry(root = libRoot) {
  if (_cache.has(root)) return _cache.get(root);
  const result = _load(root);
  _cache.set(root, result);
  return result;
}

export function clearRegistryCache() {
  _cache.clear();
}

export function parseSourceRegistryRaw(markdown) {
  return parseRegistryMarkdown(markdown);
}

export function hostnameFromUrl(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return '';
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  }
}

export function hostMatchesPattern(host, pattern) {
  const normalizedHost = host.toLowerCase().replace(/^www\./, '');
  const normalizedPattern = pattern.toLowerCase().replace(/^www\./, '');
  if (normalizedPattern.startsWith('*.')) {
    const suffix = normalizedPattern.slice(2);
    return normalizedHost !== suffix && normalizedHost.endsWith(`.${suffix}`);
  }
  if (normalizedPattern.includes('*')) {
    const escaped = normalizedPattern
      .split('*')
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    return new RegExp(`^${escaped}$`).test(normalizedHost);
  }
  return normalizedHost === normalizedPattern;
}

export function rootDomain(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    const labels = parsed.hostname.replace(/^www\./, '').split('.').filter(Boolean);
    const publicSuffixes = new Set(['co.uk', 'com.au', 'com.br', 'com.ua', 'co.jp']);
    const suffix2 = labels.slice(-2).join('.');
    if (labels[0] && ['careers', 'jobs', 'apply'].includes(labels[0]) && labels.length > 2) labels.shift();
    if (labels.length >= 3 && publicSuffixes.has(suffix2)) return labels[labels.length - 3];
    return labels.length >= 2 ? labels[labels.length - 2] : labels[0] ?? raw;
  } catch {
    return raw;
  }
}

export function deriveSourceFromUrl(value, options = {}) {
  const registry = options.registry ?? loadSourceRegistry(options.root);
  const host = hostnameFromUrl(value);
  if (!host) return '';
  for (const entry of registry.sourceDerivation ?? []) {
    if (hostMatchesPattern(host, entry.pattern)) return entry.source;
  }
  return rootDomain(host);
}
