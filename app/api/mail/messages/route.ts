import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionOr401 } from "@/lib/api-guard";
import { sendEmailForAccount } from "@/lib/mail-providers";

const sendSchema = z.object({
  accountId: z.string().optional(),
  threadId: z.string().optional(),
  to: z.union([z.string().email(), z.array(z.string().email())]),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  try {
    const body = await request.json();
    const data = sendSchema.parse(body);

    // Resolve mail account: use provided accountId or primary account for user
    let account =
      data.accountId &&
      (await prisma.mailAccount.findFirst({
        where: {
          id: data.accountId,
          organisationId: session.organisationId,
          userId: session.id,
          deletedAt: null,
        },
      }));

    if (!account) {
      account = await prisma.mailAccount.findFirst({
        where: {
          organisationId: session.organisationId,
          userId: session.id,
          deletedAt: null,
          isPrimary: true,
        },
      });
    }

    if (!account) {
      return NextResponse.json(
        { error: "No mail account configured for this user" },
        { status: 400 }
      );
    }

    const to = Array.isArray(data.to) ? data.to : [data.to];
    const cc = data.cc ? (Array.isArray(data.cc) ? data.cc : [data.cc]) : undefined;
    const bcc = data.bcc ? (Array.isArray(data.bcc) ? data.bcc : [data.bcc]) : undefined;

    await sendEmailForAccount(account, {
      to,
      subject: data.subject,
      text: data.text,
      html: data.html,
      from: account.email,
      fromName: account.displayName ?? undefined,
    });

    // Upsert thread
    let threadId = data.threadId;
    let thread;

    if (threadId) {
      thread = await prisma.mailThread.findFirst({
        where: {
          id: threadId,
          organisationId: session.organisationId,
          mailAccountId: account.id,
          deletedAt: null,
        },
      });
    }

    if (!thread) {
      thread = await prisma.mailThread.create({
        data: {
          organisationId: session.organisationId,
          mailAccountId: account.id,
          subject: data.subject,
          snippet: data.text?.slice(0, 200) ?? "",
          folder: "SENT",
        },
      });
      threadId = thread.id;
    }

    const now = new Date();

    const message = await prisma.mailMessage.create({
      data: {
        organisationId: session.organisationId,
        mailAccountId: account.id,
        threadId: threadId!,
        from: account.email,
        to: to.join(", "),
        cc: cc?.join(", "),
        bcc: bcc?.join(", "),
        subject: data.subject,
        bodyText: data.text ?? null,
        bodyHtml: data.html ?? null,
        direction: "OUTBOUND",
        folder: "SENT",
        isRead: true,
        sentAt: now,
        receivedAt: null,
      },
    });

    await prisma.mailThread.update({
      where: { id: threadId! },
      data: {
        lastMessageAt: now,
        snippet: data.text?.slice(0, 200) ?? thread?.snippet ?? "",
      },
    });

    return NextResponse.json(message);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }

    const message =
      e instanceof Error ? e.message : "Failed to send email";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

