#!/usr/bin/env node
import { main } from './workspace/check.js';

try {
  process.exitCode = main();
} catch (err) {
  console.error(`check-workspace: ${err.message}`);
  process.exitCode = 1;
}
