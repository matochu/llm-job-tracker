import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { implementedProviderIds } from '../../ats/providers.js';
import { bulletItemsAfterHeading, labelsFromCell, tableRowsAfterHeading } from '../../lib/markdown-utils.js';
import { parseSourceRegistryRaw } from '../../lib/source-registry.js';

export function checkSourceRegistry(root, readText) {
  const issues = [];
  const registryPath = join(root, 'config', 'source-registry.md');
  if (!existsSync(registryPath)) {
    issues.push({ level: 'error', message: 'config/source-registry.md is missing; run job-tracker:setup to fill source registry settings before running discovery' });
    return issues;
  }

  const registry = readText(registryPath);
  for (const heading of ['## ATS Probe Providers', '## ATS Probe Search Defaults', '## Browser-Required Sources', '## Source Derivation']) {
    if (!registry.includes(heading)) {
      issues.push({ level: 'error', message: `config/source-registry.md is missing \`${heading}\`; run job-tracker:setup to fill source registry settings` });
    }
  }

  const providerRows = tableRowsAfterHeading(registry, '## ATS Probe Providers');
  const registryProviders = providerRows
    .map((cells) => labelsFromCell(cells[0])[0])
    .filter(Boolean)
    .sort();
  for (const cells of providerRows) {
    const provider = labelsFromCell(cells[0])[0];
    const feed = labelsFromCell(cells[3])[0] ?? cells[3] ?? '';
    if (provider && !feed.includes('[slug]')) {
      issues.push({ level: 'error', message: `config/source-registry.md ATS provider \`${provider}\` must define a Discovery feed containing [slug]; run job-tracker:setup to fill source registry settings` });
    }
  }
  for (const heading of ['### Keywords', '### Locations']) {
    if (!bulletItemsAfterHeading(registry, heading).length) {
      issues.push({ level: 'error', message: `config/source-registry.md is missing list items under \`${heading}\`; run job-tracker:setup to fill source registry settings` });
    }
  }

  const scriptProviders = [...implementedProviderIds].sort();
  if (registryProviders.join(',') !== scriptProviders.join(',')) {
    issues.push({ level: 'error', message: `config/source-registry.md ATS providers (${registryProviders.join(', ') || 'none'}) do not match scripts/ats-probe.js implemented providers (${scriptProviders.join(', ')}); run job-tracker:setup to review source registry settings` });
  }

  const parsed = parseSourceRegistryRaw(registry);

  for (const { source } of parsed.browserRequiredSources) {
    const hasDerivation = parsed.sourceDerivation.some((e) => e.source === source);
    if (!hasDerivation) {
      issues.push({ level: 'error', message: `config/source-registry.md browser-required source \`${source}\` has no matching Source Derivation entry; run job-tracker:setup to review source registry settings` });
    }
  }

  for (const { source, why, requiredAccess, policy } of parsed.browserRequiredSources) {
    const needsLoginSession = /\blogin\b|\bsession\b/i.test(why);
    if (!needsLoginSession) continue;
    const access = requiredAccess.toLowerCase();
    if (!access.includes('playwright') || !access.includes('user') || !access.includes('account') || !access.includes('session')) {
      issues.push({ level: 'error', message: `config/source-registry.md must require Playwright MCP with the user's logged-in account/session for \`${source}\`; run job-tracker:setup to review source registry settings` });
    }
    const pol = policy.toLowerCase();
    if (pol.includes('web search as a substitute') && !pol.includes('never use')) {
      issues.push({ level: 'warning', message: `config/source-registry.md should explicitly forbid web-search/API substitutes for \`${source}\`` });
    }
  }

  return issues;
}
