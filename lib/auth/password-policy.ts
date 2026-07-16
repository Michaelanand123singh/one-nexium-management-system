import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 6;

export const newPasswordSchema = z
  .string()
  .min(
    PASSWORD_MIN_LENGTH,
    `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
  );

/** Authenticated user changing their own password (email login or adding a password after OAuth). */
export const selfChangePasswordBodySchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: newPasswordSchema,
});

/** Super Admin sets password for another org member’s user account. */
export const adminSetMemberPasswordBodySchema = z.object({
  newPassword: newPasswordSchema,
});
