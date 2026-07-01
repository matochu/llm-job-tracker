#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../lib/is-main.js';
import { clearRegistryCache, deriveSourceFromUrl, loadSourceRegistry, rootDomain } from '../lib/source-registry.js';
import { discoverBoards, discoverSlugCandidates, fetchPayload, probeBatch, profileHints, providerUrl } from './discover.js';
import { filterRolesWithOptions, filterRoles, locationConfidence } from './filter.js';
import { normalizeRoles } from './providers.js';

export {
  clearRegistryCache,
  deriveSourceFromUrl,
  discoverBoards,
  discoverSlugCandidates,
  filterRoles,
  filterRolesWithOptions,
  loadSourceRegistry,
  locationConfidence,
  normalizeRoles,
  probeBatch,
  profileHints,
  providerUrl,
  rootDomain,
};

const scriptPath = fileURLToPath(import.meta.url);
const scriptRoot = resolve(dirname(scriptPath), '../..');

export { implementedProviderIds } from './providers.js';
/** @deprecated Use getProviderIds(root) to get registry-driven provider list */
export { implementedProviderIds as providerIds } from './providers.js';

export function getProviderIds(root = scriptRoot) {
  return loadSourceRegistry(root).providerIds;
}

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

function parseArgs(argv, registry = loadSourceRegistry(scriptRoot)) {
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
    if (arg === '--json') { opts.json = true; continue; }
    if (arg === '--strict-location') { opts.strictLocation = true; continue; }
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

function printTable(roles) {
  for (const role of roles) {
    console.log([role.title, role.location || '-', role.id || '-', role.url].join(' | '));
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

function printBatch(results) {
  for (const result of results) {
    console.log(`=== ${result.provider}/${result.slug} ===`);
    if (result.error) { console.log(`error | ${result.error}`); continue; }
    for (const role of result.roles) {
      console.log(`${role.title} | ${role.location || '-'} | ${role.url}`);
    }
  }
}

async function main() {
  const cwdRegistry = resolve(process.cwd(), 'config', 'source-registry.md');
  const root = existsSync(cwdRegistry) ? process.cwd() : scriptRoot;
  const registry = loadSourceRegistry(root);
  const opts = parseArgs(process.argv.slice(2), registry);

  if (opts.provider === 'derive-source') {
    const source = deriveSourceFromUrl(opts.slug, { registry });
    if (opts.json) console.log(JSON.stringify({ url: opts.slug, source }, null, 2));
    else console.log(source);
    return;
  }

  const profile = profileHints(opts.profile, root);
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

  const { readFileSync } = await import('node:fs');
  const payload = opts.file ? JSON.parse(readFileSync(resolve(opts.file), 'utf8')) : await fetchPayload(opts.provider, opts.slug, fetch, { timeoutMs: Number(opts.timeout) });
  const roles = filterRolesWithOptions(normalizeRoles(opts.provider, opts.slug, payload), options)
    .map(({ raw, ...role }) => ({ ...role, profileHints: profile.hints }));

  if (opts.json) console.log(JSON.stringify(roles, null, 2));
  else printTable(roles);
}

export { main };

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(`ats-probe: ${err.message}`);
    console.error('');
    usage();
    process.exit(1);
  });
}
