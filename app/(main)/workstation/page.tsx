import { requireModuleAccess } from "@/lib/auth";
import { WorkstationView } from "@/components/workstation/workstation-view";

export default async function WorkstationPage() {
  const session = await requireModuleAccess("/workstation");
  return <WorkstationView role={session.role} />;
}
