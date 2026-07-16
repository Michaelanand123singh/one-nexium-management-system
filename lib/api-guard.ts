/**
 * API route helpers: session and permission guards.
 * Use in route handlers to avoid repeating getSession + 401/403.
 */
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import type { SessionUser } from "@/lib/auth";

/**
 * Get session or 401 Response. Use in API routes:
 *   const [session, err] = await getSessionOr401();
 *   if (err) return err;
 */
export async function getSessionOr401(): Promise<
  [SessionUser, null] | [null, NextResponse]
> {
  const session = await getSession();
  if (!session) {
    return [null, NextResponse.json({ error: "Unauthorized" }, { status: 401 })];
  }
  return [session, null];
}

/** Returns 403 JSON. */
export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

/** Returns 404 JSON. */
export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}
