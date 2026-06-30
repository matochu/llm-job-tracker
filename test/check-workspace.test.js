import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = new URL('..', import.meta.url).pathname;
const script = join(root, 'scripts', 'check-workspace.js');

function runCheck(fixture) {
  return spawnSync(process.execPath, [script, '--root', fixture], {
    encoding: 'utf8',
  });
}

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'llm-job-tracker-workspace-check-'));
  mkdirSync(join(dir, 'config'), { recursive: true });
  mkdirSync(join(dir, 'strategy', 'search-profiles'), { recursive: true });
  mkdirSync(join(dir, 'candidate', 'cv'), { recursive: true });
  mkdirSync(join(dir, 'data', 'companies'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });

  writeFileSync(join(dir, '.gitignore'), '.sessions/\n');
  writeFileSync(join(dir, 'config', 'settings.md'), 'Active profile: `default`\n');
  writeFileSync(join(dir, 'config', 'tracker-schema.md'), `# Tracker Schema

## CLI Schema Aliases

### Field Aliases

| Canonical | Labels |
|---|---|
| \`company\` | \`Company\` |
| \`profile\` | \`Profile\` |
| \`role\` | \`Role\`, \`Position\` |
| \`url\` | \`URL\`, \`Url\`, \`Link\`, \`Links\` |
| \`status\` | \`Status\` |
`);
  writeFileSync(join(dir, 'config', 'source-registry.md'), `# Source Registry

## ATS Probe Providers

| Provider | Source value | Host patterns | Discovery feed | Liveness policy |
|---|---|---|---|---|
| \`ashby\` | \`ashby\` | \`jobs.ashbyhq.com\` | \`https://api.ashbyhq.com/posting-api/job-board/[slug]\` | browser |
| \`lever\` | \`lever\` | \`jobs.lever.co\` | \`https://api.lever.co/v0/postings/[slug]?mode=json\` | browser |
| \`greenhouse\` | \`greenhouse\` | \`*.greenhouse.io\` | \`https://api.greenhouse.io/v1/boards/[slug]/jobs?content=true\` | browser |
| \`workable\` | \`workable\` | \`apply.workable.com\` | \`https://apply.workable.com/[slug]/jobs.md\` | browser |
| \`recruitee\` | \`recruitee\` | \`*.recruitee.com\` | \`https://[slug].recruitee.com/api/offers/\` | browser |
| \`smartrecruiters\` | \`smartrecruiters\` | \`*.smartrecruiters.com\` | \`https://api.smartrecruiters.com/v1/companies/[slug]/postings?limit=[limit]&offset=[offset]&status=PUBLIC\` | browser |

## ATS Probe Search Defaults

### Keywords

- frontend

### Locations

- europe

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
`);
  writeFileSync(join(dir, 'scripts', 'ats-probe.js'), `export function normalizeRoles(provider) {
  const mapper = {
    ashby: roleFromAshby,
    lever: roleFromLever,
    greenhouse: roleFromGreenhouse,
    workable: roleFromWorkable,
    recruitee: roleFromRecruitee,
    smartrecruiters: roleFromSmartRecruiters,
  }[provider];
  return mapper;
}
`);
  writeFileSync(join(dir, 'strategy', 'search-profiles', 'default.md'), '# Default profile\n');
  writeFileSync(join(dir, 'candidate', 'cv', 'cv-base.md'), '# Base CV\n');
  writeFileSync(join(dir, 'data', 'tracker.md'), `# Tracker\n\n| Company | Profile | Role | Link | Status |\n|---|---|---|---|---|\n| Example | default | Engineer | https://example.com/job | Raw Pipeline |\n`);

  return dir;
}

test('accepts a healthy workspace fixture', () => {
  const fixture = makeFixture();
  const result = runCheck(fixture);

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /No workspace integrity issues detected/);
});

test('rejects tracker rows without Profile', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'data', 'tracker.md'), `# Tracker\n\n| Company | Profile | Role | Link | Status |\n|---|---|---|---|---|\n| Example |  | Engineer | https://example.com/job | Raw Pipeline |\n`);

  const result = runCheck(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /missing Profile value/);
});

test('rejects unknown tracker profiles', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'data', 'tracker.md'), `# Tracker\n\n| Company | Profile | Role | Link | Status |\n|---|---|---|---|---|\n| Example | missing | Engineer | https://example.com/job | Raw Pipeline |\n`);

  const result = runCheck(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /unknown Profile `missing`/);
});

test('warns on duplicate URLs without failing', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'data', 'tracker.md'), `# Tracker\n\n| Company | Profile | Role | Link | Status |\n|---|---|---|---|---|\n| Example | default | Engineer | https://example.com/job | Raw Pipeline |\n| Other | default | Engineer | https://example.com/job | Raw Pipeline |\n`);

  const result = runCheck(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /WARNING \(1\)/);
  assert.match(result.stdout, /duplicate URL appears 2 times/);
});

test('warns when tracker schema aliases are missing', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'config', 'tracker-schema.md'), '# Tracker Schema\n');

  const result = runCheck(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /missing `## CLI Schema Aliases`/);
});

test('rejects missing source registry', () => {
  const fixture = makeFixture();
  rmSync(join(fixture, 'config', 'source-registry.md'));

  const result = runCheck(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /config\/source-registry\.md is missing/);
});

test('rejects ATS provider registry drift', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'config', 'source-registry.md'), `# Source Registry

## ATS Probe Providers

| Provider | Source value |
|---|---|
| \`ashby\` | \`ashby\` |

## Browser-Required Sources

| Source value | Host patterns / URLs |
|---|---|
| \`djinni\` | \`djinni.co\` |

## Source Derivation

| Host pattern | Source value |
|---|---|
| \`djinni.co\` | \`djinni\` |
`);

  const result = runCheck(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /ATS providers .* do not match scripts\/ats-probe\.js implemented providers/);
});

test('rejects source registry without Djinni browser policy and source derivation', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'config', 'source-registry.md'), `# Source Registry

## ATS Probe Providers

| Provider | Source value |
|---|---|
| \`ashby\` | \`ashby\` |
| \`lever\` | \`lever\` |
| \`greenhouse\` | \`greenhouse\` |
| \`workable\` | \`workable\` |
| \`recruitee\` | \`recruitee\` |
| \`smartrecruiters\` | \`smartrecruiters\` |

## Browser-Required Sources

| Source value | Host patterns / URLs |
|---|---|
| \`linkedin\` | \`*.linkedin.com\` |

## Source Derivation

| Host pattern | Source value |
|---|---|
| \`jobs.ashbyhq.com\` | \`ashby\` |
`);

  const result = runCheck(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /must define Djinni as browser-required/);
});

test('rejects LinkedIn or Djinni policy without Playwright user account session', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'config', 'source-registry.md'), `# Source Registry

## ATS Probe Providers

| Provider | Source value |
|---|---|
| \`ashby\` | \`ashby\` |
| \`lever\` | \`lever\` |
| \`greenhouse\` | \`greenhouse\` |
| \`workable\` | \`workable\` |
| \`recruitee\` | \`recruitee\` |
| \`smartrecruiters\` | \`smartrecruiters\` |

## Browser-Required Sources

| Source value | Host patterns / URLs | Why browser is required | Policy |
|---|---|---|---|
| \`linkedin\` | \`*.linkedin.com\` | login | open in browser |
| \`djinni\` | \`djinni.co\` | login | open in browser |

## Source Derivation

| Host pattern | Source value |
|---|---|
| \`jobs.ashbyhq.com\` | \`ashby\` |
| \`djinni.co\` | \`djinni\` |
`);

  const result = runCheck(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /must require Playwright MCP with the user's logged-in account\/session for `linkedin`/);
  assert.match(result.stdout, /must require Playwright MCP with the user's logged-in account\/session for `djinni`/);
});

test('rejects tracker headers not covered by configured schema aliases', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'data', 'tracker.md'), `# Tracker\n\n| Org | Profile | Role | Link | Status |\n|---|---|---|---|---|\n| Example | default | Engineer | https://example.com/job | Raw Pipeline |\n`);

  const result = runCheck(fixture);

  assert.equal(result.status, 1);
  assert.match(result.stdout, /no configured Company column/);
  assert.match(result.stdout, /add the company header label to config\/tracker-schema.md/);
});

test('warns on malformed session reports', () => {
  const fixture = makeFixture();
  mkdirSync(join(fixture, '.sessions', 'reports'), { recursive: true });
  writeFileSync(join(fixture, '.sessions', 'reports', 'bad-name.md'), '# Bad report\n');

  const result = runCheck(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Session Report filename should be \[id\]\.<skill>\.md/);
});

test('accepts well-formed import session reports', () => {
  const fixture = makeFixture();
  mkdirSync(join(fixture, '.sessions', 'reports'), { recursive: true });
  const id = '2026-06-14T120000';
  const content = [
    '# Session Report',
    '',
    `- ID: ${id}`,
    '- Skill: job-tracker:import',
    '- Status: done',
    '',
    '## Goal',
    '## Plan',
    '## Progress',
    '## Decisions',
    '## Blockers',
    '## Resume Point',
    '## Tracker Updates',
    '## Files Changed',
    '## Artifacts',
    '## Agent Insights',
    '## Summary',
  ].join('\n');
  writeFileSync(join(fixture, '.sessions', 'reports', `${id}.import.md`), content);

  const result = runCheck(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /Session Report filename should be/);
  assert.doesNotMatch(result.stdout, /unfinished Session Report/);
});

test('does not warn on blocked import session reports', () => {
  const fixture = makeFixture();
  mkdirSync(join(fixture, '.sessions', 'reports'), { recursive: true });
  const id = '2026-06-14T130000';
  const content = [
    '# Session Report',
    '',
    `- ID: ${id}`,
    '- Skill: job-tracker:import',
    '- Status: blocked',
    '',
    '## Goal',
    '## Plan',
    '## Progress',
    '## Decisions',
    '## Blockers',
    '## Resume Point',
    '## Tracker Updates',
    '## Files Changed',
    '## Artifacts',
    '## Agent Insights',
    '## Summary',
  ].join('\n');
  writeFileSync(join(fixture, '.sessions', 'reports', `${id}.import.md`), content);

  const result = runCheck(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /unfinished Session Report/);
});

test('warns on orphan company directories', () => {
  const fixture = makeFixture();
  mkdirSync(join(fixture, 'data', 'companies', 'orphan'), { recursive: true });

  const result = runCheck(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /data\/companies\/orphan\/ exists but no matching tracker company slug was detected/);
  assert.match(result.stdout, /data\/companies\/orphan\/prep-notes\.md is missing/);
});
