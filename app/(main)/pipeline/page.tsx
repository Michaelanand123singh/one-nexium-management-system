import { requireModuleAccess } from "@/lib/auth";
import { PipelineView } from "@/components/pipeline/pipeline-view";

export default async function PipelinePage() {
  const session = await requireModuleAccess("/pipeline");
  return (
    <PipelineView
      role={session.role}
      organisationId={session.organisationId}
    />
  );
}
