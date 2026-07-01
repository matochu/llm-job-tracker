#!/usr/bin/env node
export * from './tracker/index.js';

import { isMainModule } from './lib/is-main.js';
import { main } from './tracker/index.js';

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (err) {
    console.error(`tracker: ${err.message}`);
    process.exit(1);
  }
}
