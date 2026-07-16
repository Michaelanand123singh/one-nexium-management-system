import { NextRequest, NextResponse } from "next/server";

import { getSessionCookieOptions } from "@/lib/auth";
import { resolveAppBaseUrl } from "@/lib/app-base-url";

const SESSION_COOKIE = "nexium_session";

/**
 * Clears session cookie (e.g. stale token after DB reset) and redirects to login.
 * Must be a Route Handler — Server Components cannot call cookies().set() in Next.js 15+.
 */
export async function GET(request: NextRequest) {
  const login = new URL("/login", resolveAppBaseUrl(request.url));
  const from = request.nextUrl.searchParams.get("from");
  if (from && from.startsWith("/") && !from.startsWith("//") && from !== "/login") {
    login.searchParams.set("from", from);
  }
  const res = NextResponse.redirect(login);
  res.cookies.set(SESSION_COOKIE, "", { ...getSessionCookieOptions(), maxAge: 0 });
  return res;
}
