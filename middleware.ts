import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/session",
  "/api/auth/clear-session",
  "/api/auth/google",
  "/api/auth/google/callback",
  /** Laptop agent uses Bearer token (not session cookie). */
  "/api/workstation/ingest",
];
const AUTH_PATHS = ["/login"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "?"));
}

function isAuthPath(pathname: string) {
  return AUTH_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Serve favicon: redirect to generated app icon so /favicon.ico does not 404
  if (pathname === "/favicon.ico") {
    return NextResponse.redirect(new URL("/icon", request.url), 302);
  }

  if (isPublic(pathname)) {
    if (isAuthPath(pathname)) {
      const session = request.cookies.get("nexium_session")?.value;
      if (session) return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const session = request.cookies.get("nexium_session")?.value;
  if (!session) {
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  // Redirect legacy sidebar routes into Settings tabs
  if (pathname === "/team") return NextResponse.redirect(new URL("/settings?tab=team", request.url));
  if (pathname === "/notifications") return NextResponse.redirect(new URL("/settings?tab=notifications", request.url));

  return NextResponse.next();
}

export const config = {
  // Match app routes; also match /favicon.ico so we can redirect to /icon
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)", "/favicon.ico"],
};
