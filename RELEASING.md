# Release Process

## Versioning

This project follows semantic versioning. Patch releases (0.x.Y) fix bugs or polish existing features without adding new protected-zone migrations. Minor releases (0.X.0) introduce new features and may include migrations.

## Accumulating Migration Changes

During development, migration steps accumulate in `migrations/next.md`. This file is the staging area — it is tracked in git but excluded from the npm package (not included when `next.md` exists at publish time; it must be renamed first).

Do not name a migration file after a version until the release version is decided.

## Release Checklist

1. **Rename the migration staging file** (if `migrations/next.md` exists):

   ```bash
   mv migrations/next.md migrations/<version>.md
   ```

   Update the version reference inside the file (first two lines: title and `Applied by` condition).

2. **Bump the version** in `package.json`.

3. **Update `CHANGELOG.md`**: rename the `## Unreleased` section (if present) to `## <version> - <date>`, or add a new dated section. Include an entry for the migration if one was added.

4. **Run the full check**:

   ```bash
   npm run check
   ```

   This runs syntax checks, tests, public safety checks, workspace checks, and a dry-run pack. All must pass before publishing.

5. **Build the plugin zip**:

   ```bash
   npm run build:plugin
   ```

   Verify `dist/llm-job-tracker-<version>.zip` exists.

6. **Commit and tag**:

   ```bash
   git add -p
   git commit -m "chore: release <version>"
   git tag v<version>
   git push origin main --tags
   ```

7. **Publish to npm**:

   ```bash
   npm publish
   ```

8. **Create a GitHub release**: upload `dist/llm-job-tracker-<version>.zip` as a release asset so plugin users can download it.

## What Goes Where

| File | Updated by | Notes |
|---|---|---|
| `migrations/next.md` | developer during feature work | renamed to `<version>.md` at release |
| `migrations/<version>.md` | release step | shipped in npm package and plugin zip |
| `config/.installed-version` | CLI on init/update | written into the user's workspace |
| `config/.migrated-version` | `job-tracker:health` after migrations | written into the user's workspace |

## Local Git Hooks

A pre-push hook in `scripts/hooks/pre-push` runs `node scripts/check-public.js` before every push, blocking any private/local data from reaching the public remote. The hook script is committed, but the hook path must be enabled once per clone (git does not persist `core.hooksPath` across clones):

```bash
git config core.hooksPath scripts/hooks
```

The check is git-aware: it only inspects files git would publish (tracked + untracked-not-ignored), so gitignored local artifacts (`.claude/`, `.sessions/`, `data/network/*.csv`, etc.) never trip it. Override a single push with `git push --no-verify` if ever needed.

## Protected-Zone Changes

When a feature adds or modifies files in protected zones (`candidate/`, `strategy/search-profiles/`, `config/paths.md`, etc.):

1. Add the new/changed file to `seedIfMissingEntries` in `bin/job-tracker.js` if it is a new file that should be seeded on update.
2. Add an idempotent migration step to `migrations/next.md` for any in-file changes to existing protected files.
3. Both the CLI seed and the `job-tracker:health` migration must be present before shipping — one covers workspace mode init/update, the other covers plugin mode and in-file edits.
