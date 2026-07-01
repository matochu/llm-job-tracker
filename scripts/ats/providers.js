import { stripHtml, text } from './utils.js';

export { stripHtml, text };

function first(...values) {
  return values.find((value) => text(value).trim()) ?? '';
}

function extractPrimaryUrl(value) {
  const raw = text(value);
  const markdownLink = raw.match(/\[[^\]]+\]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownLink) return markdownLink[1];
  const bare = raw.match(/https?:\/\/[^\s)<>,|]+/i);
  return bare ? bare[0] : raw.trim();
}

function normalizeUrl(url) {
  const value = extractPrimaryUrl(url);
  if (!value) return '';
  try {
    const parsed = new URL(value);
    parsed.hash = '';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/^(utm_|ref$|source$|gh_src$|rl$)/i.test(key)) parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return value.replace(/\/$/, '');
  }
}

function roleFromAshby(job, slug) {
  const location = first(job.location, job.locationName, job.primaryLocation, job.locations);
  const id = first(job.id, job.jobId, job.externalId);
  const url = first(job.jobUrl, job.applyUrl, job.applicationUrl, job.url, id ? `https://jobs.ashbyhq.com/${slug}/${id}` : '');
  return {
    provider: 'ashby',
    company: first(job.companyName, job.organizationName, slug),
    title: stripHtml(first(job.title, job.name)),
    location: stripHtml(location),
    id: text(id),
    url: normalizeUrl(url),
    raw: job,
  };
}

function roleFromLever(job, slug) {
  const categories = job.categories ?? {};
  const location = first(job.workplaceType, categories.location, job.location, job.locations);
  return {
    provider: 'lever',
    company: first(job.company, slug),
    title: stripHtml(first(job.text, job.title)),
    location: stripHtml(location),
    id: text(first(job.id, job.hostedUrl, job.applyUrl)),
    url: normalizeUrl(first(job.hostedUrl, job.applyUrl, job.url)),
    raw: job,
  };
}

function roleFromGreenhouse(job, slug) {
  const location = first(job.location, job.offices, job.departments);
  return {
    provider: 'greenhouse',
    company: first(job.company_name, slug),
    title: stripHtml(first(job.title, job.name)),
    location: stripHtml(location),
    id: text(first(job.id, job.internal_job_id, job.absolute_url)),
    url: normalizeUrl(first(job.absolute_url, job.url)),
    raw: job,
  };
}

function roleFromWorkable(job, slug) {
  const location = first(job.location, job.city, job.country, job.state, job.remote ? 'Remote' : '');
  const shortcode = first(job.shortcode, job.id);
  return {
    provider: 'workable',
    company: first(job.company, slug),
    title: stripHtml(first(job.title, job.name)),
    location: stripHtml(location),
    id: text(shortcode),
    url: normalizeUrl(first(job.url, job.application_url, shortcode ? `https://apply.workable.com/${slug}/j/${shortcode}` : '')),
    raw: job,
  };
}

function roleFromRecruitee(job, slug) {
  const location = first(job.location, job.city, job.country, job.remote ? 'Remote' : '');
  return {
    provider: 'recruitee',
    company: first(job.company_name, slug),
    title: stripHtml(first(job.title, job.name)),
    location: stripHtml(location),
    id: text(first(job.id, job.slug, job.careers_url)),
    url: normalizeUrl(first(job.careers_url, job.url)),
    raw: job,
  };
}

function roleFromSmartRecruiters(job, slug) {
  const location = first(job.location, job.ref, job.city, job.country);
  return {
    provider: 'smartrecruiters',
    company: first(job.company?.name, job.company, slug),
    title: stripHtml(first(job.name, job.title)),
    location: stripHtml(location),
    id: text(first(job.id, job.uuid, job.ref)),
    url: normalizeUrl(first(job.ref, job.applyUrl, job.url)),
    raw: job,
  };
}

export const roleMappers = {
  ashby: roleFromAshby,
  lever: roleFromLever,
  greenhouse: roleFromGreenhouse,
  workable: roleFromWorkable,
  recruitee: roleFromRecruitee,
  smartrecruiters: roleFromSmartRecruiters,
};

export function pickJobs(payload, provider) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.jobs)) return payload.jobs;
  if (Array.isArray(payload.jobPostings)) return payload.jobPostings;
  if (Array.isArray(payload.postings)) return payload.postings;
  if (Array.isArray(payload.offers)) return payload.offers;
  if (Array.isArray(payload.content)) return payload.content;
  if (Array.isArray(payload.results)) return payload.results;
  if (provider === 'smartrecruiters' && Array.isArray(payload.smartRecruitersJobs)) return payload.smartRecruitersJobs;
  return [];
}

export function normalizeRoles(provider, slug, payload) {
  const mapper = roleMappers[provider];
  if (!mapper) throw new Error(`Unsupported provider normalizer: ${provider}`);
  return pickJobs(payload, provider)
    .map((job) => mapper(job, slug))
    .filter((role) => role.title && role.url);
}

export const implementedProviderIds = Object.keys(roleMappers);

export function parseWorkableMarkdown(markdown, slug) {
  const jobs = [];
  const pattern = /\[([^\]]+)\]\((https:\/\/apply\.workable\.com\/[^)]+)\)(?:\s*-\s*([^\n]+))?/g;
  for (const match of markdown.matchAll(pattern)) {
    jobs.push({ title: match[1], url: match[2], location: match[3] ?? '', company: slug });
  }
  return { jobs };
}
