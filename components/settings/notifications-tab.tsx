"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Bell, Check, CheckCheck } from "lucide-react";

type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationsTab() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(() => {
    const q = filter === "unread" ? "?read=false" : "";
    api<NotificationRow[]>(`/api/notifications${q}`)
      .then(setItems)
      .catch(() => toast.error("Failed to load notifications"))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await api(`/api/notifications/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ read: true }),
      });
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch {
      toast.error("Failed to update");
    }
  }

  async function markAllRead() {
    try {
      await api("/api/notifications/mark-all-read", { method: "POST" });
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("All marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  }

  const unreadCount = items.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your notification centre and activity.
        </p>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your notification centre and activity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "unread" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFilter("unread")}
          >
            Unread {unreadCount > 0 ? `(${unreadCount})` : ""}
          </Button>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1">
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-6 w-6" />}
          title="No notifications"
          description={filter === "unread" ? "You have no unread notifications." : "You have no notifications yet."}
          className="mt-6"
        />
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {items.map((n) => (
            <li
              key={n.id}
              className={`flex items-start gap-3 py-3 ${!n.read ? "bg-muted/30" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{n.title}</span>
                  {!n.read && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                      New
                    </span>
                  )}
                </div>
                {n.body && (
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{n.body}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()} {n.type ? `· ${n.type}` : ""}
                </p>
                {n.link && (
                  <Link
                    href={n.link}
                    className="mt-1 inline-block text-sm text-primary underline"
                  >
                    View
                  </Link>
                )}
              </div>
              {!n.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => markRead(n.id)}
                  title="Mark as read"
                >
                  <Check className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
