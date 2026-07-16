import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PHASES } from "@/lib/constants";

/**
 * GET /api/quarters
 * Returns the organisation's phases list (roadmap/OKR stages).
 * Kept path for backward compatibility; returns Phase 1, Phase 2, ...
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
