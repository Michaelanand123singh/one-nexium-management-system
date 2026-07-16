import { requireModuleAccess } from "@/lib/auth";
import { TerminalView } from "@/components/terminal/terminal-view";

export default async function TerminalPage() {
  const session = await requireModuleAccess("/terminal");
  return (
    <TerminalView
      role={session.role}
      organisationId={session.organisationId}
    />
  );
}
