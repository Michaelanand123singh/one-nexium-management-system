#!/usr/bin/env node
/**
 * Run prisma generate with clear guidance when EPERM occurs on Windows.
 * Root cause: the Prisma query engine DLL is locked by any process that loaded it
 * (e.g. Next.js dev server, IDE TypeScript server). Windows blocks renaming the file.
 *
 * Usage: node scripts/prisma-generate.mjs   or  npm run db:generate
 */
import { spawnSync } from "child_process";

const isWindows = process.platform === "win32";
// Use npx so stdout/stderr stream correctly and we get consistent behavior
const result = spawnSync("npx", ["prisma", "generate"], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, FORCE_COLOR: "1" },
});

const exitCode = result.status ?? result.signal ?? 1;
if (exitCode !== 0 && isWindows) {
  console.error(`
─────────────────────────────────────────────────────────────────
  Prisma generate failed.
  On Windows this is often EPERM: the query engine file is in use.
─────────────────────────────────────────────────────────────────

  Fix:
  1. Stop the dev server: Ctrl+C in the terminal running "npm run dev".
  2. Close any other terminal or process that runs this app.
  3. (Optional) Close and reopen your IDE to release the TS server.
  4. Run again:  npm run db:generate

  Then start the dev server again:  npm run dev
─────────────────────────────────────────────────────────────────
`);
}

process.exit(typeof result.status === "number" ? result.status : 1);
