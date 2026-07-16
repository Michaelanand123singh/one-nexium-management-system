import { requireModuleAccess } from "@/lib/auth";
import { SprintView } from "@/components/sprint/sprint-view";

export default async function SprintPage() {
  const session = await requireModuleAccess("/sprint");
  return (
    <SprintView
      role={session.role}
      organisationId={session.organisationId}
    />
  );
}
