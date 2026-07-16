#!/usr/bin/env node
/**
 * Stop all Node.js processes (Windows). Use before npm run build when you get
 * EPERM from Prisma generate or "Could not remove .next" — a background Node
 * process (e.g. dev server, IDE) is locking files.
 *
 * Run: node scripts/kill-node.mjs
 * Then run: npm run build
 *
 * Warning: closes ALL Node processes (other terminals, Cursor/VS Code Node).
 */
import { execSync } from "child_process";
import { platform } from "os";

if (platform() !== "win32") {
  console.log("This script is for Windows. On macOS/Linux use: pkill -f node");
  process.exit(0);
}

try {
  execSync('taskkill /F /IM node.exe', { stdio: 'inherit' });
  console.log("Node processes stopped. You can now run: npm run build");
} catch (e) {
  if (e.status === 128) {
    console.log("No node.exe processes were running.");
  } else {
    console.error(e.message || e);
    process.exit(1);
  }
}
