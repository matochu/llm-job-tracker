#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [resolve(scriptDir, 'publish/build-plugin.js')], {
  stdio: 'inherit',
  cwd: resolve(scriptDir, '..'),
});
if (result.status !== 0) process.exit(result.status ?? 1);
