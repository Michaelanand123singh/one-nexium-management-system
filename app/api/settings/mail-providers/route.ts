import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionOr401 } from "@/lib/api-guard";
import { canManageMailProviderConfig } from "@/lib/permissions";
import { forbidden } from "@/lib/api-guard";
import { encrypt } from "@/lib/mail-encrypt";

const configSchema = z.object({
  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  resendApiKey: z.string().optional(),
  emailFrom: z.string().email().optional().or(z.literal("")),
  appUrl: z.string().url().optional().or(z.literal("")),
});

export type MailProviderConfig = {
  googleClientId?: string;
  googleClientSecret?: string;
  resendApiKey?: string;
  emailFrom?: string;
  appUrl?: string;
};

function maskSecret(s: string | undefined): string {
  if (!s) return "";
  if (s.startsWith("enc:")) return "••••••••";
  return s.length > 8 ? `${s.slice(0, 4)}••••${s.slice(-2)}` : "••••";
}

export async function GET() {
  const [session, err] = await getSessionOr401();
  if (err) return err;
  if (!canManageMailProviderConfig(session.role)) {
    return forbidden("Only Super Admin can view mail provider config");
  }

  const org = await prisma.organisation.findUnique({
    where: { id: session.organisationId },
    select: { mailProviderConfig: true },
  });

  const raw = (org?.mailProviderConfig as Record<string, unknown> | null) ?? {};
  const config: Record<string, string> = {};

  if (typeof raw.googleClientId === "string") config.googleClientId = raw.googleClientId;
  if (typeof raw.googleClientSecret === "string") {
    config.googleClientSecret = raw.googleClientSecret.startsWith("enc:")
      ? maskSecret(raw.googleClientSecret)
      : maskSecret(raw.googleClientSecret);
  }
  if (typeof raw.resendApiKey === "string") {
    config.resendApiKey = raw.resendApiKey.startsWith("enc:")
      ? maskSecret(raw.resendApiKey)
      : maskSecret(raw.resendApiKey);
  }
  if (typeof raw.emailFrom === "string") config.emailFrom = raw.emailFrom;
  if (typeof raw.appUrl === "string") config.appUrl = raw.appUrl;

  return NextResponse.json(config);
}

export async function PUT(request: NextRequest) {
  const [session, err] = await getSessionOr401();
  if (err) return err;
  if (!canManageMailProviderConfig(session.role)) {
    return forbidden("Only Super Admin can configure mail providers");
  }

  try {
    const body = await request.json();
    const data = configSchema.parse(body);

    const org = await prisma.organisation.findUnique({
      where: { id: session.organisationId },
      select: { mailProviderConfig: true },
    });

    const existing = (org?.mailProviderConfig as Record<string, unknown> | null) ?? {};
    const merged: Record<string, unknown> = { ...existing };

    if (data.googleClientId !== undefined) merged.googleClientId = data.googleClientId || null;
    if (data.googleClientSecret !== undefined && data.googleClientSecret) {
      merged.googleClientSecret = `enc:${encrypt(data.googleClientSecret)}`;
    }
    if (data.resendApiKey !== undefined && data.resendApiKey) {
      merged.resendApiKey = `enc:${encrypt(data.resendApiKey)}`;
    }
    if (data.emailFrom !== undefined) merged.emailFrom = data.emailFrom || null;
    if (data.appUrl !== undefined) merged.appUrl = data.appUrl || null;

    await prisma.organisation.update({
      where: { id: session.organisationId },
      data: { mailProviderConfig: merged as Prisma.InputJsonValue },
    });

    const out: Record<string, string> = {};
    if (merged.googleClientId) out.googleClientId = merged.googleClientId as string;
    if (merged.googleClientSecret) out.googleClientSecret = maskSecret(merged.googleClientSecret as string);
    if (merged.resendApiKey) out.resendApiKey = maskSecret(merged.resendApiKey as string);
    if (merged.emailFrom) out.emailFrom = merged.emailFrom as string;
    if (merged.appUrl) out.appUrl = merged.appUrl as string;

    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
