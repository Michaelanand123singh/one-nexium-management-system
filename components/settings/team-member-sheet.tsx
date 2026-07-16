"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { ROLES, TEAM_ASSIGNABLE_ROLES, MEMBER_STATUS_LABELS, MEMBER_STATUSES, DEPARTMENT_LABELS, DEPARTMENTS } from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { Role } from "@prisma/client";

/** Native <select> options stay readable in dark theme. */
const nativeSelectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm [color-scheme:dark]";
const nativeOptionClassName = "bg-background text-foreground";

export type TeamMemberRow = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  department: string | null;
  status: string;
  joinedAt: string;
};

export function TeamMemberSheet({
  member,
  currentUserId,
  canEdit,
  onClose,
  onUpdated,
}: {
  member: TeamMemberRow;
  currentUserId: string;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [role, setRole] = useState(member.role);
  const [department, setDepartment] = useState(member.department ?? "");
  const [status, setStatus] = useState(member.status);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminConfirmPassword, setAdminConfirmPassword] = useState("");
  const [settingPassword, setSettingPassword] = useState(false);
  const isSelf = member.userId === currentUserId;
  const roleOptions = (
    TEAM_ASSIGNABLE_ROLES.includes(member.role as (typeof TEAM_ASSIGNABLE_ROLES)[number])
      ? [...TEAM_ASSIGNABLE_ROLES]
      : [...TEAM_ASSIGNABLE_ROLES, member.role as Role]
  );

  useEffect(() => {
    setRole(member.role);
    setDepartment(member.department ?? "");
    setStatus(member.status);
    setAdminNewPassword("");
    setAdminConfirmPassword("");
  }, [member.id, member.role, member.department, member.status]);

  async function handleSave() {
    if (!canEdit) return;
    setSaving(true);
    try {
      await api(`/api/settings/team-members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          role,
          department: department || null,
          status,
        }),
      });
      toast.success("Member updated");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveFromTeam() {
    if (!canEdit || isSelf) return;
    if (
      !confirm(
        `Remove ${member.name ?? member.email} from this organisation? Their account remains; they will lose access to this workspace.`
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await api(`/api/settings/team-members/${member.id}`, { method: "DELETE" });
      toast.success("Member removed from team");
      onUpdated();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to remove member";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleSetPasswordForMember() {
    if (!canEdit || isSelf) return;
    if (adminNewPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setSettingPassword(true);
    try {
      await api(`/api/settings/team-members/${member.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword: adminNewPassword }),
      });
      toast.success("Password updated — they must sign in again");
      setAdminNewPassword("");
      setAdminConfirmPassword("");
      onUpdated();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to set password";
      toast.error(message);
    } finally {
      setSettingPassword(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Team member</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-medium">{member.name ?? member.email}</p>
            <p className="text-sm text-muted-foreground">{member.email}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Joined {new Date(member.joinedAt).toLocaleDateString()}
            </p>
          </div>
          {canEdit ? (
            <>
              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  className={nativeSelectClassName}
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {roleOptions.map((value) => (
                    <option key={value} value={value} className={nativeOptionClassName}>
                      {ROLES[value] ?? value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <select
                  className={nativeSelectClassName}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="" className={nativeOptionClassName}>
                    —
                  </option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d} className={nativeOptionClassName}>
                      {DEPARTMENT_LABELS[d]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className={nativeSelectClassName}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {MEMBER_STATUSES.map((s) => (
                    <option key={s} value={s} className={nativeOptionClassName}>
                      {MEMBER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </div>
              {isSelf && (
                <p className="border-t border-border pt-4 text-xs text-muted-foreground">
                  To change your password, open the Account tab in Settings.
                </p>
              )}
              {!isSelf && (
                <div className="space-y-3 border-t border-border pt-4">
                  <div>
                    <h3 className="text-sm font-medium">Sign-in password</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Set or replace this person’s email password. All of their sessions will be signed out.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`member-pw-${member.id}`}>New password</Label>
                    <Input
                      id={`member-pw-${member.id}`}
                      type="password"
                      autoComplete="new-password"
                      value={adminNewPassword}
                      onChange={(e) => setAdminNewPassword(e.target.value)}
                      className="h-9"
                      minLength={PASSWORD_MIN_LENGTH}
                      disabled={saving || deleting || settingPassword}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`member-pw2-${member.id}`}>Confirm password</Label>
                    <Input
                      id={`member-pw2-${member.id}`}
                      type="password"
                      autoComplete="new-password"
                      value={adminConfirmPassword}
                      onChange={(e) => setAdminConfirmPassword(e.target.value)}
                      className="h-9"
                      minLength={PASSWORD_MIN_LENGTH}
                      disabled={saving || deleting || settingPassword}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={saving || deleting || settingPassword}
                    onClick={handleSetPasswordForMember}
                  >
                    {settingPassword ? "Updating…" : "Update password"}
                  </Button>
                </div>
              )}
              <div className="flex flex-col gap-4 border-t border-border pt-4">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={handleSave} disabled={saving || deleting || settingPassword}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={onClose} disabled={saving || deleting || settingPassword}>
                    Cancel
                  </Button>
                </div>
                <div className="border-t border-border pt-4">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={saving || deleting || settingPassword || isSelf}
                    onClick={handleRemoveFromTeam}
                  >
                    {deleting ? "Removing…" : "Remove from organisation"}
                  </Button>
                  {isSelf && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      You cannot remove your own membership. Ask another Super Admin if you need to leave.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="text-muted-foreground">Role:</span>
              <span>{ROLES[role as keyof typeof ROLES] ?? role}</span>
              {department && (
                <>
                  <span className="text-muted-foreground">Department:</span>
                  <span>{DEPARTMENT_LABELS[department as keyof typeof DEPARTMENT_LABELS] ?? department}</span>
                </>
              )}
              <span className="text-muted-foreground">Status:</span>
              <span>{MEMBER_STATUS_LABELS[status as keyof typeof MEMBER_STATUS_LABELS] ?? status}</span>
            </div>
          )}
        </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
