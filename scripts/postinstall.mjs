#!/usr/bin/env node
/**
 * Runs after npm install. Generates Prisma client; if it fails (e.g. EPERM on Windows),
 * we exit 0 so install still succeeds. User can run "npm run db:generate" later.
 */
import { spawnSync } from "child_process";

const result = spawnSync("node", ["scripts/prisma-generate.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: "1" },
});

if (result.status !== 0) {
  console.warn("Prisma generate failed (run 'npm run db:generate' after stopping the dev server if needed).");
}
process.exit(0);
