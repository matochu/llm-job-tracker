import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const companyHealthIgnoreFile = '.health-ignore';

function fileSize(path) {
  return statSync(path).size;
}

export function checkCompanies(root, trackerSlugs, readText) {
  const issues = [];
  const companiesDir = join(root, 'data', 'companies');

  if (!existsSync(companiesDir)) {
    issues.push({ level: 'error', message: 'data/companies/ directory is missing' });
    return issues;
  }

  for (const entry of readdirSync(companiesDir, { withFileTypes: true }).filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const slug = entry.name;
    const companyDir = join(companiesDir, slug);
    if (existsSync(join(companyDir, companyHealthIgnoreFile))) continue;

    const prep = join(companyDir, 'prep-notes.md');
    const resume = join(companyDir, 'resume.md');
    const pdfs = readdirSync(companyDir).filter((name) => name.endsWith('.pdf'));

    if (!trackerSlugs.has(slug)) {
      issues.push({ level: 'warning', message: `data/companies/${slug}/ exists but no matching tracker company slug was detected` });
    }
    if (!existsSync(prep)) {
      issues.push({ level: 'warning', message: `data/companies/${slug}/prep-notes.md is missing` });
    }
    if (pdfs.length && !existsSync(resume)) {
      issues.push({ level: 'warning', message: `data/companies/${slug}/ has PDF output but no resume.md` });
    }
    if (existsSync(resume) && fileSize(resume) === 0) {
      issues.push({ level: 'error', message: `data/companies/${slug}/resume.md is empty` });
    }
    if (existsSync(prep)) {
      const prepText = readText(prep);
      const hasDraftStatus = /manual message drafts?.*(prepared|ready)/i.test(prepText);
      if (hasDraftStatus && !prepText.includes('### Manual Message Drafts')) {
        issues.push({ level: 'warning', message: `data/companies/${slug}/prep-notes.md claims manual drafts are prepared but section is missing` });
      }
    }
  }

  return issues;
}
