#!/usr/bin/env node
/**
 * Test Google Sign-In config and /api/auth/google redirect from terminal.
 * Run: node scripts/test-google-auth.mjs   (from repo root)
 * Dev server should be running on http://localhost:3000 for the live redirect test.
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const envPath = resolve(root, ".env");

function loadEnv() {
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1];
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
        val = val.slice(1, -1);
      process.env[key] = val;
    }
  }
}

function getGoogleRedirectUriBase(requestOrigin) {
  const fromEnv = process.env.NEXIUM_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return requestOrigin;
}

loadEnv();

const hasClientId = !!process.env.GOOGLE_CLIENT_ID?.trim();
const hasSecret = !!process.env.GOOGLE_CLIENT_SECRET?.trim();
const allowedRaw = process.env.ALLOWED_GOOGLE_EMAILS?.trim() || "";
const allowedList = allowedRaw ? allowedRaw.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean) : [];
const appUrl = process.env.NEXIUM_APP_URL?.trim()?.replace(/\/$/, "");

console.log("--- Google Sign-In config (from .env) ---");
console.log("GOOGLE_CLIENT_ID:", hasClientId ? "set" : "MISSING");
console.log("GOOGLE_CLIENT_SECRET:", hasSecret ? "set" : "MISSING");
console.log("ALLOWED_GOOGLE_EMAILS:", allowedList.length ? `${allowedList.length} email(s)` : "MISSING or empty");
console.log("NEXIUM_APP_URL:", appUrl || "(not set, request origin will be used)");

const localOrigin = "http://localhost:3000";
const baseForLocal = getGoogleRedirectUriBase(localOrigin);
const expectedRedirectUri = `${baseForLocal}/api/auth/google/callback`;
console.log("\nExpected redirect_uri when origin is", localOrigin + ":", expectedRedirectUri);
if (appUrl && appUrl !== localOrigin) {
  console.log("(Because NEXIUM_APP_URL is set, redirect_uri uses it; add this exact URI in Google Console.)");
}

console.log("\n--- Live redirect test (GET /api/auth/google) ---");
const baseUrl = process.env.TEST_GOOGLE_AUTH_BASE || "http://localhost:3000";
const authUrl = `${baseUrl}/api/auth/google`;

try {
  const res = await fetch(authUrl, { redirect: "manual" });
  if (res.status === 302 || res.status === 307 || res.status === 303) {
    const location = res.headers.get("location") || "";
    console.log("Status:", res.status, "Redirect");
    console.log("Location (first 120 chars):", location.slice(0, 120) + (location.length > 120 ? "..." : ""));
    const parsed = new URL(location);
    const redirectUriParam = parsed.searchParams.get("redirect_uri");
    if (redirectUriParam) {
      console.log("redirect_uri sent to Google:", redirectUriParam);
      if (location.includes("accounts.google.com")) {
        console.log("\n✓ Google auth URL is correct. Ensure this exact URI is in Google Cloud Console → Credentials → your OAuth client → Authorised redirect URIs:");
        console.log("  ", redirectUriParam);
      }
    } else if (location.includes("accounts.google.com")) {
      console.log("(redirect_uri not in query; ensure Authorised redirect URIs in Console matches your app URL + /api/auth/google/callback)");
    }
  } else {
    const text = await res.text();
    console.log("Status:", res.status);
    if (res.status === 200 && text.includes("/login")) console.log("Redirected to login (e.g. google_not_configured). Check GOOGLE_* and ALLOWED_GOOGLE_EMAILS.");
    else console.log("Body (first 200 chars):", text.slice(0, 200));
  }
} catch (err) {
  console.log("Request failed:", err.message);
  console.log("Is the dev server running? Start with: npm run dev");
}
