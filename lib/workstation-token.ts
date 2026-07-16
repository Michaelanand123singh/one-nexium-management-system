import { createHash, randomBytes } from "crypto";

/** Opaque bearer token issued once at device registration (hex). */
export function generateIngestToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashIngestToken(plainToken: string): string {
  return createHash("sha256").update(plainToken, "utf8").digest("hex");
}
