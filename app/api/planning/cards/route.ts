import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canUsePlanning } from "@/lib/permissions";
import { isDoneBucketName, utcMidnightFromDateKey } from "@/lib/planning";
import {
  extractPlainTextFromNotesJson,
  isValidTipTapDoc,
  plainTextToTipTapDoc,
} from "@/lib/planning-notes";
import { planningCardApiInclude } from "@/lib/planning-card-include";
import { z } from "zod";

const createSchema = z
  .object({
    title: z.string().min(1).max(500),
    notesJson: z.any().optional().nullable(),
    description: z.string().max(8000).optional().nullable(),
    bucketId: z.string().min(1),
    plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    taskId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.notesJson != null && data.notesJson !== null && !isValidTipTapDoc(data.notesJson)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid notesJson", path: ["notesJson"] });
    }
  });

function resolvePersistedNotes(
  notesJson: unknown | undefined | null,
  legacyDescription: string | null | undefined
): unknown | null {
  if (notesJson !== undefined) {
    if (notesJson === null) return null;
    if (!isValidTipTapDoc(notesJson)) return null;
    return notesJson;
  }
  if (legacyDescription?.trim()) return plainTextToTipTapDoc(legacyDescription.trim());
  return null;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUsePlanning(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createSchema.parse(body);

    const bucket = await prisma.planningBucket.findFirst({
      where: {
        id: data.bucketId,
        organisationId: session.organisationId,
        userId: session.id,
        deletedAt: null,
      },
    });
    if (!bucket) return NextResponse.json({ error: "Bucket not found" }, { status: 404 });

    if (data.taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: data.taskId,
          organisationId: session.organisationId,
          deletedAt: null,
        },
      });
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const agg = await prisma.planningCard.aggregate({
      where: { bucketId: data.bucketId, deletedAt: null },
      _max: { sortOrder: true },
    });
    const sortOrder = (agg._max.sortOrder ?? -1) + 1;

    const inDoneBucket = isDoneBucketName(bucket.name);
    const now = new Date();

    const persistedNotes = resolvePersistedNotes(data.notesJson, data.description);
    const descriptionPlain =
      persistedNotes != null ? extractPlainTextFromNotesJson(persistedNotes) || null : null;

    const created = await prisma.planningCard.create({
      data: {
        organisationId: session.organisationId,
        userId: session.id,
        bucketId: data.bucketId,
        title: data.title.trim(),
        description: descriptionPlain,
        notesJson: persistedNotes,
        plannedDate: data.plannedDate ? utcMidnightFromDateKey(data.plannedDate) : null,
        taskId: data.taskId ?? null,
        sortOrder,
        status: inDoneBucket ? "DONE" : "OPEN",
        completedAt: inDoneBucket ? now : null,
      },
    });

    const card = await prisma.planningCard.findUniqueOrThrow({
      where: { id: created.id },
      include: planningCardApiInclude,
    });

    return NextResponse.json(card);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.flatten() }, { status: 400 });
    }
    if (e instanceof Error && e.message === "Invalid date key") {
      return NextResponse.json({ error: "Invalid plannedDate" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to create card" }, { status: 500 });
  }
}
