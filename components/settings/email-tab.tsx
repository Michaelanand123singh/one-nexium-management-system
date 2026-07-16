"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Mail, MailCheck, Server, Key, Trash2 } from "lucide-react";
import { canManageMailProviderConfig } from "@/lib/permissions";

const PROVIDERS = [
  { id: "gmail", label: "Gmail", icon: MailCheck, description: "Connect with Google OAuth" },
  { id: "smtp", label: "Custom SMTP", icon: Server, description: "Use your own mail server" },
  { id: "resend_only", label: "Resend (default)", icon: Mail, description: "Uses Nexium OS Resend config" },
] as const;

type MailAccount = {
  id: string;
  email: string;
  displayName: string | null;
  provider: string | null;
  isPrimary: boolean;
  config?: { gmail?: { connected?: boolean }; smtp?: { host?: string; port?: number; user?: string } } | null;
};

type MailProviderConfig = {
  googleClientId?: string;
  googleClientSecret?: string;
  resendApiKey?: string;
  emailFrom?: string;
  appUrl?: string;
};

export function EmailTab({ role }: { role: Role }) {
  const searchParams = useSearchParams();
  const canManageConfig = canManageMailProviderConfig(role);

  const [configLoading, setConfigLoading] = useState(canManageConfig);
  const [configSaving, setConfigSaving] = useState(false);
  const [configForm, setConfigForm] = useState({
    googleClientId: "",
    googleClientSecret: "",
    resendApiKey: "",
    emailFrom: "",
    appUrl: "",
  });

  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provider, setProvider] = useState<"gmail" | "smtp" | "resend_only">("gmail");

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<MailAccount[]>("/api/mail/accounts");
      setAccounts(data);
    } catch {
      toast.error("Failed to load mail accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadConfig = useCallback(async () => {
    if (!canManageConfig) return;
    setConfigLoading(true);
    try {
      const data = await api<MailProviderConfig>("/api/settings/mail-providers");
      setConfigForm({
        googleClientId: data.googleClientId ?? "",
        googleClientSecret: data.googleClientSecret?.includes("••") ? "" : (data.googleClientSecret ?? ""),
        resendApiKey: data.resendApiKey?.includes("••") ? "" : (data.resendApiKey ?? ""),
        emailFrom: data.emailFrom ?? "",
        appUrl: data.appUrl ?? "",
      });
    } catch {
      toast.error("Failed to load mail provider config");
    } finally {
      setConfigLoading(false);
    }
  }, [canManageConfig]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      await api("/api/settings/mail-providers", {
        method: "PUT",
        body: {
          googleClientId: configForm.googleClientId || undefined,
          googleClientSecret: configForm.googleClientSecret || undefined,
          resendApiKey: configForm.resendApiKey || undefined,
          emailFrom: configForm.emailFrom || undefined,
          appUrl: configForm.appUrl || undefined,
        },
      });
      toast.success("Mail provider config saved");
      loadConfig();
    } catch {
      toast.error("Failed to save config");
    } finally {
      setConfigSaving(false);
    }
  };

  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    if (success === "gmail") {
      toast.success("Gmail connected successfully");
      window.history.replaceState({}, "", "/settings?tab=email");
    }
    if (error) {
      toast.error(error);
      window.history.replaceState({}, "", "/settings?tab=email");
    }
  }, [searchParams]);

  const handleConnectGmail = () => {
    window.location.href = "/api/mail/oauth/gmail/authorize";
  };

  const handleConnectSmtp = async () => {
    if (!smtpHost || !smtpUser || !smtpPassword) {
      toast.error("Host, email, and password are required");
      return;
    }
    if (!smtpUser.includes("@")) {
      toast.error("Enter your full email address");
      return;
    }
    const port = parseInt(smtpPort, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      toast.error("Invalid port");
      return;
    }
    setSaving(true);
    try {
      await api("/api/mail/accounts", {
        method: "POST",
        body: {
          email: smtpUser,
          displayName: displayName || undefined,
          provider: "smtp",
          smtp: {
            host: smtpHost,
            port,
            secure: smtpSecure,
            user: smtpUser,
            password: smtpPassword,
          },
          isPrimary: accounts.length === 0,
        },
      });
      toast.success("SMTP mailbox connected");
      setSmtpHost("");
      setSmtpPort("587");
      setSmtpUser("");
      setSmtpPassword("");
      setDisplayName("");
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to connect";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleConnectResend = async () => {
    const email = smtpUser.trim();
    if (!email || !email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setSaving(true);
    try {
      await api("/api/mail/accounts", {
        method: "POST",
        body: {
          email,
          displayName: displayName || undefined,
          provider: "resend_only",
          isPrimary: accounts.length === 0,
        },
      });
      toast.success("Mailbox connected (Resend)");
      setSmtpUser("");
      setDisplayName("");
      load();
    } catch {
      toast.error("Failed to connect mailbox");
    } finally {
      setSaving(false);
    }
  };

  const providerLabel = (p: string | null) => {
    if (p === "gmail") return "Gmail";
    if (p === "smtp") return "Custom SMTP";
    return "Resend";
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Disconnect this mailbox? You can reconnect it later.")) return;
    try {
      await api(`/api/mail/accounts/${accountId}`, { method: "DELETE" });
      toast.success("Mailbox disconnected");
      load();
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  const handleSetPrimary = async (accountId: string) => {
    try {
      await api(`/api/mail/accounts/${accountId}`, {
        method: "PATCH",
        body: { isPrimary: true },
      });
      toast.success("Primary mailbox updated");
      load();
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="space-y-4">
      {canManageConfig && (
        <Card className="p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Key className="h-4 w-4" />
            Mail Provider Configuration
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure Gmail OAuth and Resend for your organisation. All users will use these credentials to connect their own mailboxes.
          </p>
          {configLoading ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="googleClientId">Google Client ID</Label>
                  <Input
                    id="googleClientId"
                    placeholder="xxx.apps.googleusercontent.com"
                    value={configForm.googleClientId}
                    onChange={(e) => setConfigForm((f) => ({ ...f, googleClientId: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="googleClientSecret">Google Client Secret</Label>
                  <Input
                    id="googleClientSecret"
                    type="password"
                    placeholder="Leave blank to keep current"
                    value={configForm.googleClientSecret}
                    onChange={(e) => setConfigForm((f) => ({ ...f, googleClientSecret: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="resendApiKey">Resend API Key</Label>
                  <Input
                    id="resendApiKey"
                    type="password"
                    placeholder="re_xxx (leave blank to keep current)"
                    value={configForm.resendApiKey}
                    onChange={(e) => setConfigForm((f) => ({ ...f, resendApiKey: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emailFrom">Default From Email</Label>
                  <Input
                    id="emailFrom"
                    type="email"
                    placeholder="no-reply@yourdomain.com"
                    value={configForm.emailFrom}
                    onChange={(e) => setConfigForm((f) => ({ ...f, emailFrom: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="appUrl">App URL (for OAuth callback)</Label>
                  <Input
                    id="appUrl"
                    placeholder="https://your-domain.com"
                    value={configForm.appUrl}
                    onChange={(e) => setConfigForm((f) => ({ ...f, appUrl: e.target.value }))}
                  />
                  {configForm.appUrl && (
                    <p className="text-xs text-muted-foreground">
                      Add this redirect URI in Google Cloud Console:{" "}
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                        {configForm.appUrl.replace(/\/$/, "")}/api/mail/oauth/gmail/callback
                      </code>
                    </p>
                  )}
                </div>
              </div>
              <Button size="sm" onClick={handleSaveConfig} disabled={configSaving}>
                {configSaving ? "Saving..." : "Save configuration"}
              </Button>
            </div>
          )}
        </Card>
      )}

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Connect your mailbox</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose Gmail (OAuth), Custom SMTP, or Resend. Each user connects their own email. Gmail and Resend require the Super Admin to configure credentials above.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PROVIDERS.map((p) => (
            <Button
              key={p.id}
              variant={provider === p.id ? "secondary" : "outline"}
              size="sm"
              onClick={() => setProvider(p.id)}
              className="gap-1.5"
            >
              <p.icon className="h-4 w-4" />
              {p.label}
            </Button>
          ))}
        </div>

        {provider === "gmail" && (
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">Connect with Google</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Authorize Nexium OS to send and read email from your Gmail account.
            </p>
            <Button
              size="sm"
              className="mt-3 gap-1.5"
              onClick={handleConnectGmail}
              disabled={saving}
            >
              <MailCheck className="h-4 w-4" />
              Connect with Google
            </Button>
          </div>
        )}

        {provider === "smtp" && (
          <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">Custom SMTP server</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="smtpHost">Host</Label>
                <Input
                  id="smtpHost"
                  placeholder="smtp.example.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="smtpPort">Port</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="smtpUser">Email address</Label>
                <Input
                  id="smtpUser"
                  type="email"
                  placeholder="you@example.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="smtpPassword">Password / App password</Label>
                <Input
                  id="smtpPassword"
                  type="password"
                  placeholder="••••••••"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  id="smtpSecure"
                  checked={smtpSecure}
                  onChange={(e) => setSmtpSecure(e.target.checked)}
                  className="rounded border-input"
                />
                <Label htmlFor="smtpSecure" className="font-normal">
                  Use TLS/SSL (port 465)
                </Label>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="displayName">Display name (optional)</Label>
                <Input
                  id="displayName"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
            <Button size="sm" onClick={handleConnectSmtp} disabled={saving}>
              {saving ? "Connecting..." : "Connect SMTP"}
            </Button>
          </div>
        )}

        {provider === "resend_only" && (
          <div className="mt-4 space-y-3 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">Resend (default)</p>
            <p className="text-xs text-muted-foreground">
              Uses Resend API key from Mail Provider Configuration. Emails are sent from the configured domain; replies go to this address.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="resendEmail">Reply-to email</Label>
                <Input
                  id="resendEmail"
                  type="email"
                  placeholder="you@company.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="resendDisplayName">Display name (optional)</Label>
                <Input
                  id="resendDisplayName"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
            <Button size="sm" onClick={handleConnectResend} disabled={saving}>
              {saving ? "Saving..." : "Connect mailbox"}
            </Button>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Connected mailboxes</h2>
        {loading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="mt-2">
            <EmptyState
              icon={<Mail className="h-5 w-5" />}
              title="No mailboxes yet"
              description="Connect Gmail, SMTP, or Resend above to send and receive email from Nexium OS."
            />
          </div>
        ) : (
          <div className="mt-3 space-y-2 text-sm">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.displayName || a.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.email} · {providerLabel(a.provider)}
                    {a.config?.smtp && ` (${a.config.smtp.host}:${a.config.smtp.port})`}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {a.isPrimary ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      Primary
                    </span>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => handleSetPrimary(a.id)}
                    >
                      Set primary
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDisconnect(a.id)}
                    title="Disconnect"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
