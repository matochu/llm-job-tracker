import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const stopCheck = join(root, 'scripts', 'llm-hooks', 'stop-check.js');

function runStopCheck(text) {
  return spawnSync(process.execPath, [stopCheck], {
    cwd: root,
    input: JSON.stringify({ cwd: root, assistant_response: text }),
    encoding: 'utf8',
  });
}

test('stop-check warns on job-tracker:run done without completion guards', () => {
  const result = runStopCheck('Run plan:\n1. [done] Work\n\nRun state: done\nNext actions:\n- job-tracker:status');

  assert.equal(result.status, 0);
  assert.match(result.stderr, /reported done/);
});

test('stop-check warns on background work without paused resumable affordance', () => {
  const result = runStopCheck('Run progress:\nStarted background fit review subagent for Acme.');

  assert.equal(result.status, 0);
  assert.match(result.stderr, /background\/subagent work mentioned/);
});

test('stop-check accepts paused resumable background continuation', () => {
  const result = runStopCheck('Run state: paused-resumable\nBackground fit review in flight.\nNext actions:\n- [n] Continue Run (Recommended)');

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, /background\/subagent work mentioned/);
});

test('stop-check does not warn on unrelated status done prose', () => {
  const result = runStopCheck('Tracker row status: done after manual review.');

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, /reported done/);
});

test('stop-check does not emit generic reminder for unrelated replies', () => {
  const result = runStopCheck('Plain engineering answer with no job-tracker workflow state.');

  assert.equal(result.status, 0);
  assert.doesNotMatch(result.stderr, /final reply should follow/);
});
