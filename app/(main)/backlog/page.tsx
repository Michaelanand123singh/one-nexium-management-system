import { requireModuleAccess } from "@/lib/auth";
import { BacklogView } from "@/components/backlog/backlog-view";

export default async function BacklogPage() {
  const session = await requireModuleAccess("/backlog");
  return (
    <BacklogView
      role={session.role}
      organisationId={session.organisationId}
    />
  );
}
