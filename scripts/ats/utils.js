export function text(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return [
      value.name,
      value.title,
      value.location,
      value.city,
      value.country,
      value.region,
      value.remote ? 'Remote' : '',
    ].filter(Boolean).join(', ');
  }
  return String(value);
}

export function stripHtml(value) {
  return text(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
