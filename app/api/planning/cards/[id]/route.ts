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

const patchSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    notesJson: z.any().optional().nullable(),
    description: z.string().max(8000).optional().nullable(),
    bucketId: z.string().min(1).optional(),
    plannedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    status: z.enum(["OPEN", "DONE"]).optional(),
    taskId: z.string().nullable().optional(),
    sortOrder: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.notesJson != null && data.notesJson !== null && !isValidTipTapDoc(data.notesJson)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid notesJson", path: ["notesJson"] });
    }
  });

function resolvePersistedNotesPatch(
  notesJson: unknown | undefined | null,
  legacyDescription: string | null | undefined,
  hadNotesField: boolean,
  hadDescField: boolean
): { notesJson?: unknown | null; description?: string | null } {
  if (hadNotesField) {
    if (notesJson === null) {
      return {
        notesJson: null,
        description: null,
      };
    }
    if (notesJson !== undefined && isValidTipTapDoc(notesJson)) {
      const plain = extractPlainTextFromNotesJson(notesJson) || null;
      return { notesJson, description: plain };
    }
  }
  if (hadDescField && legacyDescription !== undefined) {
    if (legacyDescription === null || !legacyDescription.trim()) {
      return { notesJson: null, description: null };
    }
    const doc = plainTextToTipTapDoc(legacyDescription.trim());
    return {
      notesJson: doc,
      description: extractPlainTextFromNotesJson(doc) || null,
    };
  }
  return {};
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUsePlanning(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.planningCard.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = await request.json();
    const data = patchSchema.parse(body);
    const hadNotesField = Object.prototype.hasOwnProperty.call(body, "notesJson");
    const hadDescField = Object.prototype.hasOwnProperty.call(body, "description");

    const updates: Record<string, unknown> = {};
    if (data.title !== undefined) updates.title = data.title.trim();
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
    if (data.taskId !== undefined) {
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
      updates.taskId = data.taskId;
    }

    if (data.plannedDate !== undefined) {
      updates.plannedDate =
        data.plannedDate === null ? null : utcMidnightFromDateKey(data.plannedDate);
    }

    if (data.status !== undefined) {
      updates.status = data.status;
      updates.completedAt = data.status === "DONE" ? new Date() : null;
    }

    const notePatch = resolvePersistedNotesPatch(
      data.notesJson,
      data.description,
      hadNotesField,
      hadDescField
    );
    if (Object.keys(notePatch).length > 0) {
      if ("notesJson" in notePatch) updates.notesJson = notePatch.notesJson;
      if ("description" in notePatch) updates.description = notePatch.description;
    }

    if (data.bucketId !== undefined) {
      const bucket = await prisma.planningBucket.findFirst({
        where: {
          id: data.bucketId,
          organisationId: session.organisationId,
          userId: session.id,
          deletedAt: null,
        },
      });
      if (!bucket) return NextResponse.json({ error: "Bucket not found" }, { status: 404 });
      updates.bucketId = data.bucketId;

      if (isDoneBucketName(bucket.name)) {
        updates.status = "DONE";
        updates.completedAt = new Date();
      } else if (existing.status === "DONE") {
        updates.status = "OPEN";
        updates.completedAt = null;
      }
    }

    const card = await prisma.planningCard.update({
      where: { id },
      data: updates,
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
    return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canUsePlanning(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.planningCard.findFirst({
    where: {
      id,
      organisationId: session.organisationId,
      userId: session.id,
      deletedAt: null,
    },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.$transaction([
    prisma.planningCardAttachment.deleteMany({ where: { planningCardId: id } }),
    prisma.planningCard.update({
      where: { id },
      data: { deletedAt: new Date() },
    }),
  ]);
  return NextResponse.json({ ok: true });
}
