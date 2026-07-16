import { z } from "zod";
import type { Department, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { newPasswordSchema } from "@/lib/auth/password-policy";

export const teamMemberRoleSchema = z.enum([
  "SUPER_ADMIN",
  "PRODUCT_MANAGER",
  "ENGINEERING_LEAD",
  "DEVELOPER",
]);

/** Allow legacy roles on PATCH so existing GTM/CS members still update without enum errors. */
export const teamMemberRolePatchSchema = z.enum([
  "SUPER_ADMIN",
  "PRODUCT_MANAGER",
  "ENGINEERING_LEAD",
  "DEVELOPER",
  "GTM_MANAGER",
  "CUSTOMER_SUCCESS",
]);

export const addTeamMemberSchema = z.object({
  name: z.string().trim().min(0).max(256).optional(),
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  password: newPasswordSchema.optional(),
  role: teamMemberRoleSchema,
  department: z
    .enum(["PRODUCT", "ENGINEERING", "GTM", "CUSTOMER_SUCCESS", "LEADERSHIP"])
    .optional()
    .nullable(),
});

export const patchTeamMemberSchema = z.object({
  role: teamMemberRolePatchSchema.optional(),
  department: z
    .enum(["PRODUCT", "ENGINEERING", "GTM", "CUSTOMER_SUCCESS", "LEADERSHIP"])
    .optional()
    .nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type TeamMemberApiRow = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: Role;
  department: Department | null;
  status: string;
  joinedAt: Date;
};

export function toTeamMemberApiRow(m: {
  id: string;
  userId: string;
  role: Role;
  department: Department | null;
  status: string;
  joinedAt: Date;
  user: { name: string | null; email: string };
}): TeamMemberApiRow {
  return {
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    department: m.department,
    status: m.status,
    joinedAt: m.joinedAt,
  };
}

export async function countActiveSuperAdmins(organisationId: string): Promise<number> {
  return prisma.organisationMember.count({
    where: { organisationId, role: "SUPER_ADMIN", status: "ACTIVE" },
  });
}

export function soleActiveSuperAdminBlocked(
  member: { role: Role; status: string },
  activeSuperAdminCount: number
): boolean {
  return (
    member.role === "SUPER_ADMIN" &&
    member.status === "ACTIVE" &&
    activeSuperAdminCount <= 1
  );
}
