"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { Role } from "@prisma/client";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { canManageWorkstationDevices, canViewWorkstationTelemetry } from "@/lib/permissions";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { WorkstationAnalyticsPanel } from "@/components/workstation/workstation-analytics";

type TeamMemberRow = {
  userId: string;
  name: string | null;
  email: string;
};

type DeviceRow = {
  id: string;
  label: string | null;
  revoked: boolean;
  createdAt: string;
  lastSeenAt: string | null;
  hostnameLast: string | null;
  agentVersionLast: string | null;
  user: { id: string; email: string; name: string | null };
  sampleCount: number;
};

type SampleMetadata = {
  exe_path?: string | null;
  idle_seconds?: number;
  keyboard_mouse_rate?: number;
  app_switch_count?: number;
  cpu_percent?: number | null;
  ram_percent?: number | null;
  battery_percent?: number | null;
  battery_plugged?: boolean | null;
  screen_locked?: boolean;
  network_connected?: boolean;
  browser_domain?: string | null;
  display_count?: number;
  in_meeting?: boolean;
  meeting_app?: string | null;
  running_process_count?: number;
  top_processes?: string[];
  [key: string]: unknown;
};

type SampleRow = {
  id: string;
  sampledAt: string;
  processName: string;
  windowTitle: string | null;
  idle: boolean;
  inProjectRoots: boolean;
  keyboardMouseRate: number | null;
  appSwitchCount: number | null;
  metadata: SampleMetadata | null;
  deviceId: string;
  deviceLabel: string | null;
  userEmail: string;
  userName: string | null;
};

type AgentEndpointsPayload = {
  apiBaseUrl: string;
  ingestPath: string;
  ingestUrl: string;
  originFromEnv: boolean;
};

const COL_COUNT = 11;

function DetailCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}:</span>
      <span className="text-xs">{children}</span>
    </div>
  );
}

function SampleExpandedRow({ sample }: { sample: SampleRow }) {
  const m = sample.metadata;
  if (!m) {
    return (
      <tr className="bg-muted/20">
        <td colSpan={COL_COUNT} className="px-4 py-3 text-xs text-muted-foreground">
          No extended metadata — update the agent on this device for full telemetry.
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-muted/20 border-b border-border/40">
      <td colSpan={COL_COUNT} className="px-4 py-3">
        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Activity</p>
            <DetailCell label="Input rate">{m.keyboard_mouse_rate != null ? `${m.keyboard_mouse_rate}/min` : "—"}</DetailCell>
            <DetailCell label="App switches">{m.app_switch_count != null ? m.app_switch_count : "—"}</DetailCell>
            <DetailCell label="Idle">{m.idle_seconds != null ? `${m.idle_seconds}s` : "—"}</DetailCell>
            <DetailCell label="Screen locked">{m.screen_locked != null ? (m.screen_locked ? "Yes" : "No") : "—"}</DetailCell>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">System</p>
            <DetailCell label="CPU">{m.cpu_percent != null ? `${m.cpu_percent}%` : "—"}</DetailCell>
            <DetailCell label="RAM">{m.ram_percent != null ? `${m.ram_percent}%` : "—"}</DetailCell>
            <DetailCell label="Battery">
              {m.battery_percent != null
                ? `${m.battery_percent}%${m.battery_plugged ? " (plugged)" : " (battery)"}`
                : "N/A"}
            </DetailCell>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Network & Display</p>
            <DetailCell label="Network">{m.network_connected != null ? (m.network_connected ? "Connected" : "Offline") : "—"}</DetailCell>
            <DetailCell label="Displays">{m.display_count ?? "—"}</DetailCell>
            <DetailCell label="Domain">{m.browser_domain ?? "—"}</DetailCell>
            <DetailCell label="Meeting">{m.in_meeting ? (m.meeting_app ?? "Yes") : "No"}</DetailCell>
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Process</p>
            <DetailCell label="Foreground">
              <span className="font-mono">{sample.processName}</span>
            </DetailCell>
            <DetailCell label="Exe">
              <span className="max-w-[220px] truncate font-mono inline-block align-bottom" title={m.exe_path ?? ""}>
                {m.exe_path ?? "—"}
              </span>
            </DetailCell>
            <DetailCell label="Total procs">{m.running_process_count ?? "—"}</DetailCell>
          </div>

          {m.top_processes && m.top_processes.length > 0 && (
            <div className="space-y-1 sm:col-span-2 lg:col-span-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Top processes by CPU</p>
              <p className="text-xs font-mono text-muted-foreground">{m.top_processes.join("  ·  ")}</p>
            </div>
          )}

          {sample.windowTitle && (
            <div className="space-y-1 sm:col-span-2 lg:col-span-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Window title</p>
              <p className="text-xs text-muted-foreground break-all">{sample.windowTitle}</p>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

export function WorkstationView({ role }: { role: Role }) {
  const canView = useMemo(() => canViewWorkstationTelemetry(role), [role]);
  const canManage = useMemo(() => canManageWorkstationDevices(role), [role]);

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [logRangeDays, setLogRangeDays] = useState<7 | 14 | 30>(7);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [newUserId, setNewUserId] = useState<string>("");
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [agentEndpoints, setAgentEndpoints] = useState<AgentEndpointsPayload | null>(null);

  const loadDevices = useCallback(async () => {
    const list = await api<DeviceRow[]>("/api/workstation/devices");
    setDevices(list);
  }, []);

  const loadSamples = useCallback(async () => {
    const to = new Date();
    const from = new Date(to.getTime() - logRangeDays * 24 * 60 * 60 * 1000);
    const params: Record<string, string> = {
      from: from.toISOString(),
      to: to.toISOString(),
      limit: "1000",
    };
    if (deviceFilter !== "all") params.deviceId = deviceFilter;
    const list = await api<SampleRow[]>("/api/workstation/samples", { params });
    setSamples(list);
  }, [deviceFilter, logRangeDays]);

  const refresh = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const ep = await api<AgentEndpointsPayload>("/api/workstation/agent-endpoints");
      setAgentEndpoints(ep);
      await loadDevices();
      await loadSamples();
      if (canManage) {
        const m = await api<
          { userId: string; name: string | null; email: string; status: string }[]
        >("/api/settings/team-members");
        setMembers(
          m.filter((x) => x.status === "ACTIVE").map((x) => ({
            userId: x.userId,
            name: x.name,
            email: x.email,
          }))
        );
      }
    } catch {
      toast.error("Failed to load workstation data");
    } finally {
      setLoading(false);
    }
  }, [canView, canManage, loadDevices, loadSamples]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!canView) return;
    void loadSamples();
  }, [canView, deviceFilter, logRangeDays, loadSamples]);

  async function createDevice() {
    if (!newUserId) {
      toast.error("Select a team member");
      return;
    }
    setCreating(true);
    try {
      const res = await api<{
        id: string;
        ingestToken: string;
        message: string;
      }>("/api/workstation/devices", {
        method: "POST",
        body: { userId: newUserId, label: newLabel.trim() || undefined },
      });
      setLastToken(res.ingestToken);
      toast.success("Device registered — copy the token below into the agent.");
      setNewLabel("");
      await loadDevices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create device");
    } finally {
      setCreating(false);
    }
  }

  async function revokeDevice(id: string) {
    try {
      await api(`/api/workstation/devices/${id}`, {
        method: "PATCH",
        body: { revoked: true },
      });
      toast.success("Device revoked");
      await loadDevices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke");
    }
  }

  if (!canView) {
    return (
      <PageShell title="Workstation" description="Laptop activity from the Onenexium agent.">
        <p className="text-sm text-muted-foreground">You do not have access to this module.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Workstation"
      description="Register laptops, ingest activity samples from the Python agent, and review recent signals."
    >
      {agentEndpoints && (
        <Card className="border-primary/20 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-base">Cloud API (this deployment)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Agents send HTTPS POSTs to your Nexium domain. Use these values for{" "}
              <code className="text-xs">ONENEXIUM_API_BASE_URL</code> on each laptop.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!agentEndpoints.originFromEnv && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                Set <code className="text-xs">NEXIUM_APP_URL</code> on the server to your public URL (e.g.{" "}
                <code className="text-xs">https://workspace.onenexium.com</code>) so agents and OAuth use the
                correct origin behind proxies.
              </p>
            )}
            <div className="space-y-2">
              <Label>API base URL</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly className="font-mono text-xs" value={agentEndpoints.apiBaseUrl} />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(agentEndpoints.apiBaseUrl);
                    toast.success("Copied");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ingest endpoint (POST, Bearer token)</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly className="font-mono text-xs" value={agentEndpoints.ingestUrl} />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard.writeText(agentEndpoints.ingestUrl);
                    toast.success("Copied");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card/50 p-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2">
          <Label>Device (activity and analytics)</Label>
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              {devices.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.label ?? d.user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-2">
          <Label>Date range</Label>
          <Select
            value={String(logRangeDays)}
            onValueChange={(v) => setLogRangeDays(Number(v) as 7 | 14 | 30)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => void loadSamples()} disabled={loading}>
          Refresh log
        </Button>
      </div>

      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-4">
          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Register a device</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Creates a one-time ingest token. Set environment variable{" "}
                  <code className="text-xs">ONENEXIUM_INGEST_TOKEN</code> on the laptop (see agent README).
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label>Team member</Label>
                  <Select value={newUserId || undefined} onValueChange={setNewUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name ?? m.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Label (optional)</Label>
                  <Input
                    placeholder="e.g. Anand — work laptop"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                  />
                </div>
                <Button onClick={() => void createDevice()} disabled={creating}>
                  {creating ? "Creating…" : "Create device"}
                </Button>
              </CardContent>
              {lastToken && (
                <CardContent className="border-t pt-4">
                  <Label>Ingest token (copy now)</Label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input readOnly value={lastToken} className="font-mono text-xs" />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        void navigator.clipboard.writeText(lastToken);
                        toast.success("Copied");
                      }}
                    >
                      Copy
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setLastToken(null)}>
                      Dismiss
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Devices</CardTitle>
                <p className="text-sm text-muted-foreground">
                  All registered machines for your organisation.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}>
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading && devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {canManage
                    ? "No devices yet. Register a laptop with the agent to start collecting telemetry."
                    : "No devices yet. Ask a Super Admin to register workstations for the team."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {devices.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{d.label ?? d.hostnameLast ?? d.id.slice(0, 8)}</span>
                          {d.revoked ? (
                            <Badge variant="secondary">Revoked</Badge>
                          ) : (
                            <Badge variant="default">Active</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {d.user.name ?? d.user.email} · {d.sampleCount} samples
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Last seen:{" "}
                          {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : "—"} · Host:{" "}
                          {d.hostnameLast ?? "—"} · Agent: {d.agentVersionLast ?? "—"}
                        </p>
                      </div>
                      {canManage && !d.revoked && (
                        <Button variant="destructive" size="sm" onClick={() => void revokeDevice(d.id)}>
                          Revoke
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <WorkstationAnalyticsPanel deviceId={deviceFilter} rangeDays={logRangeDays} />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Activity log</CardTitle>
              <p className="text-sm text-muted-foreground">
                Newest first, up to 1,000 rows. Click any row to expand full system details.
              </p>
            </CardHeader>
            <CardContent>
              {samples.length === 0 ? (
                <p className="text-sm text-muted-foreground">No samples yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="pb-2 pr-3 font-medium">Time</th>
                        <th className="pb-2 pr-3 font-medium">User</th>
                        <th className="pb-2 pr-3 font-medium">Process</th>
                        <th className="pb-2 pr-3 font-medium">Project</th>
                        <th className="pb-2 pr-3 font-medium">Idle</th>
                        <th className="pb-2 pr-3 font-medium">Input/min</th>
                        <th className="pb-2 pr-3 font-medium">Switches</th>
                        <th className="pb-2 pr-3 font-medium">CPU</th>
                        <th className="pb-2 pr-3 font-medium">RAM</th>
                        <th className="pb-2 pr-3 font-medium">Domain</th>
                        <th className="pb-2 font-medium">Meeting</th>
                      </tr>
                    </thead>
                    <tbody>
                      {samples.map((s) => {
                        const isOpen = expandedId === s.id;
                        const m = s.metadata;
                        return (
                          <Fragment key={s.id}>
                            <tr
                              className={`border-b border-border/60 cursor-pointer transition-colors hover:bg-muted/40 ${isOpen ? "bg-muted/30" : ""}`}
                              onClick={() => setExpandedId(isOpen ? null : s.id)}
                            >
                              <td className="py-2 pr-3 whitespace-nowrap">
                                {new Date(s.sampledAt).toLocaleString()}
                              </td>
                              <td className="py-2 pr-3">{s.userName ?? s.userEmail}</td>
                              <td className="py-2 pr-3 font-mono text-xs">{s.processName}</td>
                              <td className="py-2 pr-3">
                                {s.inProjectRoots ? <Badge>Yes</Badge> : <Badge variant="secondary">No</Badge>}
                              </td>
                              <td className="py-2 pr-3">{s.idle ? "Yes" : "No"}</td>
                              <td className="py-2 pr-3 tabular-nums">
                                {s.keyboardMouseRate != null ? s.keyboardMouseRate : "—"}
                              </td>
                              <td className="py-2 pr-3 tabular-nums">
                                {s.appSwitchCount != null ? s.appSwitchCount : "—"}
                              </td>
                              <td className="py-2 pr-3 tabular-nums text-xs">
                                {m?.cpu_percent != null ? `${m.cpu_percent}%` : "—"}
                              </td>
                              <td className="py-2 pr-3 tabular-nums text-xs">
                                {m?.ram_percent != null ? `${m.ram_percent}%` : "—"}
                              </td>
                              <td className="py-2 pr-3 max-w-[140px] truncate text-xs" title={m?.browser_domain ?? ""}>
                                {m?.browser_domain ?? "—"}
                              </td>
                              <td className="py-2 text-xs">
                                {m?.in_meeting ? (m.meeting_app ?? "Yes") : "—"}
                              </td>
                            </tr>
                            {isOpen && <SampleExpandedRow sample={s} />}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
