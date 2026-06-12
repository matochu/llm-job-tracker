import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const root = new URL('..', import.meta.url).pathname;
const bin = join(root, 'bin', 'job-tracker.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
  });
}

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), 'llm-job-tracker-test-'));
}

test('prints help', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /npx llm-job-tracker <target-dir>/);
});

test('scaffolds a workspace without install', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /LLM job tracker workspace created:/);
  assert.equal(existsSync(join(target, 'config', 'settings.md')), true);
  assert.equal(existsSync(join(target, 'candidate', 'candidate.md')), true);
  assert.equal(existsSync(join(target, 'candidate', 'cv', 'cv-base.md')), true);
  assert.equal(existsSync(join(target, 'strategy', 'search-profiles', 'default.md')), true);
  assert.equal(existsSync(join(target, 'data', 'tracker.md')), true);
  assert.equal(existsSync(join(target, 'skills', 'job-setup', 'SKILL.md')), true);
  assert.equal(existsSync(join(target, 'scripts', 'install.sh')), true);
  assert.equal(existsSync(join(target, 'scripts', 'check-public.js')), false);

  const gitignore = readFileSync(join(target, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.sessions\/$/m);
});

test('refuses a non-empty target without --force', () => {
  const target = makeTempDir();
  writeFileSync(join(target, 'existing.txt'), 'keep me');

  const result = runCli([target, '--no-install']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Target directory is not empty/);
  assert.deepEqual(readdirSync(target), ['existing.txt']);
});

test('allows a non-empty target with --force', () => {
  const target = makeTempDir();
  writeFileSync(join(target, 'existing.txt'), 'keep me');

  const result = runCli([target, '--no-install', '--force']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'existing.txt')), true);
  assert.equal(existsSync(join(target, 'config', 'settings.md')), true);
});

test('creates missing parent directories', () => {
  const parent = makeTempDir();
  const target = join(parent, 'nested', 'workspace');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'START_HERE.md')), true);
});
