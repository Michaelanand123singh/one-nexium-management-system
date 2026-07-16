/** Prisma include fragment for planning card API responses (DRY). */
export const planningCardApiInclude = {
  task: { select: { id: true, title: true } as const },
  attachments: { orderBy: { createdAt: "asc" as const } },
} as const;
