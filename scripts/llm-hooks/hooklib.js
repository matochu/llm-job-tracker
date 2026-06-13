import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export function readEvent() {
  const raw = readFileSync(0, 'utf8').trim();
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : { value };
  } catch {
    return { raw_stdin: raw };
  }
}

export function repoRoot(event = {}) {
  const cwd = event.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
  let path = resolve(String(cwd));
  while (true) {
    if (existsSync(resolve(path, '.git'))) return path;
    const parent = dirname(path);
    if (parent === path) return resolve(String(cwd));
    path = parent;
  }
}

export function toolName(event) {
  return String(event.tool_name || event.toolName || '');
}

export function toolInput(event) {
  const value = event.tool_input || event.toolInput || {};
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export function commandText(event) {
  const data = toolInput(event);
  const candidates = [
    data.command,
    data.cmd,
    data.script,
    data.url,
    data.text,
    data.element,
    data.target,
    data.value,
    event.command,
  ];
  return candidates.filter(Boolean).map(String).join('\n');
}

export function editedPaths(event) {
  const data = toolInput(event);
  const keys = ['file_path', 'path', 'filename', 'target_file', 'notebook_path'];
  const paths = keys.filter((key) => data[key]).map((key) => String(data[key]));

  const raw = JSON.stringify(data);
  for (const match of raw.matchAll(/(data\/companies\/[^"'\s]+|data\/tracker\.md|candidate\/cv\/[^"'\s]+|candidate\/application-answers\.md)/g)) {
    paths.push(match[1]);
  }

  return [...new Set(paths)];
}

export function printClaudeDeny(reason, eventName = 'PreToolUse') {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: eventName,
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}

export function warn(reason) {
  console.error(reason);
}
