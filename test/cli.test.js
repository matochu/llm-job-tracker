import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeFixtureDir } from './helpers/fixtures.js';

const root = new URL('..', import.meta.url).pathname;
const bin = join(root, 'bin', 'job-tracker.js');

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
  });
}

function makeTempDir() {
  return makeFixtureDir('llm-job-tracker-test-');
}

test('prints help', () => {
  const result = runCli(['--help']);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /npx llm-job-tracker \[target-dir\]/);
});

test('scaffolds a workspace without install', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /LLM job tracker workspace initialized:/);
  assert.equal(existsSync(join(target, 'config', 'settings.md')), true);
  assert.equal(existsSync(join(target, 'candidate', 'candidate.md')), true);
  assert.equal(existsSync(join(target, 'candidate', 'cv', 'cv-base.md')), true);
  assert.equal(existsSync(join(target, 'strategy', 'search-profiles', 'default.md')), true);
  assert.equal(existsSync(join(target, 'data', 'tracker.md')), true);
  assert.equal(existsSync(join(target, 'skills', 'setup', 'SKILL.md')), true);
  assert.equal(existsSync(join(target, 'scripts', 'install.js')), true);
  assert.equal(existsSync(join(target, 'scripts', 'check-public.js')), false);

  const gitignore = readFileSync(join(target, '.gitignore'), 'utf8');
  assert.match(gitignore, /^\.sessions\/$/m);
});

test('refuses a non-empty target without --force', () => {
  const target = makeTempDir();
  writeFileSync(join(target, 'existing.txt'), 'keep me');

  const result = runCli([target, '--no-install']);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Target directory is not empty and is not a job-tracker workspace/);
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


test('installs local agent integrations with JS installer', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');

  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);

  const result = spawnSync(process.execPath, ['scripts/install.js', 'all', '--copy'], {
    cwd: target,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /job-tracker:setup/);
  assert.equal(existsSync(join(target, 'CLAUDE.md')), true);
  assert.equal(existsSync(join(target, 'AGENTS.md')), true);
  assert.equal(existsSync(join(target, '.claude', 'skills', 'setup', 'SKILL.md')), true);
  assert.equal(existsSync(join(target, '.claude', 'settings.json')), true);
  assert.equal(existsSync(join(target, '.codex', 'skills', 'setup', 'SKILL.md')), true);
  assert.equal(existsSync(join(target, '.codex', 'hooks.json')), true);
  assert.equal(existsSync(join(target, '.codex', 'rules', 'default.rules')), true);
});


test('defaults to current directory for init', () => {
  const target = makeTempDir();

  const result = runCli(['--no-install'], { cwd: target });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /workspace initialized/);
  assert.equal(existsSync(join(target, 'config', 'settings.md')), true);
  assert.equal(existsSync(join(target, 'scripts', 'install.js')), true);
});

test('updates an existing workspace by default and preserves protected files', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);

  writeFileSync(join(target, 'config', 'settings.md'), 'PRIVATE SETTINGS\n');
  writeFileSync(join(target, 'config', 'tracker-schema.md'), 'PRIVATE TRACKER SCHEMA\n');
  writeFileSync(join(target, 'candidate', 'candidate.md'), 'PRIVATE CANDIDATE\n');
  writeFileSync(join(target, 'skills', 'setup', 'SKILL.md'), 'OLD MANAGED SKILL\n');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /workspace updated/);
  assert.match(result.stdout, /job-tracker:health/);
  assert.doesNotMatch(result.stdout, /job-tracker:setup/);
  assert.equal(readFileSync(join(target, 'config', 'settings.md'), 'utf8'), 'PRIVATE SETTINGS\n');
  assert.equal(readFileSync(join(target, 'config', 'tracker-schema.md'), 'utf8'), 'PRIVATE TRACKER SCHEMA\n');
  assert.equal(readFileSync(join(target, 'candidate', 'candidate.md'), 'utf8'), 'PRIVATE CANDIDATE\n');
  assert.notEqual(readFileSync(join(target, 'skills', 'setup', 'SKILL.md'), 'utf8'), 'OLD MANAGED SKILL\n');
});

test('update dry-run does not write files', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  writeFileSync(join(target, 'skills', 'setup', 'SKILL.md'), 'OLD MANAGED SKILL\n');

  const result = runCli(['update', target, '--dry-run']);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /update skills/);
  assert.match(result.stdout, /preserve candidate/);
  assert.match(result.stdout, /After update, run: job-tracker:health/);
  assert.doesNotMatch(result.stdout, /job-tracker:setup/);
  assert.equal(readFileSync(join(target, 'skills', 'setup', 'SKILL.md'), 'utf8'), 'OLD MANAGED SKILL\n');
});

test('explicit update refuses a non-workspace target', () => {
  const target = makeTempDir();
  writeFileSync(join(target, 'file.txt'), 'not a workspace');

  const result = runCli(['update', target]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to update non-workspace target/);
});


test('removes stale managed files during update', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  writeFileSync(join(target, 'scripts', 'install.sh'), 'old shell installer');
  writeFileSync(join(target, 'scripts', 'llm-hooks', 'pre_tool_guard.py'), 'old python hook');

  const result = runCli(['update', target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'scripts', 'install.sh')), false);
  assert.equal(existsSync(join(target, 'scripts', 'llm-hooks', 'pre_tool_guard.py')), false);
});

test('installer updates Claude hooks while preserving local permissions', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  mkdirSync(join(target, '.claude'), { recursive: true });
  writeFileSync(join(target, '.claude', 'settings.json'), JSON.stringify({
    permissions: { allow: ['WebSearch'] },
    hooks: { PreToolUse: [] },
  }, null, 2));

  const result = spawnSync(process.execPath, ['scripts/install.js', 'claude', '--copy'], {
    cwd: target,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const settings = JSON.parse(readFileSync(join(target, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(settings.permissions, { allow: ['WebSearch'] });
  assert.match(JSON.stringify(settings.hooks), /pre-tool-guard\.js/);
});

test('init writes installed version to config/.installed-version', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  const versionFile = join(target, 'config', '.installed-version');
  assert.equal(existsSync(versionFile), true);
  assert.match(readFileSync(versionFile, 'utf8'), /^\d+\.\d+\.\d+$/);
});

test('update overwrites installed version', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  writeFileSync(join(target, 'config', '.installed-version'), '0.0.1');

  const result = runCli(['update', target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  const written = readFileSync(join(target, 'config', '.installed-version'), 'utf8');
  assert.notEqual(written, '0.0.1');
  assert.match(written, /^\d+\.\d+\.\d+$/);
});

test('update dry-run does not overwrite installed version', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  writeFileSync(join(target, 'config', '.installed-version'), '0.0.1');

  const result = runCli(['update', target, '--dry-run']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(target, 'config', '.installed-version'), 'utf8'), '0.0.1');
});

test('init copies cv.css and does not copy resume.css', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'scripts', 'cv.css')), true);
  assert.equal(existsSync(join(target, 'scripts', 'resume.css')), false);
});

test('update preserves legacy resume.css for health migration when cv.css is missing', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  rmSync(join(target, 'scripts', 'cv.css'));
  writeFileSync(join(target, 'scripts', 'resume.css'), 'old css');

  const result = runCli(['update', target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(target, 'scripts', 'resume.css'), 'utf8'), 'old css');
  assert.equal(existsSync(join(target, 'scripts', 'cv.css')), false);
});

test('update does not overwrite user-modified cv.css', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  writeFileSync(join(target, 'scripts', 'cv.css'), '/* my custom css */');

  const result = runCli(['update', target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(target, 'scripts', 'cv.css'), 'utf8'), '/* my custom css */');
});

test('init scaffolds candidate/application-answers.md', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'candidate', 'application-answers.md')), true);
  const content = readFileSync(join(target, 'candidate', 'application-answers.md'), 'utf8');
  assert.match(content, /Application Answer Bank/);
  assert.match(content, /Profile/);
});

test('update preserves user-modified candidate/application-answers.md', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  writeFileSync(join(target, 'candidate', 'application-answers.md'), '# My custom answers\n');

  const result = runCli(['update', target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(target, 'candidate', 'application-answers.md'), 'utf8'), '# My custom answers\n');
});

test('init scaffolds config/source-registry.md', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'config', 'source-registry.md')), true);
  const content = readFileSync(join(target, 'config', 'source-registry.md'), 'utf8');
  assert.match(content, /Source Registry/);
  assert.match(content, /ATS Probe Providers/);
  assert.match(content, /ATS Probe Search Defaults/);
});

test('update removes stale skill directories from workspace skills/', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  mkdirSync(join(target, 'skills', 'job-run'), { recursive: true });
  writeFileSync(join(target, 'skills', 'job-run', 'SKILL.md'), 'stale skill');

  const result = runCli(['update', target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'skills', 'job-run')), false);
  assert.equal(existsSync(join(target, 'skills', 'run', 'SKILL.md')), true);
});

test('install.js removes stale skill dirs from .claude/skills and .codex/skills', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);

  // Simulate stale dirs left over from a previous install (not in canonical skills/)
  const firstInstall = spawnSync(process.execPath, ['scripts/install.js', 'all', '--copy'], {
    cwd: target, encoding: 'utf8',
  });
  assert.equal(firstInstall.status, 0, firstInstall.stderr);
  mkdirSync(join(target, '.claude', 'skills', 'job-run'), { recursive: true });
  writeFileSync(join(target, '.claude', 'skills', 'job-run', 'SKILL.md'), 'stale');
  mkdirSync(join(target, '.codex', 'skills', 'job-run'), { recursive: true });
  writeFileSync(join(target, '.codex', 'skills', 'job-run', 'SKILL.md'), 'stale');

  const result = spawnSync(process.execPath, ['scripts/install.js', 'all', '--copy'], {
    cwd: target,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, '.claude', 'skills', 'job-run')), false);
  assert.equal(existsSync(join(target, '.codex', 'skills', 'job-run')), false);
  assert.equal(existsSync(join(target, '.claude', 'skills', 'run', 'SKILL.md')), true);
});

test('update seeds missing candidate/application-answers.md', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  // remove the seeded file to simulate missing state
  rmSync(join(target, 'candidate', 'application-answers.md'));

  const result = runCli(['update', target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'candidate', 'application-answers.md')), true);
});

test('update does not overwrite existing candidate/application-answers.md', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  writeFileSync(join(target, 'candidate', 'application-answers.md'), '# My answers\n');

  const result = runCli(['update', target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(target, 'candidate', 'application-answers.md'), 'utf8'), '# My answers\n');
});

test('update seeds missing config/source-registry.md without overwriting existing file', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  rmSync(join(target, 'config', 'source-registry.md'));

  const seedResult = runCli(['update', target, '--no-install']);

  assert.equal(seedResult.status, 0, seedResult.stderr);
  assert.equal(existsSync(join(target, 'config', 'source-registry.md')), true);

  writeFileSync(join(target, 'config', 'source-registry.md'), '# My source registry\n');
  const preserveResult = runCli(['update', target, '--no-install']);

  assert.equal(preserveResult.status, 0, preserveResult.stderr);
  assert.equal(readFileSync(join(target, 'config', 'source-registry.md'), 'utf8'), '# My source registry\n');
});

test('init writes config/.migrated-version equal to package version', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  const migratedFile = join(target, 'config', '.migrated-version');
  assert.equal(existsSync(migratedFile), true);
  const migratedVersion = readFileSync(migratedFile, 'utf8');
  const installedVersion = readFileSync(join(target, 'config', '.installed-version'), 'utf8');
  assert.equal(migratedVersion, installedVersion);
  assert.match(migratedVersion, /^\d+\.\d+\.\d+$/);
});

test('update does not change config/.migrated-version', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);
  writeFileSync(join(target, 'config', '.migrated-version'), '0.1.0');

  const result = runCli(['update', target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(readFileSync(join(target, 'config', '.migrated-version'), 'utf8'), '0.1.0');
});

test('init scaffolds migrations/0.3.0.md', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');

  const result = runCli([target, '--no-install']);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'migrations', '0.3.1.md')), true);
});

test('install.js defaults to all in non-TTY mode', () => {
  const parent = makeTempDir();
  const target = join(parent, 'workspace');
  const scaffold = runCli([target, '--no-install']);
  assert.equal(scaffold.status, 0, scaffold.stderr);

  const result = spawnSync(process.execPath, ['scripts/install.js', '--copy'], {
    cwd: target,
    encoding: 'utf8',
    input: '',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(existsSync(join(target, 'CLAUDE.md')), true);
  assert.equal(existsSync(join(target, 'AGENTS.md')), true);
});
