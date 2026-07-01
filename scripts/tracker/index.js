#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMainModule } from '../lib/is-main.js';
import { setSchemaRootFromTracker } from './schema.js';
import { addLead, bumpDate, listRows, moveRow, setStatus, validateTracker } from './ops.js';

export { addLead, bumpDate, listRows, moveRow, setSchemaRootFromTracker, setStatus, validateTracker };

function usage() {
  console.log(`Usage:
  node scripts/tracker.js list --section raw [--tracker data/tracker.md]
  node scripts/tracker.js validate [--tracker data/tracker.md] [--json]
  node scripts/tracker.js add-lead --company ... --profile ... --role ... --url ... [--source ...] --date YYYY-MM-DD
  node scripts/tracker.js move --company ... --role ... --from raw --to archive --date YYYY-MM-DD --reason ...
  node scripts/tracker.js set-status --company ... --role ... --status ... --date YYYY-MM-DD
  node scripts/tracker.js bump-date --company ... --role ... --field Added|Checked|Updated --date YYYY-MM-DD

Options:
  --dry-run  Print the updated tracker instead of writing it.
  --json     Print JSON for list/validate.
  --strict   Make validate warnings exit non-zero.
`);
}

function parseArgs(argv) {
  if (argv[0] === '--help' || argv[0] === '-h') { usage(); process.exit(0); }
  const opts = { command: argv[0], tracker: 'data/tracker.md' };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') { usage(); process.exit(0); }
    if (arg === '--dry-run' || arg === '--json' || arg === '--strict') {
      opts[arg === '--dry-run' ? 'dryRun' : arg.slice(2)] = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const value = argv[i + 1];
    if (!value) throw new Error(`${arg} requires a value`);
    opts[arg.slice(2)] = value;
    i += 1;
  }
  if (!opts.command) throw new Error('command is required');
  return opts;
}

function readTracker(path) {
  const fullPath = resolve(path);
  if (!existsSync(fullPath)) throw new Error(`Tracker not found: ${path}`);
  return readFileSync(fullPath, 'utf8');
}

function writeTracker(path, text) {
  writeFileSync(resolve(path), text);
}

export function main() {
  const opts = parseArgs(process.argv.slice(2));
  setSchemaRootFromTracker(opts.tracker);
  const markdown = readTracker(opts.tracker);

  if (opts.command === 'list') {
    if (!opts.section) throw new Error('--section is required');
    const rows = listRows(markdown, opts.section);
    if (opts.json) console.log(JSON.stringify(rows, null, 2));
    else { for (const row of rows) console.log(Object.values(row).join(' | ')); }
    return;
  }

  if (opts.command === 'validate') {
    const result = validateTracker(markdown);
    if (opts.json) console.log(JSON.stringify(result, null, 2));
    else if (result.issues.length) {
      for (const issue of result.issues) console.log(`${issue.level}: line ${issue.line}: ${issue.message}`);
    } else {
      console.log(`tracker ok: ${result.tables} tables, ${result.rows} rows`);
    }
    process.exitCode = result.ok && !(opts.strict && result.issues.length) ? 0 : 1;
    return;
  }

  const commands = { 'add-lead': addLead, move: moveRow, 'set-status': setStatus, 'bump-date': bumpDate };
  const fn = commands[opts.command];
  if (!fn) throw new Error(`Unknown command: ${opts.command}`);
  const next = fn(markdown, opts);
  if (opts.dryRun) console.log(next);
  else {
    writeTracker(opts.tracker, next);
    console.log(`tracker updated: ${opts.command}`);
  }
}

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`tracker: ${err.message}`);
    console.error('');
    usage();
    process.exit(1);
  }
}
