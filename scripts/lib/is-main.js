import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// process.argv[1] and import.meta.url can point to the same file via different
// symlink paths (e.g. macOS /tmp -> /private/tmp), so a plain string/URL
// comparison can silently miss the entrypoint. Resolve both sides.
export function isMainModule(importMetaUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(importMetaUrl));
  } catch {
    return false;
  }
}
