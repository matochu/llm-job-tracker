#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { editedPaths, readEvent, warn } from './hooklib.js';

function main() {
  const event = readEvent();
  const paths = editedPaths(event);
  if (!paths.length) return 0;
  const reminders = [];
  if (paths.some((path) => path === 'data/tracker.md')) reminders.push('Tracker edited: preserve user notes, avoid duplicates, and use current verification dates.');
  if (paths.some((path) => path.endsWith('/resume.md') || path.startsWith('candidate/cv/'))) reminders.push('CV edited: keep it in English, do not invent metrics/stack, and follow style/cv-style.md.');
  if (paths.some((path) => path.endsWith('/prep-notes.md'))) reminders.push('Prep notes edited: distinguish sourced facts from inferred notes and keep outreach as drafts.');
  if (paths.some((path) => path === 'candidate/application-answers.md')) reminders.push('Answer bank edited: keep answers factual and consistent with candidate/candidate.md; tag the correct Profile.');
  if (reminders.length) warn(`Job-search hook reminder: ${reminders.join(' ')}`);
  if (paths.some((path) => path === 'data/tracker.md')) {
    const result = spawnSync(process.execPath, ['scripts/llm-hooks/validate-tracker-profiles.js'], { encoding: 'utf8' });
    if (result.status !== 0) {
      if (result.stdout) warn(result.stdout.trim());
      if (result.stderr) warn(result.stderr.trim());
      return result.status ?? 1;
    }
  }
  return 0;
}

process.exitCode = main();
