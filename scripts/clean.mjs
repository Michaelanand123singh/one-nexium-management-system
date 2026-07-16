#!/usr/bin/env node
/**
 * Remove .next to avoid EPERM / stuck builds on Windows.
 * Run automatically before build via npm prebuild, or manually: node scripts/clean.mjs
 */
import { rmSync, existsSync } from "fs";
import { join } from "path";

const dir = join(process.cwd(), ".next");
if (existsSync(dir)) {
  try {
    rmSync(dir, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 200,
    });
    console.log("Cleaned .next");
  } catch (e) {
    console.error(`
─────────────────────────────────────────────────────────────────
  Could not remove .next — files are in use (EPERM / ENOTEMPTY).
─────────────────────────────────────────────────────────────────

  Fix:
  1. Stop the dev server: Ctrl+C in the terminal running "npm run dev".
  2. Close other terminals that run this app.
  3. To free all Node locks, run:  node scripts/kill-node.mjs
     (then run  npm run build  again)

─────────────────────────────────────────────────────────────────
`, e.message);
    process.exit(1);
  }
}
