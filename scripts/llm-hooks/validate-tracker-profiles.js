#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { activeProfile, fileProfiles, listedProfiles, repoRoot } from './profile-utils.js';

function cells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((part) => part.trim());
}

function main() {
  const root = repoRoot();
  const tracker = resolve(root, 'data/tracker.md');
  if (!existsSync(tracker)) {
    console.error('data/tracker.md not found');
    return 1;
  }
  const profiles = listedProfiles(root);
  if (!profiles.size) {
    console.error('No profiles listed in config/settings.md');
    return 1;
  }
  const errors = [];
  const files = fileProfiles(root);
  for (const slug of [...profiles].filter((slug) => !files.has(slug)).sort()) errors.push(`settings lists profile '${slug}' but strategy/search-profiles/${slug}.md is missing`);
  for (const slug of [...files].filter((slug) => !profiles.has(slug)).sort()) errors.push(`strategy/search-profiles/${slug}.md exists but is not listed in settings.md Available Profiles`);
  const { slug: activeSlug } = activeProfile(root);
  if (!activeSlug) errors.push('active Profile slug not found in config/settings.md');
  else if (!profiles.has(activeSlug)) errors.push(`active profile '${activeSlug}' is not in settings.md Available Profiles`);

  let currentHeader = null;
  let profileIndex = null;
  readFileSync(tracker, 'utf8').split(/\r?\n/).forEach((line, idx) => {
    const lineno = idx + 1;
    if (!line.startsWith('|')) {
      currentHeader = null;
      profileIndex = null;
      return;
    }
    const row = cells(line);
    if (!row.length) return;
    const first = row[0];
    if (first === 'Company' || first === 'Компанія') {
      currentHeader = row;
      if (!row.includes('Profile')) {
        errors.push(`line ${lineno}: job table header missing Profile column`);
        profileIndex = null;
      } else profileIndex = row.indexOf('Profile');
      return;
    }
    if (!currentHeader || first === '---') return;
    if (profileIndex == null) return;
    if (profileIndex >= row.length) {
      errors.push(`line ${lineno}: row missing Profile cell`);
      return;
    }
    const value = row[profileIndex].trim();
    if (!value) errors.push(`line ${lineno}: empty Profile value`);
    else if (!profiles.has(value)) errors.push(`line ${lineno}: unknown Profile '${value}'`);
  });
  if (errors.length) {
    console.error('Tracker profile validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }
  console.log('Tracker profile validation passed');
  return 0;
}

process.exitCode = main();
