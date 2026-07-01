#!/usr/bin/env node
import { main } from './publish/check-public.js';

try {
  main();
} catch (err) {
  console.error(`check-public: ${err.message}`);
  process.exit(1);
}
