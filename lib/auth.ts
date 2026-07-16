import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";

/** Cookie name for the browser session (used by API routes that need the raw token). */
export const NEXIUM_SESSION_COOKIE = "nexium_session";
const SESSION_DAYS = 7;

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  organisationId: string;
  organisationName: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);
  await prisma.session.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(NEXIUM_SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: "ACTIVE" },
              take: 1,
              include: { organisation: true },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    const membership = session.user.memberships[0];
    if (!membership) return null;

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: membership.role,
      organisationId: membership.organisation.id,
      organisationName: membership.organisation.name,
    };
  } catch (e) {
    // DB unreachable or schema mismatch (e.g. migration not run); treat as no session
    if (process.env.NODE_ENV === "development") {
      console.error("[auth] getSession failed:", e);
    }
    return null;
  }
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    // Cannot use cookies().set() here (Server Component) — Next.js 15 throws. Clear via Route Handler.
    redirect("/api/auth/clear-session");
  }
  return session;
}

/**
 * Require login and that the user's role may open this module (matches NAV_MODULES).
 * Unauthorized roles are redirected home — prevents deep-linking past the sidebar.
 */
export async function requireModuleAccess(moduleHref: string): Promise<SessionUser> {
  const session = await requireSession();
  const { canAccessModulePath } = await import("@/lib/route-access");
  if (!canAccessModulePath(session.role, moduleHref)) {
    redirect("/");
  }
  return session;
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

/** Invalidate other login sessions for this user; keeps the current browser session. */
export async function revokeOtherSessions(userId: string, keepToken: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId, token: { not: keepToken } },
  });
}

/** Sign out this user everywhere (e.g. after an admin password reset). */
export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export function getSessionCookieOptions() {
  const appUrl = process.env.NEXIUM_APP_URL?.trim() ?? "";
  const secure =
    appUrl.startsWith("https://") ||
    process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    path: "/",
  };
}
