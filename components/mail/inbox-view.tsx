"use client";

import { useCallback, useEffect, useState } from "react";
import type { Role } from "@prisma/client";
import { PageShell } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Mail, Inbox, Send, Archive, Trash2, Plus } from "lucide-react";

type MailAccount = {
  id: string;
  email: string;
  displayName: string | null;
  provider: string | null;
  isPrimary: boolean;
};

type MailThread = {
  id: string;
  subject: string | null;
  snippet: string | null;
  folder: string | null;
  unreadCount: number;
  lastMessageAt: string;
  mailAccount: {
    id: string;
    email: string;
    displayName: string | null;
  };
};

type MailMessage = {
  id: string;
  from: string;
  to: string;
  cc: string | null;
  bcc: string | null;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  direction: string;
  folder: string | null;
  isRead: boolean;
  sentAt: string | null;
  receivedAt: string | null;
  createdAt: string;
};

type ThreadWithMessages = MailThread & {
  messages: MailMessage[];
};

const FOLDERS = [
  { id: "INBOX", label: "Inbox", icon: Inbox },
  { id: "SENT", label: "Sent", icon: Send },
  { id: "ARCHIVE", label: "Archive", icon: Archive },
  { id: "TRASH", label: "Trash", icon: Trash2 },
] as const;

export function InboxView({ role }: { role: Role }) {
  void role;

  const [accounts, setAccounts] = useState<MailAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadDetail, setThreadDetail] = useState<ThreadWithMessages | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [folder, setFolder] = useState<string>("INBOX");
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  const primaryAccountId =
    accounts.find((a) => a.isPrimary)?.id ?? accounts[0]?.id ?? null;

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await api<MailAccount[]>("/api/mail/accounts");
      setAccounts(data);
    } catch {
      toast.error("Failed to load mail accounts");
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadThreads = useCallback(
    async (opts?: { keepSelection?: boolean }) => {
      if (!primaryAccountId) return;
      setThreadsLoading(true);
      try {
        const params: Record<string, string> = { folder };
        if (search) params.q = search;
        params.accountId = primaryAccountId;
        const data = await api<MailThread[]>("/api/mail/threads", { params });
        setThreads(data);
        if (!opts?.keepSelection) {
          setSelectedThreadId(data[0]?.id ?? null);
        }
      } catch {
        toast.error("Failed to load inbox");
      } finally {
        setThreadsLoading(false);
      }
    },
    [folder, search, primaryAccountId]
  );

  const loadThreadDetail = useCallback(
    async (id: string | null) => {
      if (!id) {
        setThreadDetail(null);
        return;
      }
      setThreadLoading(true);
      try {
        const data = await api<ThreadWithMessages>(`/api/mail/threads/${id}`);
        setThreadDetail(data);
      } catch {
        toast.error("Failed to load conversation");
      } finally {
        setThreadLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (primaryAccountId) {
      loadThreads();
    }
  }, [primaryAccountId, loadThreads]);

  useEffect(() => {
    if (selectedThreadId) {
      loadThreadDetail(selectedThreadId);
    } else {
      setThreadDetail(null);
    }
  }, [selectedThreadId, loadThreadDetail]);

  const handleComposeSend = async () => {
    if (!primaryAccountId) {
      toast.error("No mail account configured");
      return;
    }
    if (!composeTo || !composeSubject) {
      toast.error("To and subject are required");
      return;
    }
    setSending(true);
    try {
      await api("/api/mail/messages", {
        method: "POST",
        body: {
          accountId: primaryAccountId,
          to: composeTo,
          subject: composeSubject,
          text: composeBody,
        },
      });
      toast.success("Email sent");
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      loadThreads({ keepSelection: true });
    } catch (e) {
      void e;
      toast.error("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const formatDate = (s: string) => {
    const d = new Date(s);
    return d.toLocaleString();
  };

  const currentFolderMeta = FOLDERS.find((f) => f.id === folder) ?? FOLDERS[0];

  return (
    <PageShell
      title="Inbox"
      description="Centralised inbox for your work across customers, partners, and internal threads."
      actions={
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setComposeOpen(true)}
          disabled={!accounts.length}
        >
          <Plus className="h-4 w-4" />
          Compose
        </Button>
      }
    >
      {accountsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={<Mail className="h-6 w-6" />}
          title="No mailbox connected"
          description="Connect an email account in Settings to manage your inbox from Nexium OS."
          action={
            <Button size="sm" asChild>
              <a href="/settings?tab=email">Go to email settings</a>
            </Button>
          }
        />
      ) : (
        <div className="flex gap-4">
          {/* Sidebar: folders + accounts */}
          <div className="w-52 shrink-0 space-y-4">
            <Card className="p-2">
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Folders
              </div>
              <div className="space-y-1">
                {FOLDERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFolder(f.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                      folder === f.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <f.icon className="h-4 w-4" />
                    <span>{f.label}</span>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="p-2">
              <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                Accounts
              </div>
              <div className="space-y-1">
                {accounts.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-xs",
                      a.id === primaryAccountId ? "bg-accent" : "text-muted-foreground"
                    )}
                  >
                    <div className="font-medium">{a.displayName || a.email}</div>
                    <div className="truncate">{a.email}</div>
                    {a.isPrimary && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        Primary
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Threads + detail */}
          <div className="flex min-h-[420px] flex-1 gap-4">
            {/* Thread list */}
            <div className="flex w-80 shrink-0 flex-col gap-2">
              <div className="flex items-center gap-2">
                <Input
                  placeholder={`Search ${currentFolderMeta.label.toLowerCase()}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") loadThreads();
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => loadThreads()}
                  disabled={threadsLoading}
                >
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
              <Card className="flex-1 overflow-hidden">
                {threadsLoading ? (
                  <div className="space-y-2 p-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : threads.length === 0 ? (
                  <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                    No conversations in this folder.
                  </div>
                ) : (
                  <ul className="max-h-[540px] space-y-1 overflow-auto p-2">
                    {threads.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedThreadId(t.id)}
                          className={cn(
                            "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                            selectedThreadId === t.id
                              ? "bg-muted"
                              : "hover:bg-muted/60"
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="line-clamp-1 font-medium">
                              {t.subject || "(no subject)"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(t.lastMessageAt)}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="line-clamp-1 text-xs text-muted-foreground">
                              {t.snippet}
                            </span>
                            {t.unreadCount > 0 && (
                              <Badge variant="secondary" className="shrink-0 text-[10px]">
                                {t.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            {/* Thread detail */}
            <Card className="flex flex-1 flex-col overflow-hidden">
              {threadLoading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-5 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-40 w-full" />
                </div>
              ) : !threadDetail ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
                  <Mail className="h-6 w-6" />
                  <p>Select a conversation to read it.</p>
                </div>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h2 className="text-sm font-semibold">
                          {threadDetail.subject || "(no subject)"}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                          {threadDetail.mailAccount.displayName ||
                            threadDetail.mailAccount.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {threadDetail.folder || "INBOX"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 space-y-4 overflow-auto p-4">
                    {threadDetail.messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "rounded-md border border-border p-3 text-sm",
                          m.direction === "OUTBOUND" && "bg-muted/40"
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <div>
                            <span className="font-medium">{m.from}</span>
                            <span className="mx-1">→</span>
                            <span className="truncate">{m.to}</span>
                          </div>
                          <span>
                            {m.sentAt
                              ? formatDate(m.sentAt)
                              : m.receivedAt
                              ? formatDate(m.receivedAt)
                              : formatDate(m.createdAt)}
                          </span>
                        </div>
                        {m.subject && (
                          <div className="mb-1 text-xs font-semibold">
                            {m.subject}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap text-sm">
                          {m.bodyText || m.bodyHtml || "(no content)"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* Compose */}
      <Sheet open={composeOpen} onOpenChange={setComposeOpen}>
        <SheetContent className="flex flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New email</SheetTitle>
          </SheetHeader>
          <SheetBody>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                To
              </label>
              <Input
                placeholder="email@example.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Subject
              </label>
              <Input
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Message
              </label>
              <textarea
                className="min-h-[160px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Write your message..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
              />
            </div>
          </div>
          </SheetBody>
          <SheetFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setComposeOpen(false)}
              disabled={sending}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleComposeSend} disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </PageShell>
  );
}

