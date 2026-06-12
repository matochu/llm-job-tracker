#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readEvent, repoRoot, warn } from './hooklib.js';

const vagueNextStepRe = /^\s*(?:next step|next action|continue with|наступний крок|далі)\s*:?\s*`?job:[a-z-]+/im;

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
    warn('Job-search stop warning: vague `job:*` continuation detected. Use `Next internal step: run ...` for running `job:run`, or a proper `Next actions:` footer. For paused resumable `job:run`, show only `[n] Continue Run` with the compact run plan and resume point.');
  }
  warn('Job-search stop reminder: final reply should be Ukrainian unless producing recruiter-facing English; mention changed files, verification status, `Active profile: <slug>`, and concise `job:action` Next actions when useful.');
  return 0;
}

process.exitCode = main();
