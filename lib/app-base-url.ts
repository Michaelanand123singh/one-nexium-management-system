import { headers } from "next/headers";

/** Strip trailing slash for consistent origin strings. */
export function normalizeAppBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/**
 * Public app origin from env (production / proxy). Used for OAuth and agent ingest instructions.
 * Prefer `NEXIUM_APP_URL`; optional `NEXT_PUBLIC_APP_URL` fallback.
 */
export function getAppBaseUrlFromEnv(): string | undefined {
  const a = process.env.NEXIUM_APP_URL?.trim();
  if (a) return normalizeAppBaseUrl(a);
  const b = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (b) return normalizeAppBaseUrl(b);
  return undefined;
}

/**
 * Canonical Nexium web origin for this deployment.
 * Uses env when set (correct behind reverse proxies); otherwise the current request origin.
 */
export function resolveAppBaseUrl(requestUrl: string): string {
  const fromEnv = getAppBaseUrlFromEnv();
  if (fromEnv) return fromEnv;
  return new URL(requestUrl).origin;
}

/**
 * Server components / layout: resolve origin without a Request (uses forwarded headers in prod).
 */
export async function resolveAppBaseUrlFromHeaders(): Promise<string> {
  const fromEnv = getAppBaseUrlFromEnv();
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
