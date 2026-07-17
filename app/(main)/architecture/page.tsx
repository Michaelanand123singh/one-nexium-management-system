import { requireModuleAccess } from "@/lib/auth";
import { ArchitectureView } from "@/components/architecture/architecture-view";

export default async function ArchitecturePage() {
  await requireModuleAccess("/architecture");
  return <ArchitectureView />;
}
