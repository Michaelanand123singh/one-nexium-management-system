/**
 * Fetch and resolve mail provider config for an organisation.
 * Uses org-level config from DB; falls back to env if not set.
 */
import { prisma } from "@/lib/db";
import { decrypt } from "./mail-encrypt";

export type ResolvedMailConfig = {
  googleClientId: string | null;
  googleClientSecret: string | null;
  resendApiKey: string | null;
  emailFrom: string;
  appUrl: string;
};

export async function getMailConfigForOrg(organisationId: string): Promise<ResolvedMailConfig> {
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { mailProviderConfig: true },
  });

  const raw = (org?.mailProviderConfig as Record<string, unknown> | null) ?? {};
  const fallback = {
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? null,
    resendApiKey: process.env.RESEND_API_KEY ?? null,
    emailFrom: process.env.EMAIL_FROM || process.env.DEFAULT_FROM || "no-reply@nexium-os.local",
    appUrl: process.env.NEXIUM_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };

  let googleClientSecret: string | null = null;
  if (typeof raw.googleClientSecret === "string") {
    if (raw.googleClientSecret.startsWith("enc:")) {
      try {
        googleClientSecret = decrypt(raw.googleClientSecret.slice(4));
      } catch {
        googleClientSecret = null;
      }
    } else {
      googleClientSecret = raw.googleClientSecret;
    }
  }
  if (!googleClientSecret) googleClientSecret = fallback.googleClientSecret;

  let resendApiKey: string | null = null;
  if (typeof raw.resendApiKey === "string") {
    if (raw.resendApiKey.startsWith("enc:")) {
      try {
        resendApiKey = decrypt(raw.resendApiKey.slice(4));
      } catch {
        resendApiKey = null;
      }
    } else {
      resendApiKey = raw.resendApiKey;
    }
  }
  if (!resendApiKey) resendApiKey = fallback.resendApiKey;

  return {
    googleClientId: (typeof raw.googleClientId === "string" ? raw.googleClientId : null) || fallback.googleClientId,
    googleClientSecret,
    resendApiKey,
    emailFrom: (typeof raw.emailFrom === "string" ? raw.emailFrom : null) || fallback.emailFrom,
    appUrl: (typeof raw.appUrl === "string" ? raw.appUrl : null) || fallback.appUrl,
  };
}
