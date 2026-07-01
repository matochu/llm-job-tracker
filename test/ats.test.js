import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { clearRegistryCache, deriveSourceFromUrl, discoverBoards, discoverSlugCandidates, filterRoles, filterRolesWithOptions, getProviderIds, loadSourceRegistry, locationConfidence, normalizeRoles, probeBatch, profileHints, providerIds, providerUrl, rootDomain } from '../scripts/ats-probe.js';
import { parseSourceRegistryRaw } from '../scripts/lib/source-registry.js';
import { makeFixtureDir } from './helpers/fixtures.js';

const root = new URL('..', import.meta.url).pathname;
const atsProbeScript = join(root, 'scripts', 'ats-probe.js');

test('loads provider and search defaults from source registry config', () => {
  const registry = loadSourceRegistry(root);

  assert.deepEqual(getProviderIds(root), registry.providerIds);
  assert.ok(registry.providerIds.includes('ashby'));
  assert.ok(providerIds.includes('ashby'));
  assert.ok(registry.keywords.includes('frontend'));
  assert.ok(registry.locations.includes('europe'));
  assert.match(registry.providerFeeds.get('smartrecruiters'), /\[limit\].*\[offset\]/);
});

test('source registry loader fails with setup guidance when required discovery defaults are missing', () => {
  const fixture = makeFixtureDir('ats-probe-registry-');
  mkdirSync(join(fixture, 'config'), { recursive: true });
  writeFileSync(join(fixture, 'config', 'source-registry.md'), `# Source Registry

## ATS Probe Providers

| Provider | Source value | Host patterns | Discovery feed | Liveness policy |
|---|---|---|---|---|
| \`ashby\` | \`ashby\` | \`jobs.ashbyhq.com\` | \`https://api.ashbyhq.com/posting-api/job-board/[slug]\` | browser |
`);

  assert.throws(
    () => loadSourceRegistry(fixture),
    /Run job-tracker:setup to fill source registry settings/,
  );
});

test('deriveSourceFromUrl uses source registry exact, wildcard, and root-domain fallback rules', () => {
  assert.equal(deriveSourceFromUrl('https://jobs.ashbyhq.com/acme/123'), 'ashby');
  assert.equal(deriveSourceFromUrl('https://job-boards.greenhouse.io/acme/jobs/42'), 'greenhouse');
  assert.equal(deriveSourceFromUrl('https://job-boards.eu.greenhouse.io/acme/jobs/42'), 'greenhouse');
  assert.equal(deriveSourceFromUrl('https://acme.recruitee.com/o/frontend'), 'recruitee');
  assert.equal(deriveSourceFromUrl('https://careers.example.co.uk/jobs/1'), 'example');
});

test('derive-source CLI uses the configured source derivation helper', () => {
  const result = spawnSync(process.execPath, [atsProbeScript, 'derive-source', 'https://djinni.co/jobs/123'], {
    cwd: tmpdir(),
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'djinni');
});

const samples = {
  ashby: {
    jobs: [{ title: 'Senior Frontend Engineer', location: 'Remote Europe', id: 'ash-1', jobUrl: 'https://jobs.ashbyhq.com/acme/ash-1' }],
  },
  lever: [{
    text: 'Product Engineer, Frontend',
    categories: { location: 'Barcelona' },
    id: 'lev-1',
    hostedUrl: 'https://jobs.lever.co/acme/lev-1',
  }],
  greenhouse: {
    jobs: [{ title: 'Fullstack Platform Engineer', location: { name: 'Spain' }, id: 42, absolute_url: 'https://job-boards.greenhouse.io/acme/jobs/42' }],
  },
  workable: {
    jobs: [{ title: 'React Engineer', location: 'Remote', shortcode: 'ABC123', url: 'https://apply.workable.com/acme/j/ABC123' }],
  },
  recruitee: {
    offers: [{ title: 'Frontend Developer', location: 'Lisbon', id: 7, careers_url: 'https://acme.recruitee.com/o/frontend-developer' }],
  },
  smartrecruiters: {
    content: [{ name: 'TypeScript Frontend Engineer', location: { city: 'Madrid', country: 'Spain' }, id: 'sr-1', ref: 'https://jobs.smartrecruiters.com/Acme/sr-1' }],
  },
};

for (const [provider, payload] of Object.entries(samples)) {
  test(`normalizes ${provider} roles`, () => {
    const roles = normalizeRoles(provider, 'acme', payload);

    assert.equal(roles.length, 1);
    assert.equal(roles[0].provider, provider);
    assert.match(roles[0].title, /Frontend|Product|Fullstack|React|TypeScript/);
    assert.match(roles[0].url, /^https:\/\//);
  });
}

test('filters by frontend keywords and EU-compatible locations', () => {
  const roles = normalizeRoles('lever', 'acme', [
    { text: 'Backend Engineer', categories: { location: 'New York' }, hostedUrl: 'https://jobs.lever.co/acme/backend' },
    { text: 'Frontend Platform Engineer', categories: { location: 'Remote Europe' }, hostedUrl: 'https://jobs.lever.co/acme/frontend' },
  ]);

  assert.deepEqual(filterRoles(roles).map((role) => role.title), ['Frontend Platform Engineer']);
});

test('--json role shape excludes raw payload fields after CLI mapping contract', () => {
  const role = filterRoles(normalizeRoles('ashby', 'acme', samples.ashby))[0];
  const { raw, ...jsonRole } = role;

  assert.deepEqual(Object.keys(jsonRole).sort(), ['company', 'id', 'location', 'provider', 'title', 'url']);
  assert.equal(raw.title, 'Senior Frontend Engineer');
});

test('discoverSlugCandidates derives compact and dashed slugs from domains and names', () => {
  assert.deepEqual(discoverSlugCandidates('https://www.langfuse.com/careers'), ['langfuse']);
  assert.deepEqual(discoverSlugCandidates('Acme Labs GmbH'), ['acmelabs', 'acme-labs']);
});

test('rootDomain handles common careers subdomains and compound public suffixes', () => {
  assert.equal(rootDomain('careers.acme.co.uk'), 'acme');
  assert.equal(rootDomain('jobs.company.com'), 'company');
  assert.equal(rootDomain('www.langfuse.com'), 'langfuse');
});

test('discoverBoards probes provider/slug candidates and returns filtered roles', async () => {
  const fetcher = async (url) => {
    if (!url.includes('/posting-api/job-board/acme')) {
      return { ok: false, status: 404, statusText: 'Not Found', text: async () => 'not found' };
    }
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({
        jobs: [
          { title: 'Senior Frontend Engineer', location: 'Remote Europe', id: '1', jobUrl: 'https://jobs.ashbyhq.com/acme/1' },
          { title: 'Backend Engineer', location: 'New York', id: '2', jobUrl: 'https://jobs.ashbyhq.com/acme/2' },
        ],
      }),
    };
  };

  const results = await discoverBoards('Acme', {
    providers: ['ashby'],
    slugCandidates: ['wrong', 'acme'],
    fetcher,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].provider, 'ashby');
  assert.equal(results[0].slug, 'acme');
  assert.equal(results[0].count, 1);
  assert.equal(results[0].roles[0].title, 'Senior Frontend Engineer');
});

test('probeBatch probes multiple slugs without shell loops or jq', async () => {
  const fetcher = async (url) => {
    const slug = url.match(/job-board\/([^?]+)/)?.[1] ?? 'unknown';
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({
        jobs: [
          { title: `${slug} Frontend Engineer`, location: 'Remote Europe', id: `${slug}-1`, jobUrl: `https://jobs.ashbyhq.com/${slug}/1` },
          { title: `${slug} Backend Engineer`, location: 'Remote Europe', id: `${slug}-2`, jobUrl: `https://jobs.ashbyhq.com/${slug}/2` },
        ],
      }),
    };
  };

  const results = await probeBatch('ashby', ['acme', 'beta'], {
    fetcher,
    titleRegex: 'frontend',
    limit: 1,
  });

  assert.deepEqual(results.map((result) => result.slug), ['acme', 'beta']);
  assert.deepEqual(results.map((result) => result.count), [1, 1]);
  assert.equal(results[0].roles[0].title, 'acme Frontend Engineer');
});

test('strict location rejects missing-location role without description geo signal', () => {
  const roles = normalizeRoles('ashby', 'acme', {
    jobs: [
      { title: 'Senior Frontend Engineer', id: '1', jobUrl: 'https://jobs.ashbyhq.com/acme/1', description: 'Based in New York' },
      { title: 'Senior Frontend Engineer', id: '2', jobUrl: 'https://jobs.ashbyhq.com/acme/2', description: 'Remote Europe' },
    ],
  });

  assert.deepEqual(filterRolesWithOptions(roles, { strictLocation: true }).map((role) => role.id), ['2']);
  assert.equal(locationConfidence(roles[0]).confidence, 'missing');
  assert.equal(locationConfidence(roles[1]).confidence, 'description');
});

test('profileHints extracts configured search signals without making fit decisions', () => {
  const hints = profileHints('default', root);

  assert.equal(hints.slug, 'default');
  assert.ok(Array.isArray(hints.keywords));
});

test('location filter blocks Remote - US despite remote keyword', () => {
  const roles = normalizeRoles('ashby', 'acme', {
    jobs: [
      { title: 'Senior Frontend Engineer', location: 'Remote - US', id: '1', jobUrl: 'https://jobs.ashbyhq.com/acme/1' },
      { title: 'Senior Frontend Engineer', location: 'Remote Europe', id: '2', jobUrl: 'https://jobs.ashbyhq.com/acme/2' },
    ],
  });

  assert.deepEqual(filterRolesWithOptions(roles).map((role) => role.id), ['2']);
  assert.equal(locationConfidence(roles[0]).confidence, 'mismatch');
});

test('SmartRecruiters pagination combines multiple pages', async () => {
  const fetcher = async (url) => {
    const parsed = new URL(url);
    const offset = Number(parsed.searchParams.get('offset'));
    const content = offset === 0
      ? [{ name: 'Frontend Engineer', location: { country: 'Spain' }, id: '1', ref: 'https://jobs.smartrecruiters.com/Acme/1' }]
      : [{ name: 'React Platform Engineer', location: { country: 'Spain' }, id: '2', ref: 'https://jobs.smartrecruiters.com/Acme/2' }];
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ totalFound: 2, content }),
    };
  };

  const results = await discoverBoards('Acme', {
    providers: ['smartrecruiters'],
    slugCandidates: ['acme'],
    fetcher,
  });

  assert.equal(results[0].count, 2);
});

test('Workable markdown feed parsing is covered through discovery', async () => {
  const fetcher = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    text: async () => '[Frontend Engineer](https://apply.workable.com/acme/j/ABC123) - Remote Europe',
  });

  const results = await discoverBoards('Acme', {
    providers: ['workable'],
    slugCandidates: ['acme'],
    fetcher,
  });

  assert.equal(results[0].roles[0].title, 'Frontend Engineer');
});

test('fetch timeout is returned as an error entry, not silently dropped', async () => {
  const fetcher = async (_url, options = {}) => new Promise((_resolve, reject) => {
    options.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });

  const results = await discoverBoards('Acme', {
    providers: ['ashby'],
    slugCandidates: ['acme'],
    fetcher,
    timeoutMs: 1,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].provider, 'ashby');
  assert.equal(results[0].count, 0);
  assert.ok(results[0].error, 'error field is set');
});

test('providerUrl interpolates [slug], [limit], [offset] with defaults', () => {
  const registry = loadSourceRegistry(root);

  const ashbyUrl = providerUrl('ashby', 'acme corp', { registry });
  assert.ok(ashbyUrl.includes('acme%20corp'), 'slug is URL-encoded');
  assert.ok(!ashbyUrl.includes('[slug]'), '[slug] is replaced');

  const srUrl = providerUrl('smartrecruiters', 'acme', { registry });
  assert.ok(srUrl.includes('100'), 'default limit=100 applied');
  assert.ok(srUrl.includes('0') && !srUrl.includes('[offset]'), 'default offset=0 applied');

  const srCustomUrl = providerUrl('smartrecruiters', 'acme', { registry, limit: 25, offset: 50 });
  assert.ok(srCustomUrl.includes('25'), 'custom limit applied');
  assert.ok(srCustomUrl.includes('50'), 'custom offset applied');
});

test('providerUrl throws for unknown provider', () => {
  const registry = loadSourceRegistry(root);
  assert.throws(
    () => providerUrl('nonexistent', 'acme', { registry }),
    /missing a discovery feed/,
  );
});

test('parseSourceRegistryRaw parses providers, keywords, locations, sourceDerivation, and browserRequiredSources', () => {
  const markdown = `# Source Registry

## ATS Probe Providers

| Provider | Source value | Host patterns | Discovery feed | Liveness policy |
|---|---|---|---|---|
| \`ashby\` | \`ashby\` | \`jobs.ashbyhq.com\` | \`https://api.ashbyhq.com/posting-api/job-board/[slug]\` | browser |
| \`lever\` | \`lever\` | \`jobs.lever.co\` | \`https://api.lever.co/v0/postings/[slug]?mode=json\` | browser |

## ATS Probe Search Defaults

### Keywords

- frontend
- react

### Locations

- europe
- remote

## Browser-Required Sources

| Source value | Host patterns / URLs | Why browser is required | Required access | Policy |
|---|---|---|---|---|
| \`linkedin\` | \`*.linkedin.com\` | login | Playwright MCP with the user's logged-in account/session | never use web search as a substitute |
| \`djinni\` | \`djinni.co\` | login | Playwright MCP with the user's logged-in account/session | never use web search as a substitute |

## Source Derivation

| Host pattern | Source value |
|---|---|
| \`jobs.ashbyhq.com\` | \`ashby\` |
| \`djinni.co\` | \`djinni\` |
`;

  const result = parseSourceRegistryRaw(markdown);

  assert.deepEqual(result.providerIds, ['ashby', 'lever']);
  assert.equal(result.providerFeeds.get('ashby'), 'https://api.ashbyhq.com/posting-api/job-board/[slug]');
  assert.deepEqual(result.keywords, ['frontend', 'react']);
  assert.deepEqual(result.locations, ['europe', 'remote']);
  assert.equal(result.sourceDerivation.length, 2);
  assert.deepEqual(result.sourceDerivation[0], { pattern: 'jobs.ashbyhq.com', source: 'ashby' });
  assert.equal(result.browserRequiredSources.length, 2);
  assert.equal(result.browserRequiredSources[0].source, 'linkedin');
  assert.deepEqual(result.browserRequiredSources[0].hostPatterns, ['*.linkedin.com']);
  assert.equal(result.browserRequiredSources[1].source, 'djinni');
});

test('loadSourceRegistry memoizes by root — second call returns same object', () => {
  const a = loadSourceRegistry(root);
  const b = loadSourceRegistry(root);
  assert.equal(a, b, 'same reference returned from cache');
  clearRegistryCache();
  const c = loadSourceRegistry(root);
  assert.notEqual(a, c, 'fresh load after cache clear');
});
