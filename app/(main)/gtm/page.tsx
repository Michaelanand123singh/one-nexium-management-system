import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

/**
 * GTM UI soft-archived (YAGNI). APIs/components remain for seed & historical data.
 * Re-enable by restoring GtmView render and adding a NAV_MODULES entry.
 */
export default async function GtmPage() {
  await requireSession();
  redirect("/");
}
