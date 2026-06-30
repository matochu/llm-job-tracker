#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readEvent, repoRoot, warn } from './hooklib.js';

const vagueNextStepRe = /^\s*(?:next step|next action|continue with|наступний крок|далі)\s*:?\s*`?job-tracker:[a-z-]+/im;
const runDoneRe = /(?:run state:\s*`?done`?|^- Status:\s*done\s*$)/im;
const backgroundWorkRe = /\b(background|subagent|fit-review|fit review|reviewer gate|in flight|running)\b/i;
const jobTrackerOutputRe = /\b(job-tracker:|Active profile:|Run plan:|Run progress:|Next actions:)/i;

function assistantText(event) {
  const candidates = [event.assistant_response, event.assistantResponse, event.response, event.message, event.text, event.content, event.raw_stdin];
  const transcript = event.transcript || event.messages;
  if (transcript != null) candidates.push(transcript);
  return candidates.filter((value) => value != null).map((value) => typeof value === 'string' ? value : JSON.stringify(value)).join('\n');
}

function main() {
  const event = readEvent();
  const root = repoRoot(event);
  if (!existsSync(resolve(root, 'config/language.md'))) return 0;
  const validator = resolve(root, 'scripts/llm-hooks/validate-skill-footers.js');
  if (existsSync(validator)) {
    const result = spawnSync(process.execPath, [validator], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) {
      warn((result.stderr || result.stdout).trim());
      return result.status ?? 1;
    }
  }
  const text = assistantText(event);
  const hasVagueNextStep = vagueNextStepRe.test(text);
  const hasFrameworkContinuation = text.includes('Next internal step:') || text.includes('Next actions:');
  if (hasVagueNextStep && !hasFrameworkContinuation) {
    warn('Job-search stop warning: vague `job-tracker:*` continuation detected. Use `Next internal step: run ...` for running `job-tracker:run`, or a proper `Next actions:` footer. For paused resumable `job-tracker:run`, show only `[n] Continue Run` with the compact run plan and resume point.');
  }
  const looksLikeJobTrackerOutput = jobTrackerOutputRe.test(text);
  const looksLikeRunOutput = /job-tracker:run|Run plan:|Run progress:|Resume point:/i.test(text);
  if (looksLikeRunOutput && runDoneRe.test(text)) {
    const hasDoneGuards = /queue (?:is )?empty|no (?:pending|running)|no background|skipped .*reason|final reviewer/i.test(text);
    if (!hasDoneGuards) {
      warn('Job-search stop warning: `job-tracker:run` reported done. Before `done`, assert the internal queue is empty, no background subagents are running, and skipped selected leads have tracker-recorded real reasons.');
    }
  }
  if (looksLikeJobTrackerOutput && backgroundWorkRe.test(text) && !/paused-resumable|Continue Run|Next internal step:/i.test(text)) {
    warn('Job-search stop warning: background/subagent work mentioned without `paused-resumable`, `Continue Run`, or `Next internal step:`. Do not end silently while background work is in flight.');
  }
  if (looksLikeJobTrackerOutput) {
    warn('Job-search stop reminder: final reply should follow config/language.md; mention changed files, verification status, `Active profile: <slug>`, and concise `job-tracker:action` Next actions when useful.');
  }
  return 0;
}

process.exitCode = main();
