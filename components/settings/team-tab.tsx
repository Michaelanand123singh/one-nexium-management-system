"use client";

import { useState, useEffect, useCallback } from "react";
import type { Role } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLES, MEMBER_STATUS_LABELS, DEPARTMENT_LABELS } from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Users, UserPlus } from "lucide-react";
import type { TeamMemberRow } from "@/components/settings/team-member-sheet";
import { TeamMemberSheet } from "@/components/settings/team-member-sheet";
import { TeamAddUserSheet } from "@/components/settings/team-add-user-sheet";

export function TeamTab({ role, currentUserId }: { role: Role; currentUserId: string }) {
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const canEdit = role === "SUPER_ADMIN";

  const load = useCallback(() => {
    api<TeamMemberRow[]>("/api/settings/team-members")
      .then(setMembers)
      .catch(() => toast.error("Failed to load team"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = selectedId ? members.find((m) => m.id === selectedId) : null;

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Team & People</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Organisation members, roles, and status.
        </p>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Team & People</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Organisation members, roles, and status.
              </p>
            </div>
            {canEdit && (
              <Button size="sm" onClick={() => setAddUserOpen(true)} className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                Add user
              </Button>
            )}
          </div>
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="No members"
            description="No team members in this organisation yet."
            action={canEdit ? (
              <Button size="sm" onClick={() => setAddUserOpen(true)} className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                Add user
              </Button>
            ) : undefined}
            className="mt-6"
          />
        </div>
        <TeamAddUserSheet
          open={addUserOpen}
          onClose={() => setAddUserOpen(false)}
          onAdded={load}
        />
      </>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Team & People</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Organisation members, roles, and status.{" "}
              {canEdit
                ? "Click a row to edit."
                : "Only Super Admin can add or edit team members."}
            </p>
          </div>
          {canEdit ? (
            <Button size="sm" onClick={() => setAddUserOpen(true)} className="gap-1.5">
              <UserPlus className="h-4 w-4" />
              Add user
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sign in as Super Admin to add users
            </p>
          )}
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Department</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr
                  key={m.id}
                  className={
                    canEdit
                      ? "cursor-pointer border-b border-border last:border-0 hover:bg-muted/50"
                      : "border-b border-border last:border-0"
                  }
                  onClick={() => canEdit && setSelectedId(m.id)}
                >
                  <td className="px-4 py-3 font-medium">{m.name ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {ROLES[m.role as keyof typeof ROLES] ?? m.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {m.department ? (DEPARTMENT_LABELS[m.department as keyof typeof DEPARTMENT_LABELS] ?? m.department) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={m.status === "ACTIVE" ? "default" : "secondary"}>
                      {MEMBER_STATUS_LABELS[m.status as keyof typeof MEMBER_STATUS_LABELS] ?? m.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && (
        <TeamMemberSheet
          key={selected.id}
          member={selected}
          currentUserId={currentUserId}
          canEdit={canEdit}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
        />
      )}
      <TeamAddUserSheet
        open={addUserOpen}
        onClose={() => setAddUserOpen(false)}
        onAdded={load}
      />
    </>
  );
}
