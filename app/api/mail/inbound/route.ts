import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Inbound email webhook endpoint.
 *
 * This is intentionally generic: different providers (Resend inbound,
 * Postmark, SendGrid, etc.) can be adapted by a small adapter that
 * POSTs a normalised payload here.
 *
 * Expected JSON body (normalised by your email gateway):
 * {
 *   organisationId: string;
 *   accountEmail: string;
 *   from: string;
 *   to: string[];
 *   cc?: string[];
 *   subject?: string;
 *   text?: string;
 *   html?: string;
 *   providerMessageId?: string;
 * }
 */
export async function POST(request: NextRequest) {
  // NOTE: This route is intentionally unauthenticated; protect it via a
  // secret token in headers in your email gateway configuration.
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    organisationId,
    accountEmail,
    from,
    to,
    cc,
    subject,
    text,
    html,
    providerMessageId,
  } = body as {
    organisationId?: string;
    accountEmail?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    subject?: string;
    text?: string;
    html?: string;
    providerMessageId?: string;
  };

  if (!organisationId || !accountEmail || !from || !to || !to.length) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const account = await prisma.mailAccount.findFirst({
    where: {
      organisationId,
      email: accountEmail,
      deletedAt: null,
    },
  });

  if (!account) {
    return NextResponse.json(
      { error: "Mail account not found for organisation" },
      { status: 404 }
    );
  }

  // Simple threading: group by subject for now
  const threadSubject = subject || "(no subject)";

  let thread = await prisma.mailThread.findFirst({
    where: {
      organisationId,
      mailAccountId: account.id,
      subject: threadSubject,
      deletedAt: null,
    },
  });

  if (!thread) {
    thread = await prisma.mailThread.create({
      data: {
        organisationId,
        mailAccountId: account.id,
        subject: threadSubject,
        snippet: text?.slice(0, 200) ?? "",
        folder: "INBOX",
      },
    });
  }

  const now = new Date();

  await prisma.mailMessage.create({
    data: {
      organisationId,
      mailAccountId: account.id,
      threadId: thread.id,
      providerMessageId: providerMessageId ?? null,
      from,
      to: to.join(", "),
      cc: cc?.join(", "),
      bcc: null,
      subject: subject ?? null,
      bodyText: text ?? null,
      bodyHtml: html ?? null,
      direction: "INBOUND",
      folder: "INBOX",
      isRead: false,
      sentAt: null,
      receivedAt: now,
    },
  });

  await prisma.mailThread.update({
    where: { id: thread.id },
    data: {
      lastMessageAt: now,
      snippet: text?.slice(0, 200) ?? thread.snippet ?? "",
      unreadCount: thread.unreadCount + 1,
    },
  });

  return NextResponse.json({ success: true });
}

