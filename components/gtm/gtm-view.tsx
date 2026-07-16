"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/layout/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Megaphone, Handshake, FileText, Calendar } from "lucide-react";
import { canEditGtm } from "@/lib/permissions";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { GtmCampaignFilters, type CampaignFiltersState } from "@/components/gtm/gtm-campaign-filters";
import { GtmPartnerFilters, type PartnerFiltersState } from "@/components/gtm/gtm-partner-filters";
import { GtmCampaignList, type CampaignOption } from "@/components/gtm/gtm-campaign-list";
import { GtmPartnerList, type PartnerOption } from "@/components/gtm/gtm-partner-list";
import { GtmAssetList } from "@/components/gtm/gtm-asset-list";
import { GtmEventList } from "@/components/gtm/gtm-event-list";
import { GtmCampaignDetailSheet } from "@/components/gtm/gtm-campaign-detail-sheet";
import { GtmCampaignCreateSheet } from "@/components/gtm/gtm-campaign-create-sheet";
import { GtmPartnerDetailSheet } from "@/components/gtm/gtm-partner-detail-sheet";
import { GtmPartnerCreateSheet } from "@/components/gtm/gtm-partner-create-sheet";
import { GtmAssetDetailSheet } from "@/components/gtm/gtm-asset-detail-sheet";
import { GtmAssetCreateSheet } from "@/components/gtm/gtm-asset-create-sheet";
import { GtmEventDetailSheet } from "@/components/gtm/gtm-event-detail-sheet";
import { GtmEventCreateSheet } from "@/components/gtm/gtm-event-create-sheet";

export type GtmSection = "campaigns" | "partners" | "assets" | "events";

export type AssetOption = {
  id: string;
  name: string;
  type: string | null;
  url: string;
  folder: string | null;
  audience: string | null;
};

export type EventOption = {
  id: string;
  name: string;
  type: string | null;
  date: string | null;
  location: string | null;
};

const SECTIONS: { id: GtmSection; label: string; icon: React.ReactNode }[] = [
  { id: "campaigns", label: "Campaigns", icon: <Megaphone className="h-4 w-4" /> },
  { id: "partners", label: "Partners", icon: <Handshake className="h-4 w-4" /> },
  { id: "assets", label: "Assets", icon: <FileText className="h-4 w-4" /> },
  { id: "events", label: "Events", icon: <Calendar className="h-4 w-4" /> },
];

export function GtmView({
  role,
  organisationId,
}: {
  role: Role;
  organisationId: string;
}) {
  void organisationId;
  const searchParams = useSearchParams();
  const [section, setSection] = useState<GtmSection>(() => (searchParams.get("section") as GtmSection) || "campaigns");
  const [campaignId, setCampaignId] = useState<string | null>(() => searchParams.get("campaign") || null);
  const [partnerId, setPartnerId] = useState<string | null>(() => searchParams.get("partner") || null);
  const [assetId, setAssetId] = useState<string | null>(() => searchParams.get("asset") || null);
  const [eventId, setEventId] = useState<string | null>(() => searchParams.get("event") || null);
  const [members, setMembers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [campaignFilters, setCampaignFilters] = useState<CampaignFiltersState>({ status: "", type: "", ownerId: "" });
  const [partnerFilters, setPartnerFilters] = useState<PartnerFiltersState>({
    status: "",
    type: "",
    pipelineStage: "",
    assignedToId: "",
  });
  const canEdit = canEditGtm(role);
  const hasCampaignFilters = Object.values(campaignFilters).some(Boolean);
  const hasPartnerFilters = Object.values(partnerFilters).some(Boolean);

  const setSectionAndUrl = useCallback((s: GtmSection) => {
    setSection(s);
    const url = new URL(window.location.href);
    url.searchParams.set("section", s);
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  const setCampaignIdAndUrl = useCallback((id: string | null) => {
    setCampaignId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("campaign", id);
    else url.searchParams.delete("campaign");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);
  const setPartnerIdAndUrl = useCallback((id: string | null) => {
    setPartnerId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("partner", id);
    else url.searchParams.delete("partner");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);
  const setAssetIdAndUrl = useCallback((id: string | null) => {
    setAssetId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("asset", id);
    else url.searchParams.delete("asset");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);
  const setEventIdAndUrl = useCallback((id: string | null) => {
    setEventId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("event", id);
    else url.searchParams.delete("event");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, []);

  useEffect(() => {
    const s = (searchParams.get("section") as GtmSection) || "campaigns";
    if (["campaigns", "partners", "assets", "events"].includes(s)) setSection(s);
    setCampaignId(searchParams.get("campaign"));
    setPartnerId(searchParams.get("partner"));
    setAssetId(searchParams.get("asset"));
    setEventId(searchParams.get("event"));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    api<{ id: string; name: string | null; email: string }[]>("/api/team/members")
      .then((r) => { if (!cancelled) setMembers(r); })
      .catch(() => toast.error("Failed to load"))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (section !== "campaigns") return;
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = {};
    if (campaignFilters.status) params.status = campaignFilters.status;
    if (campaignFilters.type) params.type = campaignFilters.type;
    if (campaignFilters.ownerId) params.ownerId = campaignFilters.ownerId;
    api<CampaignOption[]>("/api/campaigns", { params })
      .then((r) => { if (!cancelled) setCampaigns(r); })
      .catch(() => { if (!cancelled) toast.error("Failed to load campaigns"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [section, campaignFilters]);

  useEffect(() => {
    if (section !== "partners") return;
    let cancelled = false;
    setLoading(true);
    const params: Record<string, string> = {};
    if (partnerFilters.status) params.status = partnerFilters.status;
    if (partnerFilters.type) params.type = partnerFilters.type;
    if (partnerFilters.pipelineStage) params.pipelineStage = partnerFilters.pipelineStage;
    if (partnerFilters.assignedToId) params.assignedToId = partnerFilters.assignedToId;
    api<PartnerOption[]>("/api/partners", { params })
      .then((r) => { if (!cancelled) setPartners(r); })
      .catch(() => { if (!cancelled) toast.error("Failed to load partners"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [section, partnerFilters]);

  useEffect(() => {
    if (section !== "assets") return;
    let cancelled = false;
    setLoading(true);
    api<AssetOption[]>("/api/assets")
      .then((r) => { if (!cancelled) setAssets(r); })
      .catch(() => { if (!cancelled) toast.error("Failed to load assets"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [section]);

  useEffect(() => {
    if (section !== "events") return;
    let cancelled = false;
    setLoading(true);
    api<EventOption[]>("/api/events")
      .then((r) => { if (!cancelled) setEvents(r); })
      .catch(() => { if (!cancelled) toast.error("Failed to load events"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [section]);

  const refetchCampaigns = useCallback(() => {
    const params: Record<string, string> = {};
    if (campaignFilters.status) params.status = campaignFilters.status;
    if (campaignFilters.type) params.type = campaignFilters.type;
    if (campaignFilters.ownerId) params.ownerId = campaignFilters.ownerId;
    api<CampaignOption[]>("/api/campaigns", { params }).then(setCampaigns).catch(() => {});
  }, [campaignFilters]);
  const refetchPartners = useCallback(() => {
    const params: Record<string, string> = {};
    if (partnerFilters.status) params.status = partnerFilters.status;
    if (partnerFilters.type) params.type = partnerFilters.type;
    if (partnerFilters.pipelineStage) params.pipelineStage = partnerFilters.pipelineStage;
    if (partnerFilters.assignedToId) params.assignedToId = partnerFilters.assignedToId;
    api<PartnerOption[]>("/api/partners", { params }).then(setPartners).catch(() => {});
  }, [partnerFilters]);
  const refetchAssets = useCallback(() => api<AssetOption[]>("/api/assets").then(setAssets).catch(() => {}), []);
  const refetchEvents = useCallback(() => api<EventOption[]>("/api/events").then(setEvents).catch(() => {}), []);

  const emptyCampaigns = section === "campaigns" && campaigns.length === 0;
  const emptyPartners = section === "partners" && partners.length === 0;
  const emptyAssets = section === "assets" && assets.length === 0;
  const emptyEvents = section === "events" && events.length === 0;
  const showEmpty = emptyCampaigns || emptyPartners || emptyAssets || emptyEvents;

  return (
    <PageShell
      title="GTM"
      description="Campaigns, partners, assets, and events"
      actions={
        <>
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border p-1">
            {SECTIONS.map((s) => (
              <Button
                key={s.id}
                variant={section === s.id ? "secondary" : "ghost"}
                size="sm"
                className="gap-1.5"
                onClick={() => setSectionAndUrl(s.id)}
              >
                {s.icon}
                {s.label}
              </Button>
            ))}
          </div>
          {section === "campaigns" && (
            <>
              <GtmCampaignFilters filters={campaignFilters} setFilters={setCampaignFilters} members={members} />
              {canEdit && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add campaign
                </Button>
              )}
            </>
          )}
          {section === "partners" && (
            <>
              <GtmPartnerFilters filters={partnerFilters} setFilters={setPartnerFilters} members={members} />
              {canEdit && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add partner
                </Button>
              )}
            </>
          )}
          {section === "assets" && canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add asset
            </Button>
          )}
          {section === "events" && canEdit && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add event
            </Button>
          )}
        </>
      }
    >
      {loading && (campaigns.length + partners.length + assets.length + events.length) === 0 ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : section === "campaigns" && (
        showEmpty && emptyCampaigns ? (
          <EmptyState
            icon={<Megaphone className="h-6 w-6" />}
            title={hasCampaignFilters ? "No campaigns match your filters" : "No campaigns yet"}
            description={hasCampaignFilters ? "Try clearing filters or add a campaign." : "Add campaigns to plan and track GTM activities."}
            action={
              hasCampaignFilters ? (
                <Button variant="outline" onClick={() => setCampaignFilters({ status: "", type: "", ownerId: "" })}>Clear filters</Button>
              ) : canEdit ? (
                <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add first campaign</Button>
              ) : undefined
            }
          />
        ) : (
          <GtmCampaignList campaigns={campaigns} onSelect={setCampaignIdAndUrl} />
        )
      )}
      {section === "partners" && (
        showEmpty && emptyPartners ? (
          <EmptyState
            icon={<Handshake className="h-6 w-6" />}
            title={hasPartnerFilters ? "No partners match your filters" : "No partners yet"}
            description={hasPartnerFilters ? "Try clearing filters or add a partner." : "Add partners to manage resellers, agencies, and referrals."}
            action={
              hasPartnerFilters ? (
                <Button variant="outline" onClick={() => setPartnerFilters({ status: "", type: "", pipelineStage: "", assignedToId: "" })}>Clear filters</Button>
              ) : canEdit ? (
                <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add first partner</Button>
              ) : undefined
            }
          />
        ) : (
          <GtmPartnerList partners={partners} onSelect={setPartnerIdAndUrl} />
        )
      )}
      {section === "assets" && (
        showEmpty && emptyAssets ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No assets yet"
            description="Add pitch decks, one-pagers, and other GTM assets."
            action={canEdit ? <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add first asset</Button> : undefined}
          />
        ) : (
          <GtmAssetList assets={assets} onSelect={setAssetIdAndUrl} />
        )
      )}
      {section === "events" && (
        showEmpty && emptyEvents ? (
          <EmptyState
            icon={<Calendar className="h-6 w-6" />}
            title="No events yet"
            description="Add conferences, webinars, and meetups."
            action={canEdit ? <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" />Add first event</Button> : undefined}
          />
        ) : (
          <GtmEventList events={events} onSelect={setEventIdAndUrl} />
        )
      )}

      {campaignId && (
        <GtmCampaignDetailSheet
          id={campaignId}
          canEdit={canEdit}
          members={members}
          onClose={() => setCampaignIdAndUrl(null)}
          onUpdated={refetchCampaigns}
          onDeleted={() => { setCampaigns((p) => p.filter((c) => c.id !== campaignId)); setCampaignIdAndUrl(null); }}
        />
      )}
      {partnerId && (
        <GtmPartnerDetailSheet
          id={partnerId}
          canEdit={canEdit}
          members={members}
          onClose={() => setPartnerIdAndUrl(null)}
          onUpdated={refetchPartners}
          onDeleted={() => { setPartners((p) => p.filter((x) => x.id !== partnerId)); setPartnerIdAndUrl(null); }}
        />
      )}
      {assetId && (
        <GtmAssetDetailSheet
          id={assetId}
          canEdit={canEdit}
          onClose={() => setAssetIdAndUrl(null)}
          onUpdated={refetchAssets}
          onDeleted={() => { setAssets((p) => p.filter((a) => a.id !== assetId)); setAssetIdAndUrl(null); }}
        />
      )}
      {eventId && (
        <GtmEventDetailSheet
          id={eventId}
          canEdit={canEdit}
          onClose={() => setEventIdAndUrl(null)}
          onUpdated={refetchEvents}
          onDeleted={() => { setEvents((p) => p.filter((e) => e.id !== eventId)); setEventIdAndUrl(null); }}
        />
      )}

      {createOpen && canEdit && section === "campaigns" && (
        <GtmCampaignCreateSheet
          members={members}
          onClose={() => setCreateOpen(false)}
          onCreated={(c) => { setCampaigns((p) => [...p, c]); setCreateOpen(false); toast.success("Campaign added"); }}
        />
      )}
      {createOpen && canEdit && section === "partners" && (
        <GtmPartnerCreateSheet
          members={members}
          onClose={() => setCreateOpen(false)}
          onCreated={(p) => { setPartners((prev) => [...prev, p]); setCreateOpen(false); toast.success("Partner added"); }}
        />
      )}
      {createOpen && canEdit && section === "assets" && (
        <GtmAssetCreateSheet
          onClose={() => setCreateOpen(false)}
          onCreated={(a) => { setAssets((p) => [...p, a]); setCreateOpen(false); toast.success("Asset added"); }}
        />
      )}
      {createOpen && canEdit && section === "events" && (
        <GtmEventCreateSheet
          onClose={() => setCreateOpen(false)}
          onCreated={(e) => { setEvents((p) => [...p, e]); setCreateOpen(false); toast.success("Event added"); }}
        />
      )}
    </PageShell>
  );
}
