import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;

test('npm tarball contains all CLI entry-point dependencies', () => {
  const unpackDir = mkdtempSync(join(tmpdir(), 'llm-job-tracker-pack-'));
  try {
    const pack = spawnSync('npm', ['pack', '--pack-destination', unpackDir], {
      encoding: 'utf8',
      cwd: root,
    });
    assert.equal(pack.status, 0, `npm pack failed: ${pack.stderr}`);

    const tarball = readdirSync(unpackDir).find((f) => f.endsWith('.tgz'));
    assert.ok(tarball, 'npm pack produced no .tgz file');

    const extract = spawnSync('tar', ['-xzf', join(unpackDir, tarball), '-C', unpackDir], { encoding: 'utf8' });
    assert.equal(extract.status, 0, `tar extract failed: ${extract.stderr}`);

    const pkg = join(unpackDir, 'package');
    assert.ok(existsSync(join(pkg, 'scripts', 'ats', 'index.js')), 'scripts/ats/index.js missing from tarball');
    assert.ok(existsSync(join(pkg, 'scripts', 'tracker', 'index.js')), 'scripts/tracker/index.js missing from tarball');
    assert.ok(existsSync(join(pkg, 'scripts', 'workspace', 'check.js')), 'scripts/workspace/check.js missing from tarball');
    assert.ok(existsSync(join(pkg, 'scripts', 'publish', 'check-public.js')), 'scripts/publish/check-public.js missing from tarball');

    // verify each CLI entry point resolves its imports (no Cannot find module)
    for (const [script, args] of [
      ['scripts/ats-probe.js', ['--help']],
      ['scripts/tracker.js', ['--help']],
      ['scripts/check-workspace.js', ['--help']],
      ['scripts/check-public.js', ['--help']],
    ]) {
      const result = spawnSync(process.execPath, [join(pkg, script), ...args], { encoding: 'utf8' });
      assert.ok(result.status === 0 || result.status === 1, `${script} crashed with import error: ${result.stderr}`);
      assert.ok(!result.stderr.includes('Cannot find module'), `${script} has unresolved module: ${result.stderr}`);
    }

    // functional smoke: derive-source against the packaged config/source-registry.md
    const probe = spawnSync(process.execPath, [join(pkg, 'scripts', 'ats-probe.js'), 'derive-source', 'https://jobs.ashbyhq.com/acme/123'], { encoding: 'utf8' });
    assert.equal(probe.status, 0, `derive-source failed after pack/unpack: ${probe.stderr}`);
    assert.match(probe.stdout.trim(), /ashby/, 'derive-source did not resolve the packaged registry');
  } finally {
    rmSync(unpackDir, { recursive: true, force: true });
  }
});
