import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadSourceRegistry, rootDomain } from '../lib/source-registry.js';
import { filterRolesWithOptions } from './filter.js';
import { text } from './utils.js';
import { normalizeRoles, parseWorkableMarkdown, pickJobs } from './providers.js';

export function providerUrl(provider, slug, params = {}) {
  const encoded = encodeURIComponent(slug);
  const registry = params.registry ?? loadSourceRegistry(params.root);
  const template = registry.providerFeeds.get(provider);
  if (!template) throw new Error(`Provider ${provider} is missing a discovery feed in config/source-registry.md`);
  return template
    .replaceAll('[slug]', encoded)
    .replaceAll('[limit]', String(params.limit ?? 100))
    .replaceAll('[offset]', String(params.offset ?? 0));
}

async function fetchWithTimeout(fetcher, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchSmartRecruitersPayload(slug, fetcher, timeoutMs, maxPages, registry) {
  const content = [];
  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * 100;
    const response = await fetchWithTimeout(fetcher, providerUrl('smartrecruiters', slug, { offset, limit: 100, registry }), { headers: { accept: 'application/json' } }, timeoutMs);
    if (!response.ok) throw new Error(`ATS request failed: ${response.status} ${response.statusText}`);
    const payload = JSON.parse(await response.text());
    const pageItems = pickJobs(payload, 'smartrecruiters');
    content.push(...pageItems);
    const totalFound = Number(payload.totalFound ?? payload.total ?? content.length);
    if (!pageItems.length || content.length >= totalFound) break;
  }
  return { content };
}

export async function fetchPayload(provider, slug, fetcher = fetch, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? 8000);
  const registry = options.registry ?? loadSourceRegistry(options.root);
  if (provider === 'smartrecruiters') return fetchSmartRecruitersPayload(slug, fetcher, timeoutMs, 5, registry);
  const response = await fetchWithTimeout(fetcher, providerUrl(provider, slug, { registry }), { headers: { accept: 'application/json,text/markdown;q=0.8,*/*;q=0.5' } }, timeoutMs);
  if (!response.ok) throw new Error(`ATS request failed: ${response.status} ${response.statusText}`);
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    if (provider === 'workable') return parseWorkableMarkdown(body, slug);
    throw new Error('ATS response was not JSON');
  }
}

export function discoverSlugCandidates(companyOrDomain) {
  const raw = text(companyOrDomain).trim();
  const base = rootDomain(raw)
    .replace(/\b(inc|ltd|llc|gmbh|sa|s\.a\.|plc|corp|corporation|company)\b/gi, ' ')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
  const compact = base.replace(/\s+/g, '');
  const dashed = base.replace(/\s+/g, '-');
  const candidates = [compact, dashed].filter(Boolean);
  return [...new Set(candidates.map((candidate) => candidate.replace(/^-+|-+$/g, '')).filter(Boolean))];
}

async function probeOne(provider, slug, options = {}) {
  const registry = options.registry ?? loadSourceRegistry(options.root);
  const payload = await fetchPayload(provider, slug, options.fetcher ?? fetch, { timeoutMs: Number(options.timeoutMs ?? 8000), registry });
  let roles = filterRolesWithOptions(normalizeRoles(provider, slug, payload), options)
    .map(({ raw, ...role }) => role);
  if (options.titleRegex) {
    const pattern = new RegExp(options.titleRegex, 'i');
    roles = roles.filter((role) => pattern.test(role.title));
  }
  const limit = Number(options.limit ?? 0);
  if (limit > 0) roles = roles.slice(0, limit);
  return { provider, slug, count: roles.length, url: providerUrl(provider, slug, { registry }), roles };
}

export async function probeBatch(provider, slugs, options = {}) {
  const registry = options.registry ?? loadSourceRegistry(options.root);
  const results = [];
  for (const slug of slugs) {
    try {
      results.push(await probeOne(provider, slug, options));
    } catch (err) {
      results.push({ provider, slug, count: 0, url: providerUrl(provider, slug, { registry }), roles: [], error: err.message });
    }
  }
  return results;
}

export async function discoverBoards(companyOrDomain, options = {}) {
  const registry = options.registry ?? loadSourceRegistry(options.root);
  const providers = new Set(registry.providerIds);
  const selectedProviders = (options.providers?.length ? options.providers : [...providers])
    .map((provider) => provider.toLowerCase())
    .filter((provider) => providers.has(provider));
  const slugCandidates = options.slugCandidates ?? discoverSlugCandidates(companyOrDomain);
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = Number(options.timeoutMs ?? 8000);
  const results = [];

  for (const provider of selectedProviders) {
    let found = false;
    const errors = [];
    for (const slug of slugCandidates) {
      try {
        const payload = await fetchPayload(provider, slug, fetcher, { timeoutMs, registry });
        const roles = filterRolesWithOptions(normalizeRoles(provider, slug, payload), options)
          .map(({ raw, ...role }) => role);
        if (roles.length) {
          results.push({ provider, slug, url: providerUrl(provider, slug, { registry }), count: roles.length, roles });
          found = true;
          break;
        }
      } catch (err) {
        errors.push({ provider, slug, url: providerUrl(provider, slug, { registry }), count: 0, roles: [], error: err.message });
      }
    }
    if (!found && errors.length) results.push(...errors);
  }

  return results;
}

function sectionText(markdown, headings) {
  const lines = markdown.split(/\r?\n/);
  let active = false;
  const collected = [];
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      active = headings.some((heading) => line.toLowerCase().includes(heading.toLowerCase()));
      continue;
    }
    if (active) collected.push(line);
  }
  return collected.join('\n');
}

function wordsFromProfileSection(markdown, headings) {
  const block = sectionText(markdown, headings);
  const quoted = [...block.matchAll(/["`]([^"`]+)["`]/g)].map((match) => match[1]);
  const bullets = block.split(/\r?\n/)
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) => line.replace(/^\s*[-*]\s+/, '').replace(/[:;].*$/, '').trim())
    .filter(Boolean);
  return [...new Set([...quoted, ...bullets].map((item) => item.toLowerCase()).filter((item) => item.length >= 2))];
}

export function profileHints(profileSlug, root = process.cwd()) {
  if (!profileSlug) return { slug: '', keywords: [], hints: [] };
  const path = resolve(root, 'strategy', 'search-profiles', `${profileSlug}.md`);
  if (!existsSync(path)) return { slug: profileSlug, keywords: [], hints: [`profile not found: ${path}`] };
  const markdown = readFileSync(path, 'utf8');
  const keywords = wordsFromProfileSection(markdown, ['Search Queries', 'Target Role Families', 'Strong Fit Signals', 'Medium Fit Signals']);
  return { slug: profileSlug, keywords, hints: keywords.slice(0, 12) };
}
