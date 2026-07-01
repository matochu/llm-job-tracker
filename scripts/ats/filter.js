import { loadSourceRegistry } from '../lib/source-registry.js';
import { stripHtml, text } from './providers.js';

function lowerHaystack(role) {
  return [role.title, role.location, stripHtml(role.raw?.description), stripHtml(role.raw?.content), role.raw?.department, role.raw?.team]
    .map(text)
    .join(' ')
    .toLowerCase();
}

function resolveSearchDefaults({ keywords, locations, registry, root } = {}) {
  registry ??= (keywords === undefined || locations === undefined) ? loadSourceRegistry(root) : undefined;
  return {
    keywords: keywords ?? registry.keywords,
    locations: locations ?? registry.locations,
  };
}

export function locationConfidence(role, locations) {
  ({ locations } = resolveSearchDefaults({ locations }));
  const locationText = [role.location, role.raw?.workplaceType, role.raw?.remote ? 'remote' : ''].map(text).join(' ').toLowerCase().trim();
  const descriptionText = [stripHtml(role.raw?.description), stripHtml(role.raw?.content)].join(' ').toLowerCase().trim();
  const blockedRemote = /\bremote\b/.test(locationText) && /\b(us|u\.s\.|usa|united states|canada|americas|north america)\b/.test(locationText);
  const allowedInLocation = !blockedRemote && locations.some((location) => {
    const normalized = location.toLowerCase();
    if (normalized === 'remote') return /\bremote\b/.test(locationText);
    return locationText.includes(normalized);
  });
  const allowedInDescription = locations.some((location) => descriptionText.includes(location.toLowerCase()));
  return {
    locationText,
    descriptionText,
    allowed: allowedInLocation || (!locationText && allowedInDescription),
    confidence: allowedInLocation ? 'explicit' : allowedInDescription ? 'description' : locationText ? 'mismatch' : 'missing',
  };
}

export function filterRoles(roles, keywords, locations) {
  ({ keywords, locations } = resolveSearchDefaults({ keywords, locations }));
  return roles.filter((role) => {
    const haystack = lowerHaystack(role);
    const keywordHit = keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
    const locationSignal = locationConfidence(role, locations);
    const locationHit = !locationSignal.locationText || locationSignal.allowed;
    return keywordHit && locationHit;
  });
}

export function filterRolesWithOptions(roles, options = {}) {
  const { keywords, locations } = resolveSearchDefaults(options);
  return roles
    .map((role) => ({ role, locationSignal: locationConfidence(role, locations) }))
    .filter(({ role, locationSignal }) => {
      const haystack = lowerHaystack(role);
      const keywordHit = keywords.some((keyword) => haystack.includes(keyword.toLowerCase()));
      const locationHit = options.strictLocation ? locationSignal.allowed : (!locationSignal.locationText || locationSignal.allowed);
      return keywordHit && locationHit;
    })
    .map(({ role, locationSignal }) => ({
      ...role,
      locationConfidence: locationSignal.confidence,
    }));
}
