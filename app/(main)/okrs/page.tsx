import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

/**
 * OKRs UI soft-archived (YAGNI). APIs/components remain for dashboard & pipeline widgets.
 * Re-enable by restoring OkrsView render and adding a NAV_MODULES entry.
 */
export default async function OKRsPage() {
  await requireSession();
  redirect("/");
}
