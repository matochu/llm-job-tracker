import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { addLead, bumpDate, listRows, moveRow, setSchemaRootFromTracker, setStatus, validateTracker } from '../scripts/tracker.js';

const root = new URL('..', import.meta.url).pathname;
const trackerCli = join(root, 'scripts', 'tracker.js');

function fixture() {
  return `# Tracker

Intro note stays.

## 🎯 Active Pipeline

| Company | Profile | Role | URL | Updated | Status | Source |
|---|---|---|---|---|---|---|
| Beta | frontend | Frontend Engineer | https://jobs.lever.co/beta/1 | 2026-06-01 | 🟢 active | lever |

## 🧪 Raw Pipeline

| Company | Profile | Role | URL | Added | Status | Source |
|---|---|---|---|---|---|---|
| Acme | frontend | Senior Frontend Engineer | https://jobs.ashbyhq.com/acme/1 | 2026-06-20 | ⬜ | ashby |

User note stays too.

## 🗄 Archive

| Company | Profile | Role | URL | Added | Status | Source |
|---|---|---|---|---|---|---|
`;
}

test('list returns rows for a section', () => {
  const rows = listRows(fixture(), 'raw');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].Company, 'Acme');
  assert.equal(rows[0].Status, '⬜');
});

test('addLead appends to Raw Pipeline with Profile after Company', () => {
  const next = addLead(fixture(), {
    company: 'Gamma',
    profile: 'frontend',
    role: 'React Engineer',
    url: 'https://apply.workable.com/gamma/j/123',
    source: 'workable',
    date: '2026-06-29',
  });

  const rows = listRows(next, 'raw');
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[1]).slice(0, 3), ['Company', 'Profile', 'Role']);
  assert.equal(rows[1].Company, 'Gamma');
  assert.equal(rows[1].Status, '⬜');
  assert.match(next, /Intro note stays/);
  assert.match(next, /User note stays too/);
});

test('move preserves profile URL and source while archiving with reason', () => {
  const next = moveRow(fixture(), {
    company: 'Acme',
    role: 'Senior Frontend Engineer',
    from: 'raw',
    to: 'archive',
    date: '2026-06-29',
    reason: 'closed',
  });

  assert.equal(listRows(next, 'raw').length, 0);
  const archived = listRows(next, 'archive')[0];
  assert.equal(archived.Company, 'Acme');
  assert.equal(archived.Profile, 'frontend');
  assert.equal(archived.URL, 'https://jobs.ashbyhq.com/acme/1');
  assert.equal(archived.Status, '2026-06-29: closed');
});

test('setStatus treats emoji status as opaque text', () => {
  const next = setStatus(fixture(), {
    company: 'Beta',
    role: 'Frontend Engineer',
    status: '🟡 unclear — cookie wall',
    date: '2026-06-29',
  });

  const row = listRows(next, 'active')[0];
  assert.equal(row.Status, '🟡 unclear — cookie wall');
  assert.equal(row.Updated, '2026-06-29');
});

test('bumpDate updates the requested date field only', () => {
  const next = bumpDate(fixture(), {
    company: 'Acme',
    role: 'Senior Frontend Engineer',
    field: 'Added',
    date: '2026-06-29',
  });

  assert.equal(listRows(next, 'raw')[0].Added, '2026-06-29');
});

test('ambiguous match refuses to update', () => {
  const ambiguous = fixture().replace(
    '| Acme | frontend | Senior Frontend Engineer | https://jobs.ashbyhq.com/acme/1 | 2026-06-20 | ⬜ | ashby |',
    '| Acme | frontend | Senior Frontend Engineer | https://jobs.ashbyhq.com/acme/1 | 2026-06-20 | ⬜ | ashby |\n| Acme | frontend | Senior Frontend Engineer | https://jobs.ashbyhq.com/acme/2 | 2026-06-21 | ⬜ | ashby |'
  );

  assert.throws(
    () => setStatus(ambiguous, { company: 'Acme', role: 'Senior Frontend Engineer', status: 'x' }),
    /Expected exactly one matching row/
  );
});

test('explicit URL disambiguates duplicate company and role', () => {
  const ambiguous = fixture().replace(
    '| Acme | frontend | Senior Frontend Engineer | https://jobs.ashbyhq.com/acme/1 | 2026-06-20 | ⬜ | ashby |',
    '| Acme | frontend | Senior Frontend Engineer | https://jobs.ashbyhq.com/acme/1 | 2026-06-20 | ⬜ | ashby |\n| Acme | frontend | Senior Frontend Engineer | https://jobs.ashbyhq.com/acme/2 | 2026-06-21 | ⬜ | ashby |'
  );
  const next = setStatus(ambiguous, {
    url: 'https://jobs.ashbyhq.com/acme/2',
    status: '🟢 active',
    date: '2026-06-29',
  });

  const rows = listRows(next, 'raw');
  assert.equal(rows[0].Status, '⬜');
  assert.equal(rows[1].Status, '🟢 active');
});

test('validateTracker reports duplicate URLs and table counts', () => {
  const duplicated = fixture().replace(
    'https://jobs.ashbyhq.com/acme/1',
    'https://jobs.lever.co/beta/1'
  );

  const result = validateTracker(duplicated);

  assert.equal(result.ok, true);
  assert.equal(result.tables, 3);
  assert.equal(result.rows, 2);
  assert.match(result.issues[0].message, /Duplicate URL/);
});

test('CLI dry-run prints updated tracker without writing file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-cli-test-'));
  const tracker = join(dir, 'tracker.md');
  writeFileSync(tracker, fixture());

  const result = spawnSync(process.execPath, [
    trackerCli,
    'set-status',
    '--tracker', tracker,
    '--company', 'Beta',
    '--role', 'Frontend Engineer',
    '--section', 'active',
    '--status', '🟢 still active',
    '--dry-run',
  ], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /🟢 still active/);
  assert.doesNotMatch(readFileSync(tracker, 'utf8'), /🟢 still active/);
});

test('CLI validate --json returns structured validation result', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-cli-test-'));
  const tracker = join(dir, 'tracker.md');
  writeFileSync(tracker, fixture());

  const result = spawnSync(process.execPath, [trackerCli, 'validate', '--tracker', tracker, '--json'], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  const parsed = JSON.parse(result.stdout);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.tables, 3);
});

function ukrainianFixture() {
  return `# Tracker

## 🎯 Активний пайплайн

| Компанія | Профіль | Роль | Локація | Fit | Pri | Статус | Контакт | Оновлено | Лінки |
|---|---|---|---|---|---|---|---|---|---|
| Acme | frontend | Senior Frontend Engineer | Remote Europe | 45 | P1 | active | referral | 2026-06-20 | [job](https://jobs.ashbyhq.com/acme/1) |

## 🗄 Архів

| Компанія | Профіль | Роль | Статус | Деталь |
|---|---|---|---|---|
`;
}

function useLocalizedTrackerSchema() {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-localized-schema-test-'));
  const configDir = join(dir, 'config');
  const dataDir = join(dir, 'data');
  mkdirSync(configDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(configDir, 'tracker-schema.md'), `# Tracker Schema

## CLI Schema Aliases

### Section Aliases

| Canonical | Labels |
|---|---|
| \`active\` | \`Активний пайплайн\` |
| \`archive\` | \`Архів\` |

### Field Aliases

| Canonical | Labels |
|---|---|
| \`company\` | \`Компанія\` |
| \`profile\` | \`Профіль\` |
| \`role\` | \`Роль\` |
| \`location\` | \`Локація\` |
| \`status\` | \`Статус\` |
| \`contact\` | \`Контакт\` |
| \`updated\` | \`Оновлено\` |
| \`url\` | \`Лінки\` |
| \`detail\` | \`Деталь\` |
`);
  const tracker = join(dataDir, 'tracker.md');
  setSchemaRootFromTracker(tracker);
  return tracker;
}

function resetTrackerSchema() {
  setSchemaRootFromTracker(join(root, 'data', 'tracker.md'));
}

test('setStatus and bumpDate work with Ukrainian sections and field aliases', () => {
  useLocalizedTrackerSchema();
  const statusUpdated = setStatus(ukrainianFixture(), {
    company: 'Acme',
    role: 'Senior Frontend Engineer',
    section: 'active',
    status: 'closed',
    date: '2026-06-29',
  });
  const row = listRows(statusUpdated, 'active')[0];
  assert.equal(row['Статус'], 'closed');
  assert.equal(row['Оновлено'], '2026-06-29');

  const dateUpdated = bumpDate(statusUpdated, {
    url: 'https://jobs.ashbyhq.com/acme/1',
    section: 'active',
    field: 'Оновлено',
    date: '2026-06-30',
  });
  assert.equal(listRows(dateUpdated, 'active')[0]['Оновлено'], '2026-06-30');
  resetTrackerSchema();
});

test('move maps Ukrainian active row into archive Detail without losing custom columns', () => {
  useLocalizedTrackerSchema();
  const next = moveRow(ukrainianFixture(), {
    url: 'https://jobs.ashbyhq.com/acme/1',
    from: 'active',
    to: 'archive',
    date: '2026-06-29',
    reason: 'closed',
  });

  const archived = listRows(next, 'archive')[0];
  assert.equal(archived['Компанія'], 'Acme');
  assert.equal(archived['Профіль'], 'frontend');
  assert.equal(archived['Статус'], '2026-06-29: closed');
  assert.match(archived['Деталь'], /Fit: 45/);
  assert.match(archived['Деталь'], /Контакт: referral/);
  assert.match(archived['Деталь'], /Лінки: \[job\]\(https:\/\/jobs\.ashbyhq\.com\/acme\/1\)/);
  resetTrackerSchema();
});

test('validate --strict exits non-zero on warnings', () => {
  const duplicated = fixture().replace(
    'https://jobs.ashbyhq.com/acme/1',
    'https://jobs.lever.co/beta/1'
  );
  const dir = mkdtempSync(join(tmpdir(), 'tracker-cli-test-'));
  const tracker = join(dir, 'tracker.md');
  writeFileSync(tracker, duplicated);

  const result = spawnSync(process.execPath, [trackerCli, 'validate', '--tracker', tracker, '--strict'], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Duplicate URL/);
});

test('setStatus matches first URL inside multi-link cell and bold company names', () => {
  const markdown = `# Tracker

## Active Pipeline

| Company | Profile | Role | Status | Updated | Links |
|---|---|---|---|---|---|
| **Ashby** | frontend | Staff Frontend Engineer | active | 2026-06-20 | [job](https://jobs.ashbyhq.com/ashby/123) · [prep](data/companies/ashby/prep-notes.md) · [cv](data/companies/ashby/resume.md) |
`;

  const byUrl = setStatus(markdown, {
    url: 'https://jobs.ashbyhq.com/ashby/123',
    status: 'closed',
    date: '2026-06-29',
  });
  assert.equal(listRows(byUrl, 'active')[0].Status, 'closed');

  const byCompany = setStatus(markdown, {
    company: 'Ashby',
    role: 'Staff Frontend Engineer',
    status: 'closed',
  });
  assert.equal(listRows(byCompany, 'active')[0].Status, 'closed');
});

test('CLI loads tracker schema aliases relative to --tracker path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-schema-root-test-'));
  const configDir = join(dir, 'config');
  const dataDir = join(dir, 'data');
  mkdirSync(configDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(configDir, 'tracker-schema.md'), `# Tracker Schema

## CLI Schema Aliases

### Section Aliases

| Canonical | Labels |
|---|---|
| \`active\` | \`Active Pipeline\`, \`Local Active\` |

### Field Aliases

| Canonical | Labels |
|---|---|
| \`company\` | \`Company\`, \`Org\` |
| \`profile\` | \`Profile\`, \`Track\` |
| \`role\` | \`Role\`, \`Seat\` |
| \`status\` | \`Status\`, \`State\` |
`);
  const tracker = join(dataDir, 'tracker.md');
  writeFileSync(tracker, `# Tracker

## Local Active

| Org | Track | Seat | State |
|---|---|---|---|
| Acme | frontend | Frontend Engineer | active |
`);

  const result = spawnSync(process.execPath, [
    trackerCli,
    'set-status',
    '--tracker', tracker,
    '--section', 'active',
    '--company', 'Acme',
    '--role', 'Frontend Engineer',
    '--status', 'closed',
  ], { cwd: root, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(tracker, 'utf8'), /closed/);
});

test('programmatic API can load schema aliases from explicit tracker path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tracker-programmatic-root-test-'));
  const configDir = join(dir, 'config');
  const dataDir = join(dir, 'data');
  mkdirSync(configDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(configDir, 'tracker-schema.md'), `# Tracker Schema

## CLI Schema Aliases

### Section Aliases

| Canonical | Local labels |
|---|---|
| \`active\` | \`Local Active\` |

### Field Aliases

| Canonical | Local labels |
|---|---|
| \`company\` | \`Org\` |
| \`profile\` | \`Track\` |
| \`role\` | \`Seat\` |
| \`status\` | \`State\` |
`);
  const tracker = join(dataDir, 'tracker.md');
  const markdown = `# Tracker

## Local Active

| Org | Track | Seat | State |
|---|---|---|---|
| Acme | frontend | Frontend Engineer | active |
`;

  setSchemaRootFromTracker(tracker);
  const next = setStatus(markdown, {
    section: 'active',
    company: 'Acme',
    role: 'Frontend Engineer',
    status: 'closed',
  });

  assert.match(next, /closed/);
});
