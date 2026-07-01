#!/usr/bin/env node
import { main } from './deps/check.js';

process.exitCode = main();
