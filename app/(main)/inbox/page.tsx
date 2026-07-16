import { requireModuleAccess } from "@/lib/auth";
import { InboxView } from "@/components/mail/inbox-view";

export default async function InboxPage() {
  const session = await requireModuleAccess("/inbox");
  return <InboxView role={session.role} />;
}

