import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManagePhases } from "@/lib/permissions";
import { z } from "zod";
import { PHASES } from "@/lib/constants";

const phaseRegex = /^Phase\s+\d+$/;
const phasesSchema = z.array(z.string().regex(phaseRegex, "Phase must match format 'Phase 1'")).min(1, "At least one phase is required");

/**
 * GET /api/settings/phases
 * Returns the organisation's phases list (admin view).
 */
export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const org = await prisma.organisation.findUnique({
        where: { id: session.organisationId },
        select: { phases: true },
    });

    const phases = Array.isArray(org?.phases) ? org.phases : PHASES;

    return NextResponse.json(phases);
}

/**
 * PUT /api/settings/phases
 * Replaces the organisation's phases list.
 * Restricted to SUPER_ADMIN and PRODUCT_MANAGER.
 */
export async function PUT(request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canManagePhases(session.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const phases = phasesSchema.parse(body);

        const unique = new Set(phases);
        if (unique.size !== phases.length) {
            return NextResponse.json({ error: "Duplicate phases are not allowed" }, { status: 400 });
        }

        const org = await prisma.organisation.update({
            where: { id: session.organisationId },
            data: { phases },
            select: { phases: true },
        });

        return NextResponse.json(org.phases);
    } catch (e: unknown) {
        if (e instanceof z.ZodError) {
            return NextResponse.json({ error: e.errors[0]?.message || "Invalid data" }, { status: 400 });
        }
        console.error("Failed to update phases:", e);
        return NextResponse.json({ error: "Failed to update phases" }, { status: 500 });
    }
}
