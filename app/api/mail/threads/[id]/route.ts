import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOr401, notFound } from "@/lib/api-guard";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  const { id } = await params;
  const thread = await prisma.mailThread.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      deletedAt: null,
      mailAccount: {
        userId: session.id,
        deletedAt: null,
      },
    },
    include: {
      mailAccount: {
        select: { id: true, email: true, displayName: true },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!thread) {
    return notFound("Thread not found");
  }

  // Mark all messages in the thread as read for this account
  await prisma.mailMessage.updateMany({
    where: {
      threadId: thread.id,
      mailAccountId: thread.mailAccountId,
      organisationId: session.organisationId,
      isRead: false,
    },
    data: { isRead: true },
  });

  await prisma.mailThread.update({
    where: { id: thread.id },
    data: { unreadCount: 0 },
  });

  return NextResponse.json(thread);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const [session, err] = await getSessionOr401();
  if (err) return err;

  const { id } = await params;
  const thread = await prisma.mailThread.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      deletedAt: null,
      mailAccount: {
        userId: session.id,
        deletedAt: null,
      },
    },
  });

  if (!thread) {
    return notFound("Thread not found");
  }

  type PatchBody = { folder?: string; markRead?: boolean; markUnread?: boolean };
  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const { folder, markRead, markUnread } = body;

  if (!folder && !markRead && !markUnread) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  if (folder) {
    await prisma.mailThread.update({
      where: { id: thread.id },
      data: { folder },
    });
  }

  if (markRead) {
    await prisma.mailMessage.updateMany({
      where: {
        threadId: thread.id,
        organisationId: session.organisationId,
        mailAccountId: thread.mailAccountId,
        isRead: false,
      },
      data: { isRead: true },
    });
    await prisma.mailThread.update({
      where: { id: thread.id },
      data: { unreadCount: 0 },
    });
  }

  if (markUnread) {
    // Mark all messages as unread and set unreadCount to total messages
    const count = await prisma.mailMessage.count({
      where: {
        threadId: thread.id,
        organisationId: session.organisationId,
        mailAccountId: thread.mailAccountId,
      },
    });

    await prisma.mailMessage.updateMany({
      where: {
        threadId: thread.id,
        organisationId: session.organisationId,
        mailAccountId: thread.mailAccountId,
      },
      data: { isRead: false },
    });

    await prisma.mailThread.update({
      where: { id: thread.id },
      data: { unreadCount: count },
    });
  }

  const updated = await prisma.mailThread.findUnique({
    where: { id: thread.id },
    include: {
      mailAccount: { select: { id: true, email: true, displayName: true } },
    },
  });

  return NextResponse.json(updated);
}

