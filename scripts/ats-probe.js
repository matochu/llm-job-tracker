#!/usr/bin/env node
export * from './ats/index.js';

import { isMainModule } from './lib/is-main.js';
import { main } from './ats/index.js';

if (isMainModule(import.meta.url)) {
  main().catch((err) => {
    console.error(`ats-probe: ${err.message}`);
    process.exit(1);
  });
}
