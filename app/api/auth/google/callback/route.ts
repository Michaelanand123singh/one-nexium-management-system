import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { createSession, getSessionCookieOptions } from "@/lib/auth";
import { isGoogleSignInAllowed, getGoogleRedirectUriBase } from "@/lib/auth-google";
import type { Role } from "@prisma/client";

const DEFAULT_ROLE: Role = "DEVELOPER";
/** New Google sign-ins only get primary roles (YAGNI). */
const ROLES: Role[] = [
  "SUPER_ADMIN",
  "PRODUCT_MANAGER",
  "ENGINEERING_LEAD",
  "DEVELOPER",
];

function getDefaultRole(): Role {
  const r = process.env.DEFAULT_GOOGLE_SIGNIN_ROLE?.trim().toUpperCase();
  if (r && ROLES.includes(r as Role)) return r as Role;
  return DEFAULT_ROLE;
}

export async function GET(request: NextRequest) {
  const base = getGoogleRedirectUriBase(request.nextUrl.origin);
  const appUrl = process.env.NEXIUM_APP_URL?.trim()?.replace(/\/$/, "") || request.nextUrl.origin;
  const loginUrl = new URL("/login", appUrl);

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    loginUrl.searchParams.set(
      "error",
      error === "access_denied" ? "Google sign-in was cancelled" : error
    );
    return NextResponse.redirect(loginUrl);
  }

  if (!code || !state) {
    loginUrl.searchParams.set("error", "invalid_callback");
    return NextResponse.redirect(loginUrl);
  }

  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_login_state")?.value;
  cookieStore.delete("google_login_state");

  if (!storedState || storedState !== state) {
    loginUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(loginUrl);
  }

  let from = "/";
  try {
    const payload = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8")
    );
    if (typeof payload.from === "string") from = payload.from;
  } catch {
    // keep from = /
  }

  const redirectSuccess = new URL(from, appUrl);
  const redirectDenied = new URL("/login", appUrl);

  // Must match the redirect_uri used in /api/auth/google (same base from NEXIUM_APP_URL or request).
  const redirectUri = `${base}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri
  );

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.access_token) {
    redirectDenied.searchParams.set("error", "google_no_token");
    return NextResponse.redirect(redirectDenied);
  }

  oauth2Client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  const { data: userInfo } = await oauth2.userinfo.get();

  const email = userInfo.email?.trim();
  if (!email) {
    redirectDenied.searchParams.set("error", "google_no_email");
    return NextResponse.redirect(redirectDenied);
  }

  if (!isGoogleSignInAllowed(email)) {
    redirectDenied.searchParams.set(
      "error",
      "access_denied"
    );
    return NextResponse.redirect(redirectDenied);
  }

  const name = userInfo.name ?? userInfo.given_name ?? null;
  const picture = userInfo.picture ?? null;

  let user = await prisma.user.findUnique({
    where: { email: email.toLowerCase(), deletedAt: null },
    include: {
      memberships: {
        where: { status: "ACTIVE" },
        take: 1,
        include: { organisation: true },
      },
    },
  });

  if (!user) {
    const firstOrg = await prisma.organisation.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (!firstOrg) {
      redirectDenied.searchParams.set("error", "no_organisation");
      return NextResponse.redirect(redirectDenied);
    }

    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        avatarUrl: picture,
        passwordHash: null,
      },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          take: 1,
          include: { organisation: true },
        },
      },
    });

    await prisma.organisationMember.create({
      data: {
        organisationId: firstOrg.id,
        userId: user.id,
        role: getDefaultRole(),
        status: "ACTIVE",
      },
    });

    user = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        memberships: {
          where: { status: "ACTIVE" },
          take: 1,
          include: { organisation: true },
        },
      },
    })!;
  } else {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: name ?? user.name,
        avatarUrl: picture ?? user.avatarUrl,
      },
    });
  }

  const membership = user.memberships[0];
  if (!membership) {
    redirectDenied.searchParams.set("error", "no_membership");
    return NextResponse.redirect(redirectDenied);
  }

  const token = await createSession(user.id);
  const res = NextResponse.redirect(redirectSuccess);
  res.cookies.set("nexium_session", token, getSessionCookieOptions());
  return res;
}
