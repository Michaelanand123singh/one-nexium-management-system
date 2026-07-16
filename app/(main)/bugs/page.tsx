import { requireModuleAccess } from "@/lib/auth";
import { BugsView } from "@/components/bugs/bugs-view";

export default async function BugsPage() {
  const session = await requireModuleAccess("/bugs");
  return (
    <BugsView
      role={session.role}
      organisationId={session.organisationId}
    />
  );
}
