import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixtureDir } from './helpers/fixtures.js';

const root = new URL('..', import.meta.url).pathname;
const script = join(root, 'scripts', 'check-public.js');

function runCheck(fixture) {
  return spawnSync(process.execPath, [script, '--root', fixture], {
    encoding: 'utf8',
  });
}

function makeFixture() {
  const dir = makeFixtureDir('llm-job-tracker-public-check-');
  mkdirSync(join(dir, 'data', 'companies'), { recursive: true });
  mkdirSync(join(dir, 'candidate', 'cv'), { recursive: true });
  mkdirSync(join(dir, 'strategy', 'search-profiles'), { recursive: true });
  writeFileSync(join(dir, 'data', 'tracker.md'), '# Tracker\n');
  writeFileSync(join(dir, 'candidate', 'candidate.md'), '# Candidate\n');
  writeFileSync(join(dir, 'candidate', 'cv', 'cv-base.md'), '# CV\n');
  writeFileSync(join(dir, 'strategy', 'search-profiles', 'default.md'), '# Default profile\n');
  writeFileSync(join(dir, 'README.md'), '# Public fixture\n');
  return dir;
}

test('accepts a sanitized public fixture', () => {
  const fixture = makeFixture();
  const result = runCheck(fixture);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /check-public: ok/);
});

test('rejects forbidden public paths', () => {
  const fixture = makeFixture();
  mkdirSync(join(fixture, '.claude'));

  const result = runCheck(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /forbidden public path exists: \.claude/);
});

test('rejects live company artifacts', () => {
  const fixture = makeFixture();
  mkdirSync(join(fixture, 'data', 'companies', 'real-company'), { recursive: true });
  writeFileSync(join(fixture, 'data', 'companies', 'real-company', 'prep-notes.md'), '# Private notes\n');

  const result = runCheck(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /data\/companies must not contain live company artifacts/);
});

test('rejects private markers', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'README.md'), `Contact: ${'private'}@${'example.com'}\n`);

  const result = runCheck(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /private marker found/);
  assert.match(result.stderr, /private@example\.com/);
});

test('rejects stale architecture paths', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, 'README.md'), `Old docs mention ${'job-search'}/profile.md\n`);

  const result = runCheck(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /stale architecture path found/);
});

test('supports local private marker patterns', () => {
  const fixture = makeFixture();
  writeFileSync(join(fixture, '.public-scan-patterns.local'), 'SecretCandidate\n');
  writeFileSync(join(fixture, 'README.md'), 'SecretCandidate should never publish\n');

  const result = runCheck(fixture);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /local private marker found/);
});
