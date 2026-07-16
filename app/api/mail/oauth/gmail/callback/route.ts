import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getMailConfigForOrg } from "@/lib/mail-org-config";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const defaultBaseUrl = process.env.NEXIUM_APP_URL || "http://localhost:3000";
  const redirectUrl = new URL("/settings?tab=email", defaultBaseUrl);

  const session = await getSession();
  if (!session) {
    redirectUrl.searchParams.set("error", "Session expired. Please log in and try again.");
    return NextResponse.redirect(redirectUrl);
  }

  if (error) {
    redirectUrl.searchParams.set("error", error === "access_denied" ? "Gmail access was denied" : error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    redirectUrl.searchParams.set("error", "Invalid OAuth callback");
    return NextResponse.redirect(redirectUrl);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("gmail_oauth_state")?.value;
  cookieStore.delete("gmail_oauth_state");

  if (!storedState || storedState !== state) {
    redirectUrl.searchParams.set("error", "Invalid state. Please try again.");
    return NextResponse.redirect(redirectUrl);
  }

  let stateData: { userId: string; organisationId: string };
  try {
    stateData = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    redirectUrl.searchParams.set("error", "Invalid state");
    return NextResponse.redirect(redirectUrl);
  }

  if (stateData.userId !== session.id || stateData.organisationId !== session.organisationId) {
    redirectUrl.searchParams.set("error", "Session mismatch. Please try again.");
    return NextResponse.redirect(redirectUrl);
  }

  const mailConfig = await getMailConfigForOrg(stateData.organisationId);
  if (!mailConfig.googleClientId || !mailConfig.googleClientSecret) {
    redirectUrl.searchParams.set("error", "OAuth not configured. Super Admin: configure in Settings → Email.");
    return NextResponse.redirect(redirectUrl);
  }

  const oauth2Client = new google.auth.OAuth2(
    mailConfig.googleClientId,
    mailConfig.googleClientSecret,
    `${mailConfig.appUrl}/api/mail/oauth/gmail/callback`
  );

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token || !tokens.refresh_token) {
    redirectUrl.searchParams.set("error", "Failed to get tokens from Google");
    return NextResponse.redirect(redirectUrl);
  }

  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  oauth2Client.setCredentials(tokens);
  const { data: userInfo } = await oauth2.userinfo.get();
  const email = userInfo.email;
  if (!email) {
    redirectUrl.searchParams.set("error", "Could not read email from Google");
    return NextResponse.redirect(redirectUrl);
  }

  const config = {
    gmail: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date ?? null,
    },
  };

  const existing = await prisma.mailAccount.findFirst({
    where: {
      organisationId: session.organisationId,
      userId: session.id,
      email,
      deletedAt: null,
    },
  });

  const isFirst = await prisma.mailAccount.count({
    where: {
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
  });

  if (existing) {
    await prisma.mailAccount.update({
      where: { id: existing.id },
      data: { provider: "gmail", config },
    });
  } else {
    await prisma.mailAccount.create({
      data: {
        organisationId: session.organisationId,
        userId: session.id,
        email,
        displayName: userInfo.name ?? null,
        provider: "gmail",
        config,
        isPrimary: isFirst === 0,
      },
    });
  }

  redirectUrl.searchParams.set("success", "gmail");
  return NextResponse.redirect(redirectUrl);
}
