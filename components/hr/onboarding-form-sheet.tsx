"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { OnboardingRow as BaseOnboardingRow } from "@/components/hr/onboarding-list";
import { Plus, Trash2 } from "lucide-react";

export type OnboardingRow = BaseOnboardingRow & {
  formTemplateJson?: {
    fields: Array<{
      id: string;
      label: string;
      type: "text" | "number" | "date";
      required: boolean;
    }>;
  } | null;
  formDataJson?: Record<string, unknown> | null;
};

type OrganisationMember = {
  id: string;
  name: string | null;
  email: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onboarding: OnboardingRow | null;
  canManage: boolean;
  onSaved: () => void | Promise<void>;
};

export function OnboardingFormSheet({
  open,
  onOpenChange,
  onboarding,
  canManage,
  onSaved,
}: Props) {
  const [members, setMembers] = useState<OrganisationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingMembers(true);
    api<OrganisationMember[]>("/api/team/members")
      .then(setMembers)
      .catch(() => {
        // Members are only used for assigning owner; not fatal if fails.
      })
      .finally(() => setLoadingMembers(false));
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {onboarding ? "Onboarding details" : "New onboarding"}
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
          <OnboardingForm
            onboarding={onboarding}
            canManage={canManage}
            members={members}
            loadingMembers={loadingMembers}
            onCancel={handleClose}
            onSaved={async () => {
              await onSaved();
              handleClose();
            }}
            onSavedKeepOpen={async () => {
              await onSaved();
            }}
          />
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

type FormProps = {
  onboarding: OnboardingRow | null;
  canManage: boolean;
  members: OrganisationMember[];
  loadingMembers: boolean;
  onCancel: () => void;
  onSaved: () => void | Promise<void>;
  onSavedKeepOpen?: () => void | Promise<void>;
};

function OnboardingForm({
  onboarding,
  canManage,
  members,
  loadingMembers,
  onCancel,
  onSaved,
  onSavedKeepOpen,
}: FormProps) {
  const [fullName, setFullName] = useState(onboarding?.fullName ?? "");
  const [email, setEmail] = useState(onboarding?.email ?? "");
  const [phone, setPhone] = useState(onboarding?.phone ?? "");
  const [joiningDate, setJoiningDate] = useState(
    onboarding?.joiningDate
      ? onboarding.joiningDate.slice(0, 10)
      : ""
  );
  const [jobTitle, setJobTitle] = useState(onboarding?.jobTitle ?? "");
  const [department, setDepartment] = useState(
    onboarding?.department ?? ""
  );
  const [location, setLocation] = useState(onboarding?.location ?? "");
  const [ownerUserId, setOwnerUserId] = useState(
    onboarding?.ownerUserId ?? ""
  );
  const [notes, setNotes] = useState(
    () => String(onboarding?.formDataJson?.notes ?? "")
  );
  const [status, setStatus] = useState(onboarding?.status ?? "DRAFT");
  const [selfServe, setSelfServe] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publicLink, setPublicLink] = useState<string | null>(null);
  const [formFields, setFormFields] = useState<
    Array<{
      id: string;
      label: string;
      type: "text" | "number" | "date";
      required: boolean;
    }>
  >(onboarding?.formTemplateJson?.fields ?? []);

  useEffect(() => {
    setFullName(onboarding?.fullName ?? "");
    setEmail(onboarding?.email ?? "");
    setPhone(onboarding?.phone ?? "");
    setJoiningDate(
      onboarding?.joiningDate ? onboarding.joiningDate.slice(0, 10) : ""
    );
    setJobTitle(onboarding?.jobTitle ?? "");
    setDepartment(onboarding?.department ?? "");
    setLocation(onboarding?.location ?? "");
    setOwnerUserId(onboarding?.ownerUserId ?? "");
    setNotes(String(onboarding?.formDataJson?.notes ?? ""));
    setStatus(onboarding?.status ?? "DRAFT");
    setPublicLink(onboarding?.publicUrl ?? null);
    setFormFields(onboarding?.formTemplateJson?.fields ?? []);
  }, [onboarding]);

  const addField = () => {
    setFormFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID().replace(/-/g, ""),
        label: "",
        type: "text",
        required: true,
      },
    ]);
  };

  const removeField = (id: string) => {
    setFormFields((prev) => prev.filter((f) => f.id !== id));
  };

  const updateField = (
    id: string,
    updates: Partial<{
      label: string;
      type: "text" | "number" | "date";
      required: boolean;
    }>
  ) => {
    setFormFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    try {
      if (!onboarding) {
        const res = await api<{
          onboarding: OnboardingRow;
          publicUrl: string | null;
        }>("/api/hr/onboarding", {
          method: "POST",
          body: {
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            joiningDate: joiningDate || null,
            jobTitle: jobTitle.trim() || null,
            department: department.trim() || null,
            location: location.trim() || null,
            ownerUserId: ownerUserId || undefined,
            formDataJson: {
              notes: notes.trim() || null,
            },
            formTemplateJson: { fields: formFields },
            selfServe,
          },
        });
        if (res.publicUrl) {
          setPublicLink(res.publicUrl);
          toast.success("Saved — copy the self-serve link below");
          await onSavedKeepOpen?.();
          return;
        }
      } else {
        await api(`/api/hr/onboarding/${onboarding.id}`, {
          method: "PATCH",
          body: {
            fullName: fullName.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            joiningDate: joiningDate || null,
            jobTitle: jobTitle.trim() || null,
            department: department.trim() || null,
            location: location.trim() || null,
            ownerUserId: ownerUserId || null,
            status,
            formDataJson: {
              ...onboarding.formDataJson,
              notes: notes.trim() || null,
            },
            formTemplateJson: { fields: formFields },
          },
        });
      }
      toast.success("Saved");
      await onSaved();
    } catch {
      toast.error("Failed to save onboarding");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
      {onboarding &&
        onboarding.formDataJson &&
        Object.keys(onboarding.formDataJson).some((k) => k !== "notes") && (
          <div className="rounded-md border border-border bg-muted/30 p-3">
            <h3 className="mb-2 text-sm font-semibold">Candidate Submission</h3>
            <div className="space-y-2">
              {onboarding.formTemplateJson?.fields.map((field) => (
                <div key={field.id} className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">{field.label}:</span>
                  <span className="font-medium text-foreground">
                    {String(onboarding.formDataJson?.[field.id] || "—")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

      <div className="grid grid-cols-1 gap-4">
        <div>
          <Label>Full name</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Joining date</Label>
            <Input
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Job title</Label>
            <Input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Department</Label>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label>Location</Label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-1"
          />
        </div>

        <div className="rounded-md border border-dashed border-border p-3">
          <div className="mb-3 flex items-center justify-between">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Custom Form Fields (for Candidate)
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addField}
              className="h-7 px-2"
            >
              <Plus className="mr-1 h-3 w-3" /> Add field
            </Button>
          </div>

          {formFields.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground italic">
              No custom fields added. Candidate will only see basic info.
            </p>
          ) : (
            <div className="space-y-3">
              {formFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-end gap-2 rounded-md bg-muted/20 p-2"
                >
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] uppercase">Label</Label>
                    <Input
                      value={field.label}
                      onChange={(e) =>
                        updateField(field.id, { label: e.target.value })
                      }
                      placeholder="e.g. GitHub Username"
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="w-24 space-y-1">
                    <Label className="text-[10px] uppercase">Type</Label>
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateField(field.id, {
                          type: e.target.value as "text" | "number" | "date",
                        })
                      }
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-[10px]"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                  <div className="flex h-8 mb-0.5 items-center gap-1 px-1">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) =>
                        updateField(field.id, { required: e.target.checked })
                      }
                      className="h-3 w-3"
                    />
                    <span className="text-[10px] uppercase">Req</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeField(field.id)}
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <Label>Owner</Label>
          <select
            value={ownerUserId}
            onChange={(e) => setOwnerUserId(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.email}
              </option>
            ))}
          </select>
          {loadingMembers && (
            <p className="mt-1 text-xs text-muted-foreground">Loading team…</p>
          )}
        </div>
        {onboarding && (
          <div>
            <Label>Status</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="DRAFT">Draft</option>
              <option value="PENDING_INFO">Pending info</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        )}
        {!onboarding && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              id="self-serve"
              type="checkbox"
              checked={selfServe}
              onChange={(e) => setSelfServe(e.target.checked)}
              className="h-3 w-3"
            />
            <label htmlFor="self-serve">
              Generate self-serve link for candidate to fill details
            </label>
          </div>
        )}
        <div>
          <Label>Internal notes (HR only)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-4">
        <div className="flex gap-2">
          <Button type="submit" disabled={!canManage || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        {publicLink && (
          <div className="rounded-md border border-dashed border-border bg-muted/40 p-2 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="font-medium text-foreground">
                Self-serve onboarding link
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(publicLink);
                    toast.success("Link copied to clipboard");
                  } catch {
                    toast.error("Failed to copy link. Please copy manually.");
                  }
                }}
              >
                Copy link
              </Button>
            </div>
            <div className="mt-1 break-all">{publicLink}</div>
          </div>
        )}
      </div>
    </form>
  );
}

