import { requireModuleAccess } from "@/lib/auth";
import { InfrastructureView } from "@/components/infrastructure/infrastructure-view";

export default async function InfrastructurePage() {
  const session = await requireModuleAccess("/infrastructure");
  return (
    <InfrastructureView
      role={session.role}
      organisationId={session.organisationId}
    />
  );
}
