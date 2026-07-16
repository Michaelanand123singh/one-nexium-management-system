import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEditGtm } from "@/lib/permissions";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? undefined;

  const where: Record<string, unknown> = {
    organisationId: session.organisationId,
    deletedAt: null,
  };
  if (type) where.type = type;

  const events = await prisma.gtmEvent.findMany({
    where,
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json(events);
}

const createSchema = z.object({
  name: z.string().min(1),
  type: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  goals: z.string().optional().nullable(),
  attendees: z.string().optional().nullable(),
  outcomeNotes: z.string().optional().nullable(),
  followUpTasks: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditGtm(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);
    const event = await prisma.gtmEvent.create({
      data: {
        organisationId: session.organisationId,
        name: data.name.trim(),
        type: data.type?.trim() ?? null,
        date: data.date ? new Date(data.date) : null,
        location: data.location?.trim() ?? null,
        goals: data.goals?.trim() ?? null,
        attendees: data.attendees?.trim() ?? null,
        outcomeNotes: data.outcomeNotes?.trim() ?? null,
        followUpTasks: data.followUpTasks?.trim() ?? null,
      },
    });
    return NextResponse.json(event);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}
