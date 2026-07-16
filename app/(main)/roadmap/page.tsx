import { requireModuleAccess } from "@/lib/auth";
import { RoadmapView } from "@/components/roadmap/roadmap-view";

export default async function RoadmapPage() {
  const session = await requireModuleAccess("/roadmap");
  return (
    <RoadmapView
      role={session.role}
      organisationId={session.organisationId}
    />
  );
}
