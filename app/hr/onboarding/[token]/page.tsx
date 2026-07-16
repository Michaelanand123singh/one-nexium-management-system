"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type PublicOnboarding = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  joiningDate: string | null;
  jobTitle: string | null;
  department: string | null;
  location: string | null;
  status: string;
  formDataJson: Record<string, unknown> | null;
  formTemplateJson: {
    fields: Array<{
      id: string;
      label: string;
      type: "text" | "number" | "date";
      required: boolean;
    }>;
  } | null;
};

export default function OnboardingPublicPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [data, setData] = useState<PublicOnboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [customFields, setCustomFields] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await api<PublicOnboarding>(
          `/api/hr/onboarding/public/${token}`
        );
        setData(res);
        setFullName(res.fullName);
        setPhone(res.phone ?? "");
        setJoiningDate(
          res.joiningDate ? res.joiningDate.slice(0, 10) : ""
        );
        setJobTitle(res.jobTitle ?? "");
        setDepartment(res.department ?? "");
        setLocation(res.location ?? "");
        const existingNotes =
          res.formDataJson && typeof res.formDataJson.notes === "string"
            ? res.formDataJson.notes
            : "";
        setNotes(existingNotes);
        const initialCustom = { ...(res.formDataJson ?? {}) } as Record<
          string,
          string
        >;
        delete initialCustom.notes;
        setCustomFields(initialCustom);
      } catch {
        setError("This onboarding link is no longer available.");
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      void load();
    }
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    setSaving(true);
    try {
      await api(`/api/hr/onboarding/public/${token}`, {
        method: "PATCH",
        body: {
          fullName: fullName.trim(),
          phone: phone.trim() || null,
          joiningDate: joiningDate || null,
          jobTitle: jobTitle.trim() || null,
          department: department.trim() || null,
          location: location.trim() || null,
          formDataJson: {
            ...customFields,
            notes: notes.trim() || null,
          },
        },
      });
      toast.success("Your details have been submitted. Thank you!");
    } catch {
      toast.error("Failed to submit details. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to OneNexium
          </h1>
          <p className="text-sm text-muted-foreground">
            Please confirm your details so we can complete your onboarding.
          </p>
        </header>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : data ? (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-md border border-border bg-card p-4 shadow-sm"
          >
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={data.email} disabled />
              <p className="text-xs text-muted-foreground">
                If this email is incorrect, contact your recruiter or HR.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Joining date</Label>
              <Input
                type="date"
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Job title</Label>
              <Input
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Location (city, country)</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            {data.formTemplateJson?.fields.map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label>
                  {field.label}
                  {field.required && <span className="ml-1 text-destructive">*</span>}
                </Label>
                <Input
                  type={field.type}
                  value={customFields[field.id] || ""}
                  onChange={(e) =>
                    setCustomFields((prev) => ({
                      ...prev,
                      [field.id]: e.target.value,
                    }))
                  }
                  required={field.required}
                />
              </div>
            ))}

            <div className="space-y-1.5">
              <Label>Anything we should know before day one?</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
            <div className="pt-2">
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Submitting…" : "Submit details"}
              </Button>
            </div>
          </form>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          Powered by Nexium OS — internal tools for OneNexium.
        </p>
      </div>
    </main>
  );
}

