import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

function parsePrefixRules(text) {
  const rules = [];
  const blocks = text.matchAll(/prefix_rule\(([\s\S]*?)\n\)/g);
  for (const block of blocks) {
    const body = block[1];
    const patternMatch = body.match(/pattern\s*=\s*\[([^\]]+)\]/);
    const matchBlock = body.match(/match\s*=\s*\[([\s\S]*?)\]/);
    if (!patternMatch || !matchBlock) continue;
    const patterns = [...patternMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    const examples = [...matchBlock[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    rules.push({ patterns, examples });
  }
  return rules;
}

test('Codex command rule examples match their declared pattern prefixes', () => {
  const rulesPath = join(root, 'scripts', 'llm-hooks', 'codex-rules', 'default.rules');
  const rules = parsePrefixRules(readFileSync(rulesPath, 'utf8'));

  assert.ok(rules.length > 0);
  for (const rule of rules) {
    for (const example of rule.examples) {
      assert.ok(
        rule.patterns.some((pattern) => example === pattern || example.startsWith(`${pattern} `)),
        `${example} does not match pattern [${rule.patterns.join(', ')}]`,
      );
    }
  }
});
