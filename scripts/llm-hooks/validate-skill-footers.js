#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const rawSkillCommands = [
  'find-jobs', 'verify-jobs', 'company-research', 'write-outreach',
  'status-next', 'tailor-cv', 'review-cv-fit', 'export-cv-pdf',
];
const expectedSkillNames = new Map(Object.entries({
  'find': 'job-tracker:find',
  'verify': 'job-tracker:verify',
  'company': 'job-tracker:company',
  'draft': 'job-tracker:draft',
  'status': 'job-tracker:status',
  'profile': 'job-tracker:profile',
  'setup': 'job-tracker:setup',
  'run': 'job-tracker:run',
  'health': 'job-tracker:health',
  'stories': 'job-tracker:stories',
  'apply': 'job-tracker:apply',
  'cv': 'job-tracker:cv',
  'fit': 'job-tracker:fit',
  'pdf': 'job-tracker:pdf',
}));

function main() {
  const root = resolve(new URL('../..', import.meta.url).pathname);
  const skillsDir = resolve(root, 'skills');
  const errors = [];
  if (!existsSync(skillsDir)) {
    console.error('skills directory not found');
    return 1;
  }
  for (const skillDir of readdirSync(skillsDir).sort()) {
    const skillFile = resolve(skillsDir, skillDir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const text = readFileSync(skillFile, 'utf8');
    const rel = relative(root, skillFile);
    const expectedName = expectedSkillNames.get(skillDir);
    if (!expectedName) errors.push(`${rel}: unexpected skill directory \`${skillDir}\`; expected a configured skill directory`);
    else if (!text.includes(`name: ${expectedName}`)) errors.push(`${rel}: expected skill name \`name: ${expectedName}\``);
    const outputSection = text.includes('## Output') ? text.split('## Output', 2)[1] : '';
    if (!outputSection.includes('Active profile')) errors.push(`${rel}: missing \`Active profile\` requirement in \`## Output\` section`);
    if (!(text.includes('config/next-actions.md') && text.includes('job-tracker:action'))) {
      errors.push(`${rel}: missing \`job-tracker:action\` next-actions footer requirement`);
    }
    text.split(/\r?\n/).forEach((line, index) => {
      const stripped = line.trim();
      if (!stripped) return;
      if (/^(name:|description:|### |## )/.test(stripped)) return;
      if (stripped.includes('`job-tracker:action`')) return;
      const lower = stripped.toLowerCase();
      if (!rawSkillCommands.some((command) => lower.includes(command))) return;
      const isUserFacing = ['suggest', 'use `', 'run `', 'next actions', 'output', 'include', 'footer', 'reply', 'provide'].some((marker) => lower.includes(marker));
      if (isUserFacing && !stripped.includes('`job-tracker:')) {
        errors.push(`${rel}:${index + 1}: use \`job-tracker:action\` instead of raw skill command in user-facing instruction`);
      }
    });
  }
  if (errors.length) {
    console.error('Skill output validation failed:');
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }
  console.log('Skill footer validation passed');
  return 0;
}

process.exitCode = main();
