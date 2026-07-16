"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password-policy";
import { KeyRound } from "lucide-react";

type SessionUserPayload = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  organisationId: string;
  organisationName: string;
  hasPassword: boolean;
};

export function AccountTab() {
  const [user, setUser] = useState<SessionUserPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    api<{ user: SessionUserPayload | null }>("/api/auth/session")
      .then((r) => setUser(r.user))
      .catch(() => toast.error("Failed to load account"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      toast.error(`New password must be at least ${PASSWORD_MIN_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/account/password", {
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: user.hasPassword ? currentPassword : undefined,
          newPassword,
        }),
      });
      toast.success(
        user.hasPassword ? "Password updated" : "Password set — you can sign in with email and password"
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      load();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update password";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">Sign-in and profile</p>
        <div className="mt-4 space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.name ? (
              <>
                Signed in as <span className="font-medium text-foreground">{user.name}</span>
                <span className="text-muted-foreground"> · {user.email}</span>
              </>
            ) : (
              <>Signed in as {user.email}</>
            )}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-4">
        <div className="border-b border-border pb-2">
          <h3 className="text-sm font-medium">Password</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {user.hasPassword
              ? "Change the password you use with email sign-in."
              : "You signed in without a password (for example with Google). Set one to enable email and password sign-in."}
          </p>
        </div>
        {user.hasPassword && (
          <div className="space-y-2">
            <Label htmlFor="account-current-password">Current password</Label>
            <Input
              id="account-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="h-9"
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="account-new-password">New password</Label>
          <Input
            id="account-new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="h-9"
            minLength={PASSWORD_MIN_LENGTH}
            placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="account-confirm-password">Confirm new password</Label>
          <Input
            id="account-confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-9"
            minLength={PASSWORD_MIN_LENGTH}
          />
        </div>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Saving…" : user.hasPassword ? "Update password" : "Set password"}
        </Button>
      </form>
    </div>
  );
}
