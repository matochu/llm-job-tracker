# Migration next

Applied by `job-tracker:health` when `config/.migrated-version` < `<version>`.

Each step is idempotent: check first, write only if the marker is absent.
Stop on first failure; do not update `config/.migrated-version` until all steps pass.

---

## Step 1 — Register profile-resolution in the config zone

`config/profile-resolution.md` itself is a new managed file — `npx llm-job-tracker update` already copies it into every workspace (it's listed in `managedEntries`), and a fresh plugin install/update ships it as part of the plugin tree. No seed step is needed for the file itself. This step only fixes the existing `config/paths.md` line that lists config-zone files.

**Target file:** `config/paths.md`.

**Check:** this step is satisfied when `config/paths.md` contains the exact string `config/profile-resolution.md` in the `## Configuration Zones` section.
- If found -> skip.
- If not found -> apply.

**Apply:** in the `- **Config (\`config/\`):**` line under `## Configuration Zones`, append `, \`config/profile-resolution.md\`` if it is missing from that line. Do not rewrite the rest of the file.

**Success condition:** `config/paths.md` lists `config/profile-resolution.md` in the `## Configuration Zones` line.

**Failure condition:** `config/paths.md` is missing, the `## Configuration Zones` line cannot be found, or the marker is absent after the write. Stop and report. Do not bump `.migrated-version`.

---

<!-- Add migration steps here -->
