import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getSessionOr401 } from "@/lib/api-guard";
import { cookies } from "next/headers";
import { getMailConfigForOrg } from "@/lib/mail-org-config";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export async function GET() {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  const config = await getMailConfigForOrg(session.organisationId);
  if (!config.googleClientId || !config.googleClientSecret) {
    return NextResponse.json(
      { error: "Gmail OAuth is not configured. Super Admin: go to Settings → Email → Mail Provider Configuration." },
      { status: 503 }
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    `${config.appUrl}/api/mail/oauth/gmail/callback`
  );

  const state = Buffer.from(
    JSON.stringify({ userId: session.id, organisationId: session.organisationId })
  ).toString("base64url");

  const cookieStore = await cookies();
  cookieStore.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    state,
    prompt: "consent",
  });

  return NextResponse.redirect(authUrl);
}
