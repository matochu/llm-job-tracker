import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';

const createdDirs = [];
let cleanupRegistered = false;

export function makeFixtureDir(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  createdDirs.push(dir);
  if (!cleanupRegistered) {
    cleanupRegistered = true;
    after(() => {
      for (const created of createdDirs) {
        rmSync(created, { recursive: true, force: true });
      }
    });
  }
  return dir;
}
