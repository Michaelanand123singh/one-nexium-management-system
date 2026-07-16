/**
 * Centralised role-based permissions for the app.
 * Used by API routes and UI to show/hide or allow actions.
 */
import type { Role } from "@prisma/client";

// ─── Settings (Phases) ─────────────────────────────────────────────────────
export function canManagePhases(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "PRODUCT_MANAGER";
}

// ─── Roadmap
export function canEditRoadmap(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "PRODUCT_MANAGER";
}

export function canEditRoadmapItem(
  role: Role,
  assignedTeam: string | null
): boolean {
  if (role === "SUPER_ADMIN" || role === "PRODUCT_MANAGER") return true;
  if (role === "ENGINEERING_LEAD" && assignedTeam === "Engineering") return true;
  return false;
}

export function canSetPublicRoadmap(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function canUpdateEngineeringItemStatus(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "PRODUCT_MANAGER" || role === "ENGINEERING_LEAD";
}

// ─── Backlog & Feature requests ───────────────────────────────────────────
export function canEditBacklog(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "PRODUCT_MANAGER";
}

// ─── Sprint & Tasks ────────────────────────────────────────────────────────
export function canEditSprint(role: Role): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "PRODUCT_MANAGER" ||
    role === "ENGINEERING_LEAD" ||
    role === "DEVELOPER"
  );
}

// ─── Bug Tracker ───────────────────────────────────────────────────────────
export function canEditBugs(role: Role): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "PRODUCT_MANAGER" ||
    role === "ENGINEERING_LEAD" ||
    role === "DEVELOPER"
  );
}

// ─── OKR & Goals (UI archived; APIs kept for dashboard/pipeline data) ───────
export function canEditOkrs(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "PRODUCT_MANAGER";
}

// ─── GTM (UI archived; APIs kept for seed/history) ────────────────────────
export function canEditGtm(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

// ─── Customer Success ─────────────────────────────────────────────────────
export function canEditCustomerSuccess(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "CUSTOMER_SUCCESS";
}

// ─── Mail Provider Config (org-level credentials for Gmail OAuth, Resend) ───
export function canManageMailProviderConfig(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

// ─── Infrastructure (AWS status and light actions: EC2 start/stop, etc.) ─────
export function canViewInfrastructure(role: Role): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "ENGINEERING_LEAD" ||
    role === "PRODUCT_MANAGER" ||
    role === "DEVELOPER"
  );
}

export function canManageInfrastructure(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ENGINEERING_LEAD";
}

// ─── AI Terminal (natural language → command execution) ────────────────────
export function canUseAITerminal(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "ENGINEERING_LEAD";
}

// ─── Planning (personal board + calendar) ─────────────────────────────────
/** Any authenticated member with app access may use their own planning board. */
export function canUsePlanning(role: Role): boolean {
  void role;
  return true;
}

// ─── HR & Onboarding ───────────────────────────────────────────────────────

/** High-level access check for showing HR module in nav. */
export function canViewHr(role: Role): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "PRODUCT_MANAGER" ||
    role === "ENGINEERING_LEAD"
  );
}

/** Fine-grained check for managing onboarding records. */
export function canManageOnboarding(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "PRODUCT_MANAGER";
}

/** Check if a member may at least view onboarding assigned to them. */
export function canViewOwnOnboarding(role: Role): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "PRODUCT_MANAGER" ||
    role === "ENGINEERING_LEAD" ||
    role === "DEVELOPER"
  );
}

// ─── Workstation agent (telemetry) ─────────────────────────────────────────
export function canManageWorkstationDevices(role: Role): boolean {
  return role === "SUPER_ADMIN";
}

export function canViewWorkstationTelemetry(role: Role): boolean {
  return (
    role === "SUPER_ADMIN" ||
    role === "ENGINEERING_LEAD" ||
    role === "PRODUCT_MANAGER"
  );
}
