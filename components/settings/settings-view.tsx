"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/layout/page-shell";
import { UserCog, Bell, Mail, KeyRound, Layers } from "lucide-react";
import { TeamTab } from "@/components/settings/team-tab";
import { NotificationsTab } from "@/components/settings/notifications-tab";
import { EmailTab } from "@/components/settings/email-tab";
import { AccountTab } from "@/components/settings/account-tab";
import { WorkspaceTab } from "@/components/settings/workspace-tab";
import { canManagePhases } from "@/lib/permissions";

export type SettingsTab = "team" | "workspace" | "notifications" | "email" | "account";

const ALL_TABS: {
  id: SettingsTab;
  label: string;
  icon: React.ReactNode;
  phasesOnly?: boolean;
}[] = [
  { id: "team", label: "Team & People", icon: <UserCog className="h-4 w-4" /> },
  { id: "workspace", label: "Workspace", icon: <Layers className="h-4 w-4" />, phasesOnly: true },
  { id: "account", label: "Account", icon: <KeyRound className="h-4 w-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { id: "email", label: "Email", icon: <Mail className="h-4 w-4" /> },
];

export function SettingsView({
  role,
  currentUserId,
}: {
  role: Role;
  currentUserId: string;
}) {
  const searchParams = useSearchParams();
  const showWorkspace = canManagePhases(role);
  const tabs = ALL_TABS.filter((t) => !t.phasesOnly || showWorkspace);

  const [tab, setTab] = useState<SettingsTab>(() => {
    const t = searchParams.get("tab") as SettingsTab;
    if (t === "workspace" && !canManagePhases(role)) return "team";
    if (t && ["team", "workspace", "account", "notifications", "email"].includes(t)) return t;
    return "team";
  });

  useEffect(() => {
    const t = searchParams.get("tab") as SettingsTab;
    if (t === "workspace" && !showWorkspace) {
      setTab("team");
      return;
    }
    if (t === "team" || t === "workspace" || t === "account" || t === "notifications" || t === "email") {
      setTab(t);
    }
  }, [searchParams, showWorkspace]);

  const setTabAndUrl = useCallback((t: SettingsTab) => {
    setTab(t);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", t);
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  return (
    <PageShell
      title="Settings"
      description="Team, workspace phases, account, notifications, and email"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-border p-1">
          {tabs.map((t) => (
            <Button
              key={t.id}
              variant={tab === t.id ? "secondary" : "ghost"}
              size="sm"
              className="gap-1.5"
              onClick={() => setTabAndUrl(t.id)}
            >
              {t.icon}
              {t.label}
            </Button>
          ))}
        </div>

        {tab === "team" && <TeamTab role={role} currentUserId={currentUserId} />}
        {tab === "workspace" && showWorkspace && <WorkspaceTab role={role} />}
        {tab === "account" && <AccountTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "email" && <EmailTab role={role} />}
      </div>
    </PageShell>
  );
}
