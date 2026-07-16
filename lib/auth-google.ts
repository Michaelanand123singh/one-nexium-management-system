/**
 * Google Sign-In for internal users only.
 * Only emails in ALLOWED_GOOGLE_EMAILS (env) can sign in with Google.
 */

const ALLOWED_EMAILS_KEY = "ALLOWED_GOOGLE_EMAILS";

/** Normalised set of allowed emails (lowercase). */
function getAllowedEmailsSet(): Set<string> {
  const raw = process.env[ALLOWED_EMAILS_KEY]?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

/** True if this email is allowed to sign in with Google. */
export function isGoogleSignInAllowed(email: string): boolean {
  const allowed = getAllowedEmailsSet();
  if (allowed.size === 0) return false;
  return allowed.has(email.trim().toLowerCase());
}

/** True if Google Sign-In is configured (client id, secret, and at least one allowed email). */
export function isGoogleSignInConfigured(): boolean {
  const hasCreds =
    !!process.env.GOOGLE_CLIENT_ID?.trim() &&
    !!process.env.GOOGLE_CLIENT_SECRET?.trim();
  const hasAllowed = getAllowedEmailsSet().size > 0;
  return hasCreds && hasAllowed;
}

/**
 * Base URL for OAuth redirect_uri (no trailing slash).
 * Prefer NEXIUM_APP_URL so it matches Google Console when the app is behind a proxy.
 */
export function getGoogleRedirectUriBase(requestOrigin: string): string {
  const fromEnv = process.env.NEXIUM_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return requestOrigin;
}
