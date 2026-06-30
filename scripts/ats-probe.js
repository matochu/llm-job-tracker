#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const scriptRoot = resolve(dirname(scriptPath), '..');

function splitMarkdownRow(line) {
  const stripped = line.trim();
  if (!stripped.startsWith('|') || !stripped.endsWith('|')) return null;
  return stripped.slice(1, -1).split('|').map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(' ', '')));
}

function labelsFromCell(cell) {
  const labels = [...String(cell ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
  if (labels.length) return labels;
  return String(cell ?? '').split(',').map((item) => item.trim()).filter(Boolean);
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

export function loadSourceRegistry(root = scriptRoot) {
  const candidates = [
    resolve(root, 'config', 'source-registry.md'),
    resolve(scriptRoot, 'config', 'source-registry.md'),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) throw new Error('config/source-registry.md is missing. Run job-tracker:setup to fill source registry settings.');
  const markdown = readFileSync(path, 'utf8');
  const providerRows = tableRowsAfterHeading(markdown, '## ATS Probe Providers');
  const providerFeeds = new Map();
  for (const cells of providerRows) {
    const provider = labelsFromCell(cells[0])[0]?.toLowerCase();
    const feed = labelsFromCell(cells[3])[0] ?? cells[3];
    if (provider && feed) providerFeeds.set(provider, feed);
  }
  const registry = {
    path,
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
  };
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

function requireSourceRegistry(root = scriptRoot) {
  return loadSourceRegistry(root);
}

export function getProviderIds(root = scriptRoot) {
  return requireSourceRegistry(root).providerIds;
}

const roleMappers = {
  ashby: roleFromAshby,
  lever: roleFromLever,
  greenhouse: roleFromGreenhouse,
  workable: roleFromWorkable,
  recruitee: roleFromRecruitee,
  smartrecruiters: roleFromSmartRecruiters,
};

export const implementedProviderIds = Object.keys(roleMappers);
export const providerIds = implementedProviderIds;

function usage() {
  console.log(`Usage:
  node scripts/ats-probe.js batch <provider> <slug...> [--limit 10] [--json]
  node scripts/ats-probe.js discover <company-or-domain> [--providers ashby,lever] [--json]
  node scripts/ats-probe.js derive-source <url> [--json]
  node scripts/ats-probe.js <provider> <slug> [--profile <slug>] [--json] [--strict-location]
  node scripts/ats-probe.js <provider> <slug> --file fixture.json [--json]

Providers: ${getProviderIds().join(', ')}
`);
}

function parseArgs(argv, registry = requireSourceRegistry()) {
  if (argv[0] === '--help' || argv[0] === '-h') {
    usage();
    process.exit(0);
  }
  const opts = {
    provider: argv[0],
    slug: argv[1],
    profile: '',
    json: false,
    file: '',
    providers: '',
    strictLocation: false,
    timeout: '8000',
    limit: '0',
    titleRegex: '',
    slugs: [],
  };

  const optionStart = 2;
  for (let i = optionStart; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (opts.provider === 'batch' && !arg.startsWith('--')) {
      opts.slugs.push(arg);
      continue;
    }
    if (arg === '--json') {
      opts.json = true;
      continue;
    }
    if (arg === '--strict-location') {
      opts.strictLocation = true;
      continue;
    }
    if (['--profile', '--file', '--providers', '--timeout', '--limit', '--title-regex'].includes(arg)) {
      const value = argv[i + 1];
      if (!value) throw new Error(`${arg} requires a value`);
      opts[arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!opts.provider || !opts.slug) throw new Error('provider and slug are required');
  if (opts.provider === 'discover' || opts.provider === 'derive-source') return opts;
  const providers = new Set(registry.providerIds);
  if (opts.provider === 'batch') {
    opts.slug = opts.slug?.toLowerCase();
    if (!providers.has(opts.slug)) throw new Error(`Unsupported provider: ${opts.slug}`);
    if (!opts.slugs.length) throw new Error('batch requires at least one slug');
    return opts;
  }
  opts.provider = opts.provider.toLowerCase();
  if (!providers.has(opts.provider)) throw new Error(`Unsupported provider: ${opts.provider}`);
  return opts;
}

function text(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return [
      value.name,
      value.title,
      value.location,
      value.city,
      value.country,
      value.region,
      value.remote ? 'Remote' : '',
    ].filter(Boolean).join(', ');
  }
  return String(value);
}

function hostnameFromUrl(value) {
  const raw = text(value).trim().toLowerCase();
  if (!raw) return '';
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.replace(/^www\./, '');
  } catch {
    return raw.replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  }
}

function hostMatchesPattern(host, pattern) {
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

export function deriveSourceFromUrl(value, options = {}) {
  const registry = options.registry ?? requireSourceRegistry(options.root);
  const host = hostnameFromUrl(value);
  if (!host) return '';
  for (const entry of registry.sourceDerivation ?? []) {
    if (hostMatchesPattern(host, entry.pattern)) return entry.source;
  }
  return rootDomain(host);
}

function stripHtml(value) {
  return text(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function first(...values) {
  return values.find((value) => text(value).trim()) ?? '';
}

function normalizeUrl(url) {
  const value = extractPrimaryUrl(url);
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|gh_src$|rl$)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/\/$/, '');
  }
}

function extractPrimaryUrl(value) {
  const raw = text(value);
  const markdownLink = raw.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownLink) return markdownLink[1];
  const bare = raw.match(/https?:\/\/[^\s)<>,|]+/i);
  return bare ? bare[0] : raw.trim();
}

function roleFromAshby(job, slug) {
  const location = first(job.location, job.locationName, job.primaryLocation, job.locations);
  const id = first(job.id, job.jobId, job.externalId);
  const url = first(job.jobUrl, job.applyUrl, job.applicationUrl, job.url, id ? `https://jobs.ashbyhq.com/${slug}/${id}` : '');
  return {
    provider: 'ashby',
    company: first(job.companyName, job.organizationName, slug),
    title: stripHtml(first(job.title, job.name)),
    location: stripHtml(location),
    id: text(id),
    url: normalizeUrl(url),
    raw: job,
  };
}

function roleFromLever(job, slug) {
  const categories = job.categories ?? {};
  const location = first(job.workplaceType, categories.location, job.location, job.locations);
  return {
    provider: 'lever',
    company: first(job.company, slug),
    title: stripHtml(first(job.text, job.title)),
    location: stripHtml(location),
    id: text(first(job.id, job.hostedUrl, job.applyUrl)),
    url: normalizeUrl(first(job.hostedUrl, job.applyUrl, job.url)),
    raw: job,
  };
}

function roleFromGreenhouse(job, slug) {
  const location = first(job.location, job.offices, job.departments);
  return {
    provider: 'greenhouse',
    company: first(job.company_name, slug),
    title: stripHtml(first(job.title, job.name)),
    location: stripHtml(location),
    id: text(first(job.id, job.internal_job_id, job.absolute_url)),
    url: normalizeUrl(first(job.absolute_url, job.url)),
    raw: job,
  };
}

function roleFromWorkable(job, slug) {
  const location = first(job.location, job.city, job.country, job.state, job.remote ? 'Remote' : '');
  const shortcode = first(job.shortcode, job.id);
  return {
    provider: 'workable',
    company: first(job.company, slug),
    title: stripHtml(first(job.title, job.name)),
    location: stripHtml(location),
    id: text(shortcode),
    url: normalizeUrl(first(job.url, job.application_url, shortcode ? `https://apply.workable.com/${slug}/j/${shortcode}` : '')),
    raw: job,
  };
}

function roleFromRecruitee(job, slug) {
  const location = first(job.location, job.city, job.country, job.remote ? 'Remote' : '');
  return {
    provider: 'recruitee',
    company: first(job.company_name, slug),
    title: stripHtml(first(job.title, job.name)),
    location: stripHtml(location),
    id: text(first(job.id, job.slug, job.careers_url)),
    url: normalizeUrl(first(job.careers_url, job.url)),
    raw: job,
  };
}

function roleFromSmartRecruiters(job, slug) {
  const location = first(job.location, job.ref, job.city, job.country);
  return {
    provider: 'smartrecruiters',
    company: first(job.company?.name, job.company, slug),
    title: stripHtml(first(job.name, job.title)),
    location: stripHtml(location),
    id: text(first(job.id, job.uuid, job.ref)),
    url: normalizeUrl(first(job.ref, job.applyUrl, job.url)),
    raw: job,
  };
}

function pickJobs(payload, provider) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.jobs)) return payload.jobs;
  if (Array.isArray(payload.jobPostings)) return payload.jobPostings;
  if (Array.isArray(payload.postings)) return payload.postings;
  if (Array.isArray(payload.offers)) return payload.offers;
  if (Array.isArray(payload.content)) return payload.content;
  if (Array.isArray(payload.results)) return payload.results;
  if (provider === 'smartrecruiters' && Array.isArray(payload.smartRecruitersJobs)) return payload.smartRecruitersJobs;
  return [];
}

export function normalizeRoles(provider, slug, payload) {
  const mapper = roleMappers[provider];
  if (!mapper) throw new Error(`Unsupported provider normalizer: ${provider}`);
  return pickJobs(payload, provider)
    .map((job) => mapper(job, slug))
    .filter((role) => role.title && role.url);
}

function lowerHaystack(role) {
  return [role.title, role.location, stripHtml(role.raw?.description), stripHtml(role.raw?.content), role.raw?.department, role.raw?.team]
    .map(text)
    .join(' ')
    .toLowerCase();
}

export function filterRoles(roles, keywords = requireSourceRegistry().keywords, locations = requireSourceRegistry().locations) {
  return roles.filter((role) => {
    const haystack = lowerHaystack(role);
    const keywordHit = keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    const locationSignal = locationConfidence(role, locations);
    const locationHit = !locationSignal.locationText || locationSignal.allowed;
    return keywordHit && locationHit;
  });
}

export function locationConfidence(role, locations = requireSourceRegistry().locations) {
  const locationText = [role.location, role.raw?.workplaceType, role.raw?.remote ? 'remote' : ''].map(text).join(' ').toLowerCase().trim();
  const descriptionText = [stripHtml(role.raw?.description), stripHtml(role.raw?.content)].join(' ').toLowerCase().trim();
  const blockedRemote = /\bremote\b/.test(locationText) && /\b(us|u\.s\.|usa|united states|canada|americas|north america)\b/.test(locationText);
  const allowedInLocation = !blockedRemote && locations.some((location) => {
    const normalized = location.toLowerCase();
    if (normalized === 'remote') return /\bremote\b/.test(locationText);
    return locationText.includes(normalized);
  });
  const allowedInDescription = locations.some((location) => descriptionText.includes(location.toLowerCase()));
  return {
    locationText,
    descriptionText,
    allowed: allowedInLocation || (!locationText && allowedInDescription),
    confidence: allowedInLocation ? 'explicit' : allowedInDescription ? 'description' : locationText ? 'mismatch' : 'missing',
  };
}

export function filterRolesWithOptions(roles, options = {}) {
  const registry = options.registry ?? requireSourceRegistry(options.root);
  const keywords = options.keywords ?? registry.keywords;
  const locations = options.locations ?? registry.locations;
  return roles
    .map((role) => ({ role, locationSignal: locationConfidence(role, locations) }))
    .filter(({ role, locationSignal }) => {
      const haystack = lowerHaystack(role);
      const keywordHit = keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
      const locationHit = options.strictLocation ? locationSignal.allowed : (!locationSignal.locationText || locationSignal.allowed);
      return keywordHit && locationHit;
    })
    .map(({ role, locationSignal }) => ({
      ...role,
      locationConfidence: locationSignal.confidence,
    }));
}

function providerUrl(provider, slug, params = {}) {
  const encoded = encodeURIComponent(slug);
  const registry = params.registry ?? requireSourceRegistry(params.root);
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

async function fetchPayload(provider, slug, fetcher = fetch, options = {}) {
  const timeoutMs = Number(options.timeoutMs ?? 8000);
  const registry = options.registry ?? requireSourceRegistry(options.root);
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

async function fetchSmartRecruitersPayload(slug, fetcher, timeoutMs, maxPages = 5, registry = requireSourceRegistry()) {
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

export function rootDomain(value) {
  const raw = text(value).trim().toLowerCase();
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

export async function discoverBoards(companyOrDomain, options = {}) {
  const registry = options.registry ?? requireSourceRegistry(options.root);
  const providers = new Set(registry.providerIds);
  const selectedProviders = (options.providers?.length ? options.providers : [...providers])
    .map((provider) => provider.toLowerCase())
    .filter((provider) => providers.has(provider));
  const slugCandidates = options.slugCandidates ?? discoverSlugCandidates(companyOrDomain);
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = Number(options.timeoutMs ?? 8000);
  const results = [];

  for (const provider of selectedProviders) {
    for (const slug of slugCandidates) {
      try {
        const payload = await fetchPayload(provider, slug, fetcher, { timeoutMs, registry });
        const roles = filterRolesWithOptions(normalizeRoles(provider, slug, payload), options)
          .map(({ raw, ...role }) => role);
        if (roles.length) {
          results.push({ provider, slug, url: providerUrl(provider, slug, { registry }), count: roles.length, roles });
          break;
        }
      } catch (err) {
        results.push({ provider, slug, url: providerUrl(provider, slug, { registry }), count: 0, roles: [], error: err.message });
      }
    }
  }

  return results.filter((result) => result.count > 0);
}

function parseWorkableMarkdown(markdown, slug) {
  const jobs = [];
  const pattern = /\[([^\]]+)\]\((https:\/\/apply\.workable\.com\/[^)]+)\)(?:\s*-\s*([^\n]+))?/g;
  for (const match of markdown.matchAll(pattern)) {
    jobs.push({ title: match[1], url: match[2], location: match[3] ?? '', company: slug });
  }
  return { jobs };
}

function printTable(roles) {
  for (const role of roles) {
    console.log([
      role.title,
      role.location || '-',
      role.id || '-',
      role.url,
    ].join(' | '));
  }
}

function printDiscover(results) {
  for (const result of results) {
    console.log([result.provider, result.slug, result.count, result.url].join(' | '));
    for (const role of result.roles) {
      console.log(`  ${role.title} | ${role.location || '-'} | ${role.url}`);
    }
  }
}

function applyTitleRegex(roles, titleRegex) {
  if (!titleRegex) return roles;
  const pattern = new RegExp(titleRegex, 'i');
  return roles.filter((role) => pattern.test(role.title));
}

async function probeOne(provider, slug, options = {}) {
  const registry = options.registry ?? requireSourceRegistry(options.root);
  const payload = await fetchPayload(provider, slug, options.fetcher ?? fetch, { timeoutMs: Number(options.timeoutMs ?? 8000), registry });
  let roles = filterRolesWithOptions(normalizeRoles(provider, slug, payload), options)
    .map(({ raw, ...role }) => role);
  roles = applyTitleRegex(roles, options.titleRegex);
  const limit = Number(options.limit ?? 0);
  if (limit > 0) roles = roles.slice(0, limit);
  return { provider, slug, count: roles.length, url: providerUrl(provider, slug, { registry }), roles };
}

export async function probeBatch(provider, slugs, options = {}) {
  const results = [];
  for (const slug of slugs) {
    try {
      results.push(await probeOne(provider, slug, options));
    } catch (err) {
      results.push({ provider, slug, count: 0, url: providerUrl(provider, slug, { registry: options.registry }), roles: [], error: err.message });
    }
  }
  return results;
}

function printBatch(results) {
  for (const result of results) {
    console.log(`=== ${result.provider}/${result.slug} ===`);
    if (result.error) {
      console.log(`error | ${result.error}`);
      continue;
    }
    for (const role of result.roles) {
      console.log(`${role.title} | ${role.location || '-'} | ${role.url}`);
    }
  }
}

async function main() {
  const registry = requireSourceRegistry();
  const opts = parseArgs(process.argv.slice(2), registry);
  if (opts.provider === 'derive-source') {
    const source = deriveSourceFromUrl(opts.slug, { registry });
    if (opts.json) console.log(JSON.stringify({ url: opts.slug, source }, null, 2));
    else console.log(source);
    return;
  }
  const profile = profileHints(opts.profile, process.cwd());
  const keywords = profile.keywords.length ? [...new Set([...registry.keywords, ...profile.keywords])] : registry.keywords;
  const options = {
    registry,
    keywords,
    strictLocation: opts.strictLocation,
    timeoutMs: Number(opts.timeout),
    titleRegex: opts.titleRegex,
    limit: Number(opts.limit || 0),
  };

  if (opts.provider === 'batch') {
    const results = await probeBatch(opts.slug, opts.slugs, options);
    if (opts.json) console.log(JSON.stringify(results, null, 2));
    else printBatch(results);
    return;
  }

  if (opts.provider === 'discover') {
    const discovered = await discoverBoards(opts.slug, {
      providers: opts.providers ? opts.providers.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
      ...options,
    });
    if (opts.json) console.log(JSON.stringify(discovered, null, 2));
    else printDiscover(discovered);
    return;
  }

  const payload = opts.file ? JSON.parse(readFileSync(resolve(opts.file), 'utf8')) : await fetchPayload(opts.provider, opts.slug, fetch, { timeoutMs: Number(opts.timeout) });
  const roles = filterRolesWithOptions(normalizeRoles(opts.provider, opts.slug, payload), options)
    .map(({ raw, ...role }) => ({ ...role, profileHints: profile.hints }));

  if (opts.json) console.log(JSON.stringify(roles, null, 2));
  else printTable(roles);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`ats-probe: ${err.message}`);
    console.error('');
    usage();
    process.exit(1);
  });
}
