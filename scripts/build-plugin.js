#!/usr/bin/env node
// Builds a Claude Code / Cowork plugin zip into dist/.
// The zip bundles the engine (plugin manifest, skills, hooks, scripts) plus the
// scaffold sources (config/candidate/strategy/style/templates/data seeds) so that
// job-tracker:setup can copy starter files into the user's working directory.
// Skills are canonically named without a `job-` prefix; the plugin namespace
// (`job-tracker`, from plugin.json) makes commands resolve to job-tracker:<skill>.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const { version, name } = createRequire(import.meta.url)(resolve(repoRoot, 'package.json'));

// Plugin-relevant entries copied into the staged plugin directory.
const includeEntries = [
  '.claude-plugin',
  'skills',
  'hooks',
  'scripts',
  'templates',
  'config',
  'candidate',
  'strategy',
  'style',
  'data',
  'README.md',
  'CHANGELOG.md',
  'LICENSE',
  'START_HERE.md',
];

// Never ship these — install artifacts, dev-only, or per-user state.
const excludePaths = new Set([
  'scripts/check-public.js',
  'scripts/build-plugin.js',
  'CLAUDE.md',
  'AGENTS.md',
]);

function fail(message) {
  console.error(`build-plugin: ${message}`);
  process.exit(1);
}

function syncManifestVersion() {
  const manifestPath = resolve(repoRoot, '.claude-plugin', 'plugin.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== version) {
    manifest.version = version;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`Synced plugin.json version -> ${version}`);
  }
}

function stage(distDir, stageDir) {
  rmSync(distDir, { recursive: true, force: true });
  mkdirSync(stageDir, { recursive: true });

  for (const entry of includeEntries) {
    const src = resolve(repoRoot, entry);
    if (!existsSync(src)) continue;
    cpSync(src, join(stageDir, entry), {
      recursive: true,
      filter: (source) => {
        const rel = source.slice(repoRoot.length + 1);
        return !excludePaths.has(rel);
      },
    });
  }
}

function zip(distDir, stageDir, zipName) {
  const result = spawnSync('zip', ['-r', '-q', join('..', zipName), '.'], {
    cwd: stageDir,
    stdio: 'inherit',
  });
  if (result.status !== 0) fail('zip command failed');
  rmSync(stageDir, { recursive: true, force: true });
  console.log(`Built ${join(distDir, zipName)}`);
}

syncManifestVersion();
const distDir = resolve(repoRoot, 'dist');
const stageDir = join(distDir, name);
const zipName = `${name}-${version}.zip`;
stage(distDir, stageDir);
zip(distDir, stageDir, zipName);
