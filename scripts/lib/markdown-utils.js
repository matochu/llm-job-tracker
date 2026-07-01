export function cloneAliases(aliases) {
  return Object.fromEntries(Object.entries(aliases).map(([key, values]) => [key, [...values]]));
}

export function mergeAlias(target, canonical, labels) {
  if (!canonical) return;
  target[canonical] ??= [];
  for (const label of labels) {
    if (label && !target[canonical].some((existing) => existing.toLowerCase() === label.toLowerCase())) {
      target[canonical].push(label);
    }
  }
}

export function splitMarkdownRow(line) {
  const stripped = line.trim();
  if (!stripped.startsWith('|') || !stripped.endsWith('|')) return null;
  return stripped.slice(1, -1).split('|').map((cell) => cell.trim());
}

export function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(' ', '')));
}

export function labelsFromCell(cell) {
  const labels = [...String(cell ?? '').matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
  if (labels.length) return labels;
  return String(cell ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}

export function tableRowsAfterHeading(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) return [];
  const rows = [];
  let pastSeparator = false;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith('## ')) break;
    const cells = splitMarkdownRow(line);
    if (!cells || cells.length < 2) continue;
    if (isSeparatorRow(cells)) { pastSeparator = true; continue; }
    if (!pastSeparator) continue;
    rows.push(cells);
  }
  return rows;
}

export function bulletItemsAfterHeading(markdown, heading) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) return [];
  const items = [];
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^#{2,3}\s+/.test(line)) break;
    const match = line.match(/^-\s+(.+)$/);
    if (match) items.push(match[1].trim());
  }
  return items;
}

export function parseAliasTable(markdown, heading, target) {
  const lines = markdown.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => line.trim() === heading);
  if (headingIndex === -1) return;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (/^#{2,3}\s+/.test(line)) break;
    const cells = splitMarkdownRow(line);
    if (!cells || cells.length < 2 || isSeparatorRow(cells) || cells[0].toLowerCase() === 'canonical') continue;
    const canonical = labelsFromCell(cells[0])[0] ?? cells[0].trim();
    mergeAlias(target, canonical, cells.slice(1).flatMap(labelsFromCell));
  }
}

