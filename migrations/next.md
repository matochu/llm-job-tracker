# Migration (next release)

Applied by `job-tracker:health` when `config/.migrated-version` < next release version.

Each step is idempotent: check first, write only if the marker is absent.
Stop on first failure; do not update `config/.migrated-version` until all steps pass.

---

## Step 1 — Create `data/network/` directory

**Target:** `data/network/` in the workspace root.

**Check:** if `data/network/` exists → step is satisfied; skip.

**Apply:** create the directory.

**Plugin mode:** copy `$CLAUDE_PLUGIN_ROOT/data/network/README.md` to `data/network/README.md` if it does not exist.

**Workspace mode:** the CLI already scaffolds `data/network/.gitkeep` and `data/network/README.md` on init and update (they are in `initEntries`). If somehow missing, note it.

**Success condition:** `data/network/` exists after the step.

**Failure condition:** directory cannot be created. Stop and report path and error.

---

## Step 2 — Add `Source` column to Raw Pipeline in `data/tracker.md`

**Target file:** `data/tracker.md`.

**Check:** search the Raw Pipeline table header for the string `Source`.
- If found → step is satisfied; skip.
- If not found → apply.

**Apply:**

1. Find the Raw Pipeline table header line:
   ```
   | Company | Profile | Role | URL | Added | Status |
   ```
   Replace it with:
   ```
   | Company | Profile | Role | URL | Added | Status | Source |
   ```
   Also extend the separator row by appending ` ---|` so column count matches.

2. For each existing Raw Pipeline data row that has exactly 6 `|`-delimited cells (i.e. no Source cell yet), append an empty cell: add ` |` before the trailing newline so the row reads `| ... | Status | |`.

   Do not modify rows that already have 7 or more cells.

**Success condition:** `Source` appears in the Raw Pipeline table header and all data rows have a matching column count after the write.

**Failure condition:** the header line is not found, or the string is absent after the write. Stop and report.

---

## Step 3 — Add `## Network / Referrals` to `config/paths.md`

**Target file:** `config/paths.md`.

**Check:** search the file for the exact string `Network / Referrals`.
- If found → step is satisfied; skip.
- If not found → apply.

**Apply:** insert the following block before the `## PDF Output Directory` heading:

```
## Network / Referrals

- **Network sources directory:** `data/network/`
- **LinkedIn connections CSV:** `data/network/connections.csv`
- **Legacy referral notes:** `docs/*referrals*.md`, `docs/*network*.md` (read if present; migrate to `data/network/` over time)

```

**Success condition:** `Network / Referrals` is present in the file after the write.

**Failure condition:** the anchor heading `## PDF Output Directory` is not found, or the string is absent after the write. Stop and report.
