import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { isGoogleSignInConfigured, getGoogleRedirectUriBase } from "@/lib/auth-google";
import { getSessionCookieOptions } from "@/lib/auth";
import { resolveAppBaseUrl } from "@/lib/app-base-url";

const SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
];

export async function GET(request: NextRequest) {
  if (!isGoogleSignInConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=google_not_configured", resolveAppBaseUrl(request.url))
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from")?.trim() || "/";

  // Use NEXIUM_APP_URL if set (required when behind proxy so redirect_uri matches Google Console).
  const base = getGoogleRedirectUriBase(request.nextUrl.origin);
  const redirectUri = `${base}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri
  );

  const state = Buffer.from(
    JSON.stringify({ from, nonce: crypto.randomUUID() })
  ).toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set("google_login_state", state, {
    ...getSessionCookieOptions(),
    maxAge: 600,
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "consent",
  });

  return NextResponse.redirect(authUrl);
}
