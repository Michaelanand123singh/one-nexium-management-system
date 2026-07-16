export type PlanningTaskRef = { id: string; title: string };

export type PlanningCardAttachmentDTO = {
  id: string;
  planningCardId: string;
  url: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  createdAt: string;
};

export type PlanningCardDTO = {
  id: string;
  title: string;
  description: string | null;
  notesJson: unknown | null;
  plannedDate: string | null;
  status: "OPEN" | "DONE";
  bucketId: string;
  sortOrder: number;
  taskId: string | null;
  task?: PlanningTaskRef | null;
  bucket?: { id: string; name: string };
  attachments?: PlanningCardAttachmentDTO[];
};

export type PlanningBucketDTO = {
  id: string;
  name: string;
  sortOrder: number;
  cards: PlanningCardDTO[];
};

export type PlanningBoardResponse = {
  buckets: PlanningBucketDTO[];
};
