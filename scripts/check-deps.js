#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
let status = 0;

function ok(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  status = 1;
}

function note(message) {
  console.log(`  ${message}`);
}

function commandPath(command) {
  const result = spawnSync('/usr/bin/env', ['sh', '-c', 'command -v "$1"', 'sh', command], {
    encoding: 'utf8',
    shell: false,
  });
  return result.status === 0 ? result.stdout.trim() : '';
}

function hasCommand(command) {
  return Boolean(commandPath(command));
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: 'utf8',
    shell: false,
    env: {
      ...process.env,
      PYTHONDONTWRITEBYTECODE: '1',
    },
  });
}

function checkFile(path, label) {
  if (existsSync(join(repoRoot, path))) {
    ok(`${label}: ${path}`);
  } else {
    fail(`${label} missing: ${path}`);
  }
}

function checkJson(path) {
  const fullPath = join(repoRoot, path);
  if (!existsSync(fullPath)) {
    fail(`JSON config missing: ${path}`);
    return;
  }
  try {
    JSON.parse(readFileSync(fullPath, 'utf8'));
    ok(`JSON valid: ${path}`);
  } catch {
    fail(`JSON invalid: ${path}`);
  }
}

function checkPythonImport(pythonBin, module) {
  const result = run(pythonBin, ['-c', `import ${module}`]);
  return result.status === 0;
}

function profileHelper(args) {
  const result = run(process.execPath, ['scripts/llm-hooks/profile-utils.js', ...args]);
  return result.status === 0 ? result.stdout.trim() : '';
}

function checkSearchProfile() {
  const settingsFile = join(repoRoot, 'config/settings.md');
  console.log('\nProfile checks');

  if (!existsSync(settingsFile)) {
    fail('Search settings missing: config/settings.md');
    return;
  }
  ok('Search settings: config/settings.md');

  const profileSlug = profileHelper(['active-slug']);
  const profileFile = profileHelper(['active-file']);

  if (!profileSlug) {
    fail('Active profile slug not found in config/settings.md');
  } else {
    ok(`Active profile slug: ${profileSlug}`);
  }

  if (!profileFile) {
    fail('Active profile file not found in config/settings.md');
  } else if (existsSync(join(repoRoot, profileFile))) {
    ok(`Active profile file: ${profileFile}`);
  } else {
    fail(`Active profile file missing: ${profileFile}`);
  }

  const listed = profileHelper(['list-slugs']);
  for (const listedSlug of listed.split(/\r?\n/).filter(Boolean)) {
    if (existsSync(join(repoRoot, 'strategy', 'search-profiles', `${listedSlug}.md`))) {
      ok(`Listed profile exists: ${listedSlug}`);
    } else {
      fail(`Listed profile missing: strategy/search-profiles/${listedSlug}.md`);
    }
  }
}

function checkBrowserMcp() {
  let foundCodexPlaywright = false;
  let foundCodexChrome = false;
  let foundClaudePlaywright = false;
  let foundClaudeChrome = false;
  let checkedClaudeRuntime = false;
  let checkedCodexRuntime = false;

  console.log('\nBrowser / MCP checks');

  const nodePath = commandPath('node');
  if (nodePath) ok(`node: ${nodePath}`);
  else fail('node not found; npx-based browser MCP servers need Node.js');

  const npxPath = commandPath('npx');
  if (npxPath) ok(`npx: ${npxPath}`);
  else fail('npx not found; configured Playwright/Chrome DevTools MCP servers use npx');

  if (hasCommand('codex')) {
    checkedCodexRuntime = true;
    const result = run('codex', ['mcp', 'list']);
    if (result.status === 0) {
      if (/^playwright\s/m.test(result.stdout) && /^playwright\s.*enabled/m.test(result.stdout)) {
        ok('Codex MCP enabled: playwright');
        foundCodexPlaywright = true;
      }
      if (/^chrome-devtools\s/m.test(result.stdout) && /^chrome-devtools\s.*enabled/m.test(result.stdout)) {
        ok('Codex MCP enabled: chrome-devtools');
        foundCodexChrome = true;
      }
    } else {
      note("Could not run 'codex mcp list'; falling back to config-file checks");
    }
  }

  const codexConfig = join(process.env.HOME ?? '', '.codex', 'config.toml');
  if (existsSync(codexConfig)) {
    const text = readFileSync(codexConfig, 'utf8');
    if (/^\[mcp_servers\.playwright\]/m.test(text)) {
      if (!foundCodexPlaywright) ok('Codex MCP configured: playwright');
      foundCodexPlaywright = true;
    }
    if (/^\[mcp_servers\.chrome-devtools\]/m.test(text)) {
      if (!foundCodexChrome) ok('Codex MCP configured: chrome-devtools');
      foundCodexChrome = true;
    }
  }

  const claudeCmd = process.env.CLAUDE_BIN || 'claude';
  if (hasCommand(claudeCmd) || existsSync(claudeCmd)) {
    checkedClaudeRuntime = true;
    const result = run(claudeCmd, ['mcp', 'list']);
    if (result.status === 0) {
      if (/^playwright:.*Connected/im.test(result.stdout)) {
        ok('Claude MCP connected: playwright');
        foundClaudePlaywright = true;
      }
      if (/^chrome-devtools:.*Connected/im.test(result.stdout)) {
        ok('Claude MCP connected: chrome-devtools');
        foundClaudeChrome = true;
      }
    } else {
      fail(`Could not run '${claudeCmd} mcp list'; Claude browser MCP install cannot be verified`);
    }
  } else {
    fail('claude CLI not found; set CLAUDE_BIN=/path/to/claude to verify Claude browser MCP');
  }

  if (!foundCodexPlaywright && !foundCodexChrome) {
    fail('No Codex browser MCP detected; LinkedIn, Djinni, portfolio boards, and JS ATS checks may be blocked in Codex');
    note('Codex example: codex mcp add playwright -- npx -y @playwright/mcp@latest');
    note('Codex example: codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest');
  } else if (!foundCodexPlaywright) {
    note('Codex Playwright MCP not detected; Chrome DevTools MCP can cover browser work, but Playwright MCP is also useful');
  } else if (!foundCodexChrome) {
    note('Codex Chrome DevTools MCP not detected; Playwright MCP can cover browser work, but Chrome DevTools MCP is also useful');
  }

  if (checkedClaudeRuntime && !foundClaudePlaywright && !foundClaudeChrome) {
    fail(`No connected Claude browser MCP detected via '${claudeCmd} mcp list'`);
    note('Claude example: claude mcp add playwright -- npx -y @playwright/mcp@latest');
    note('Claude example: claude mcp add chrome-devtools -- npx chrome-devtools-mcp@latest');
  }

  if (!checkedCodexRuntime) {
    note("Codex CLI not found; skipped live 'codex mcp list' check");
  }
}

function compilePythonScripts() {
  if (!hasCommand('python3')) return;

  const result = run('python3', [
    '-c',
    'import pathlib; compile(pathlib.Path("scripts/generate_pdf.py").read_text(encoding="utf-8"), "scripts/generate_pdf.py", "exec")',
  ]);

  if (result.status === 0) ok('Python PDF generator compiles');
  else fail('Python PDF generator compile check failed');
}

function runNodeValidator(path, okMessage, failMessage) {
  const result = run(process.execPath, [path]);
  if (result.status === 0) {
    ok(okMessage);
  } else {
    fail(failMessage);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }
}
function compareFiles(a, b) {
  if (!existsSync(a) || !existsSync(b)) return false;
  return readFileSync(a).equals(readFileSync(b));
}

function checkInstalledHooks() {
  const codexHooks = join(repoRoot, '.codex', 'hooks.json');
  if (existsSync(codexHooks)) {
    if (compareFiles(join(repoRoot, 'scripts/llm-hooks/codex-hooks.json'), codexHooks)) {
      ok('Codex hooks installed and in sync');
    } else {
      fail('Codex hooks installed but out of sync; run node scripts/install.js codex');
    }
  } else {
    note('Codex hooks not installed locally; run node scripts/install.js codex if needed');
  }

  const codexRules = join(repoRoot, 'scripts/llm-hooks/codex-rules/default.rules');
  if (existsSync(codexRules)) {
    const installedRules = join(repoRoot, '.codex', 'rules/default.rules');
    if (existsSync(installedRules)) {
      if (compareFiles(codexRules, installedRules)) {
        ok('Codex command rules installed and in sync');
      } else {
        fail('Codex command rules installed but out of sync; run node scripts/install.js codex');
      }
    } else {
      note('Codex command rules not installed locally; run node scripts/install.js codex if needed');
    }
  }

  const claudeSettings = join(repoRoot, '.claude', 'settings.json');
  if (existsSync(claudeSettings)) {
    const text = readFileSync(claudeSettings, 'utf8');
    if (
      text.includes('scripts/llm-hooks/pre-tool-guard.js') &&
      text.includes('scripts/llm-hooks/post-tool-check.js') &&
      text.includes('scripts/llm-hooks/stop-check.js')
    ) {
      ok('Claude hooks present in local settings');
    } else {
      fail('Claude settings exist but required job-search hooks are missing');
    }
  } else {
    note('Claude hooks not installed locally; run node scripts/install.js claude if needed');
  }
}

function main() {
  console.log('Dependency check for job-search workspace\n');

  const pythonPath = commandPath('python3');
  if (pythonPath) ok(`python3: ${pythonPath}`);
  else fail('python3 not found; hooks and PDF generation need it');

  const pandocPath = commandPath('pandoc');
  if (pandocPath) ok(`pandoc: ${pandocPath}`);
  else {
    fail('pandoc not found; PDF generation needs it');
    note('macOS: brew install pandoc');
  }

  if (pythonPath) {
    if (checkPythonImport('python3', 'weasyprint')) {
      ok('weasyprint importable with python3');
    } else if (existsSync(join(repoRoot, 'scripts/.venv/bin/python3')) && checkPythonImport(join(repoRoot, 'scripts/.venv/bin/python3'), 'weasyprint')) {
      ok('weasyprint importable with scripts/.venv/bin/python3');
    } else if (existsSync('/tmp/resume-venv/bin/python3') && checkPythonImport('/tmp/resume-venv/bin/python3', 'weasyprint')) {
      ok('weasyprint importable with /tmp/resume-venv/bin/python3');
    } else {
      fail('weasyprint not importable; PDF generation needs the Python package');
      note('suggested: python3 -m venv /tmp/resume-venv && /tmp/resume-venv/bin/pip install weasyprint');
    }
  }

  const pdfinfoPath = commandPath('pdfinfo');
  if (pdfinfoPath) ok(`pdfinfo: ${pdfinfoPath} (optional; used for PDF resume import style extraction)`);
  else note('pdfinfo not found (optional; macOS: brew install poppler)');

  checkSearchProfile();
  checkBrowserMcp();

  checkFile('scripts/generate_pdf.py', 'PDF generator');
  checkFile('scripts/ats-probe.js', 'ATS probe CLI');
  checkFile('scripts/tracker.js', 'Tracker row CLI');
  checkFile('scripts/cv.css', 'PDF CSS');
  checkFile('scripts/llm-hooks/pre-tool-guard.js', 'PreToolUse hook');
  checkFile('scripts/llm-hooks/post-tool-check.js', 'PostToolUse hook');
  checkFile('scripts/llm-hooks/stop-check.js', 'Stop hook');
  checkFile('scripts/llm-hooks/validate-tracker-profiles.js', 'Tracker profile validator');
  checkFile('scripts/llm-hooks/validate-skill-footers.js', 'Skill output validator');
  checkFile('scripts/check-workspace.js', 'Workspace health checker');
  checkJson('scripts/llm-hooks/codex-hooks.json');
  checkJson('scripts/llm-hooks/claude-settings.json');

  compilePythonScripts();
  runNodeValidator('scripts/llm-hooks/validate-skill-footers.js', 'Skill output requires active profile and job:action next actions', 'Skill output validation failed');
  runNodeValidator('scripts/llm-hooks/validate-tracker-profiles.js', 'Tracker Profile columns are valid', 'Tracker Profile column validation failed');
  checkInstalledHooks();

  if (status === 0) {
    console.log('\nAll required dependencies are available.');
  } else {
    console.error('\nMissing or broken dependencies detected.');
  }

  return status;
}

process.exitCode = main();
