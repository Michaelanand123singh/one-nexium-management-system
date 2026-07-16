import { requireModuleAccess } from "@/lib/auth";
import { PlanningView } from "@/components/planning/planning-view";

export default async function PlanningPage() {
  await requireModuleAccess("/planning");
  return <PlanningView />;
}
