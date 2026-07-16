import { requireModuleAccess } from "@/lib/auth";
import { CommandCentreDashboard } from "@/components/dashboard/command-centre";

export default async function CommandCentrePage() {
  const session = await requireModuleAccess("/");
  return <CommandCentreDashboard role={session.role} organisationId={session.organisationId} />;
}
