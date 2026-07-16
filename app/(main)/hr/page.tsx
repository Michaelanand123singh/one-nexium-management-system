import { requireModuleAccess } from "@/lib/auth";
import { HrView } from "@/components/hr/hr-view";

export default async function HrPage() {
  const session = await requireModuleAccess("/hr");
  return <HrView role={session.role} />;
}

