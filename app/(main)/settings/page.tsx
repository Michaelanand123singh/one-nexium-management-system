import { requireModuleAccess } from "@/lib/auth";
import { SettingsView } from "@/components/settings/settings-view";

export default async function SettingsPage() {
  const session = await requireModuleAccess("/settings");
  return <SettingsView role={session.role} currentUserId={session.id} />;
}
