import type { Role } from "@prisma/client";
import { NAV_MODULES } from "@/lib/constants";

/**
 * Whether this role may open a sidebar module (single source of truth: NAV_MODULES).
 */
export function canAccessModulePath(role: Role, moduleHref: string): boolean {
  const mod = NAV_MODULES.find((m) => m.href === moduleHref);
  if (!mod) return false;
  return (mod.roles as readonly string[]).includes(role);
}
