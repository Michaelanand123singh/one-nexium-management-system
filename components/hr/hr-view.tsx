"use client";

import { PageShell } from "@/components/layout/page-shell";
import { useMemo } from "react";
import type { Role } from "@prisma/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { OnboardingList } from "@/components/hr/onboarding-list";
import { canManageOnboarding, canViewHr } from "@/lib/permissions";

type Props = {
  role: Role;
};

export function HrView({ role }: Props) {
  const canView = useMemo(() => canViewHr(role), [role]);
  const canManage = useMemo(() => canManageOnboarding(role), [role]);

  if (!canView) {
    return (
      <PageShell
        title="HR & Onboarding"
        description="You do not have access to this module."
      >
        <p className="text-sm text-muted-foreground">
          Ask an administrator to grant you HR access.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="HR & Onboarding"
      description="Central place to manage new joiner onboarding for your organisation."
    >
      <Tabs defaultValue="onboarding" className="space-y-4">
        <TabsList>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        </TabsList>
        <TabsContent value="onboarding">
          <OnboardingList canManage={canManage} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}

