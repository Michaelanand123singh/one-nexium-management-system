"use client";

import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/components/layout/page-shell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ArchitectureFlowDiagram } from "@/components/architecture/architecture-flow-diagram";
import { HldView } from "@/components/architecture/hld-view";
import { LldView } from "@/components/architecture/lld-view";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { ArchitectureDocs } from "@/components/architecture/types";

export function ArchitectureView() {
  const [docs, setDocs] = useState<ArchitectureDocs | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("hld");
  const [hldFocusHeading, setHldFocusHeading] = useState<string | null>(null);
  const [lldFocusHeading, setLldFocusHeading] = useState<string | null>(null);

  useEffect(() => {
    api<ArchitectureDocs>("/api/architecture")
      .then(setDocs)
      .catch(() => toast.error("Failed to load architecture docs"))
      .finally(() => setLoading(false));
  }, []);

  const jumpToDoc = (docTab: "hld" | "lld", headingOrAnchor: string) => {
    if (docTab === "hld") {
      setTab("hld");
      setHldFocusHeading(headingOrAnchor);
      return;
    }
    setTab("lld");
    setLldFocusHeading(headingOrAnchor);
  };

  const onHldFocusConsumed = useCallback(() => {
    setHldFocusHeading(null);
  }, []);

  const onLldFocusConsumed = useCallback(() => {
    setLldFocusHeading(null);
  }, []);

  return (
    <PageShell
      title="Architecture"
      description="OneNexium product design — HLD/LLD by layer, and full end-to-end journeys (first build, follow-up, publish)."
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : !docs ? (
        <p className="text-sm text-muted-foreground">Could not load architecture docs.</p>
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="hld">HLD</TabsTrigger>
            <TabsTrigger value="flow">End-to-End Flow</TabsTrigger>
            <TabsTrigger value="lld">LLD</TabsTrigger>
          </TabsList>

          <TabsContent value="hld">
            <HldView
              markdown={docs.hld}
              focusHeading={hldFocusHeading}
              onFocusConsumed={onHldFocusConsumed}
            />
          </TabsContent>

          <TabsContent value="flow">
            <ArchitectureFlowDiagram onViewDocs={jumpToDoc} />
          </TabsContent>

          <TabsContent value="lld">
            <LldView
              markdown={docs.lld}
              focusHeading={lldFocusHeading}
              onFocusConsumed={onLldFocusConsumed}
            />
          </TabsContent>
        </Tabs>
      )}
    </PageShell>
  );
}
