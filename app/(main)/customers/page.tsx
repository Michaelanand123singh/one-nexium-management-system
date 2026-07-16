import { requireModuleAccess } from "@/lib/auth";
import { CustomersView } from "@/components/customers/customers-view";

export default async function CustomersPage() {
  const session = await requireModuleAccess("/customers");
  return (
    <CustomersView
      role={session.role}
      organisationId={session.organisationId}
    />
  );
}
