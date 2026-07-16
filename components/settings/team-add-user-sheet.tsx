"use client";

import { useState } from "react";
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
import { ROLES, TEAM_ASSIGNABLE_ROLES, DEPARTMENT_LABELS, DEPARTMENTS } from "@/lib/constants";
import { api } from "@/lib/api";
import { toast } from "sonner";

/** Native <select> options stay readable in dark theme (OS dropdown uses light panel otherwise). */
const nativeSelectClassName =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm [color-scheme:dark]";
const nativeOptionClassName = "bg-background text-foreground";

export function TeamAddUserSheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("DEVELOPER");
  const [department, setDepartment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api("/api/settings/team-members", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          password: password || undefined,
          role,
          department: department || null,
        }),
      });
      toast.success("User added to team");
      setName("");
      setEmail("");
      setPassword("");
      setRole("DEVELOPER");
      setDepartment("");
      onAdded();
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add user";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Add user</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-2">
            <Label htmlFor="add-user-name">Name (optional)</Label>
            <Input
              id="add-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-user-email">Email *</Label>
            <Input
              id="add-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="h-9"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-user-password">Password (for new users)</Label>
            <Input
              id="add-user-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="h-9"
              minLength={6}
            />
            <p className="text-xs text-muted-foreground">
              Required when creating a new account. Ignored if email already exists.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-user-role">Role *</Label>
            <select
              id="add-user-role"
              className={nativeSelectClassName}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              {TEAM_ASSIGNABLE_ROLES.map((value) => (
                <option key={value} value={value} className={nativeOptionClassName}>
                  {ROLES[value]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-user-department">Department (optional)</Label>
            <select
              id="add-user-department"
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
          <div className="flex gap-2 border-t border-border pt-4">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Adding…" : "Add user"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
