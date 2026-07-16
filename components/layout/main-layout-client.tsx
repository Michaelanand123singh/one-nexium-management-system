"use client";

import { useState } from "react";
import { PhaseProvider } from "@/lib/phase-context";
import { Navbar } from "@/components/layout/navbar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { SessionUser } from "@/lib/auth";

export function MainLayoutClient({
  session,
  children,
}: {
  session: SessionUser;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <PhaseProvider>
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <Navbar
          session={session}
          sidebarOpen={sidebarOpen}
          onSidebarToggle={() => setSidebarOpen((p) => !p)}
        />
        <div className="flex min-h-0 flex-1">
          <AppSidebar role={session.role} open={sidebarOpen} />
          <main className="min-w-0 flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </PhaseProvider>
  );
}
