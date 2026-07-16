import { requireModuleAccess } from "@/lib/auth";
import { DocumentsView } from "@/components/documents/documents-view";

export default async function DocumentsPage() {
  await requireModuleAccess("/documents");
  return <DocumentsView />;
}
