import { requireSession } from "@/lib/auth";
import { MainLayoutClient } from "@/components/layout/main-layout-client";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  return <MainLayoutClient session={session}>{children}</MainLayoutClient>;
}
