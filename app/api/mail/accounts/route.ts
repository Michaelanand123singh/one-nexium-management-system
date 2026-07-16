import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionOr401 } from "@/lib/api-guard";
import { encrypt } from "@/lib/mail-encrypt";

const smtpConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean().optional(),
  user: z.string().min(1),
  password: z.string().min(1),
});

const upsertSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  provider: z.enum(["gmail", "smtp", "resend_only"]).optional(),
  config: z.unknown().optional(),
  smtp: smtpConfigSchema.optional(),
  isPrimary: z.boolean().optional(),
});

export async function GET() {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  const accounts = await prisma.mailAccount.findMany({
    where: {
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  const sanitized = accounts.map((a) => {
    const { config, ...rest } = a;
    let safeConfig: Record<string, unknown> | null = null;
    if (config && typeof config === "object") {
      const c = config as Record<string, unknown>;
      if (c.gmail) {
        safeConfig = { gmail: { connected: true } };
      } else if (c.smtp) {
        const s = c.smtp as Record<string, unknown>;
        safeConfig = {
          smtp: {
            host: s.host,
            port: s.port,
            secure: s.secure,
            user: s.user,
          },
        };
      }
    }
    return { ...rest, config: safeConfig };
  });

  return NextResponse.json(sanitized);
}

export async function POST(request: NextRequest) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  try {
    const body = await request.json();
    const data = upsertSchema.parse(body);

    let provider = data.provider ?? "resend_only";
    let config: Record<string, unknown> | null = null;

    if (data.smtp) {
      provider = "smtp";
      config = {
        smtp: {
          host: data.smtp.host,
          port: data.smtp.port,
          secure: data.smtp.secure ?? data.smtp.port === 465,
          user: data.smtp.user,
          password: `enc:${encrypt(data.smtp.password)}`,
        },
      };
    } else if (data.config && typeof data.config === "object") {
      config = data.config as Record<string, unknown>;
    }

    if (provider === "gmail") {
      return NextResponse.json(
        { error: "Use the Connect with Google button to add Gmail" },
        { status: 400 }
      );
    }

    if (provider === "smtp" && !config?.smtp) {
      return NextResponse.json(
        { error: "SMTP configuration is required" },
        { status: 400 }
      );
    }

    if (data.isPrimary) {
      await prisma.mailAccount.updateMany({
        where: {
          organisationId: session.organisationId,
          userId: session.id,
          deletedAt: null,
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    const account = await prisma.mailAccount.create({
      data: {
        organisationId: session.organisationId,
        userId: session.id,
        email: data.email,
        displayName: data.displayName ?? null,
        provider,
        config: config ? (config as Prisma.InputJsonValue) : undefined,
        isPrimary: data.isPrimary ?? false,
      },
    });

    return NextResponse.json(account);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create mail account" }, { status: 500 });
  }
}

