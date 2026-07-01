import { existsSync, readdirSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const sessionIdPattern = /^\d{4}-\d{2}-\d{2}T\d{6}$/;
const sessionStatusPattern = /^- Status:\s*(running|blocked|done|abandoned)\s*$/m;
const sessionRequiredSections = [
  '## Goal',
  '## Plan',
  '## Progress',
  '## Decisions',
  '## Blockers',
  '## Resume Point',
  '## Tracker Updates',
  '## Files Changed',
  '## Artifacts',
  '## Agent Insights',
  '## Summary',
];

function listMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => join(dir, entry))
    .sort();
}

export function checkSessionReports(root, readText) {
  const issues = [];
  const gitignore = readText(join(root, '.gitignore'));

  if (!gitignore.includes('.sessions/')) {
    issues.push({ level: 'error', message: '.sessions/ is not gitignored' });
  }

  const sessionsDir = join(root, '.sessions');
  const reportsDir = join(sessionsDir, 'reports');
  if (!existsSync(sessionsDir)) return issues;

  if (!existsSync(reportsDir)) {
    issues.push({ level: 'warning', message: '.sessions/ exists but .sessions/reports/ is missing' });
    return issues;
  }

  for (const report of listMarkdownFiles(reportsDir)) {
    const rel = relative(root, report);
    const name = basename(report);

    const sessionFilenameMatch = name.match(/^(\d{4}-\d{2}-\d{2}T\d{6})\.[a-z][a-z0-9-]*\.md$/);
    if (!sessionFilenameMatch) {
      issues.push({ level: 'warning', message: `${rel}: Session Report filename should be [id].<skill>.md` });
      continue;
    }

    const reportId = sessionFilenameMatch[1];
    if (!sessionIdPattern.test(reportId)) {
      issues.push({ level: 'warning', message: `${rel}: Session Report ID should use YYYY-MM-DDTHHMMSS` });
    }

    const text = readText(report);
    if (!text.includes(`- ID: ${reportId}`)) {
      issues.push({ level: 'warning', message: `${rel}: ID field does not match filename` });
    }

    const statusMatch = text.match(sessionStatusPattern);
    if (!statusMatch) {
      issues.push({ level: 'warning', message: `${rel}: missing or invalid Status` });
    } else if (['running', 'blocked'].includes(statusMatch[1])) {
      // Only run reports are resumable; a blocked import report is a login-required snapshot,
      // not an unfinished run. Warn only for job-tracker:run reports.
      const isRunReport = name.endsWith('.run.md') || text.includes('Skill: job-tracker:run');
      if (isRunReport) {
        issues.push({ level: 'warning', message: `${rel}: unfinished Session Report status \`${statusMatch[1]}\`` });
      }
    }

    for (const section of sessionRequiredSections) {
      if (!text.includes(section)) {
        issues.push({ level: 'warning', message: `${rel}: missing required section \`${section}\`` });
      }
    }
  }

  return issues;
}
