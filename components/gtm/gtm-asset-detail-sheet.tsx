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
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { toast } from "sonner";
import type { AssetOption } from "@/components/gtm/gtm-view";

export function GtmAssetDetailSheet({
  id,
  canEdit,
  onClose,
  onUpdated,
  onDeleted,
}: {
  id: string;
  canEdit: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [asset, setAsset] = useState<AssetOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api<AssetOption>(`/api/assets/${id}`)
      .then(setAsset)
      .catch(() => toast.error("Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!canEdit || !confirm("Remove this asset?")) return;
    try {
      await api(`/api/assets/${id}`, { method: "DELETE" });
      onDeleted();
    } catch {
      toast.error("Failed to delete");
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Asset</SheetTitle>
        </SheetHeader>
        <SheetBody>
          {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : asset && editing ? (
          <GtmAssetEditForm
            asset={asset}
            id={id}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              setEditing(false);
              toast.success("Saved");
              const full = await api<AssetOption>(`/api/assets/${id}`);
              setAsset(full);
              onUpdated();
            }}
          />
        ) : asset ? (
          <div className="flex flex-col gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Name</h3>
              <p className="mt-1 font-medium">{asset.name}</p>
            </div>
            {(asset.type || asset.audience) && (
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {asset.type && <span>Type: {asset.type}</span>}
                {asset.audience && <span>Audience: {asset.audience}</span>}
              </div>
            )}
            {asset.folder && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Folder</h3>
                <p className="mt-1 text-sm">{asset.folder}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">URL</h3>
              <a
                href={asset.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all text-sm text-primary underline"
              >
                {asset.url}
              </a>
            </div>
            {canEdit && (
              <div className="flex gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>Remove</Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Asset not found.</p>
        )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function GtmAssetEditForm({
  asset,
  id,
  onClose,
  onSaved,
}: {
  asset: AssetOption;
  id: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState(asset.name);
  const [type, setType] = useState(asset.type ?? "");
  const [url, setUrl] = useState(asset.url);
  const [folder, setFolder] = useState(asset.folder ?? "");
  const [audience, setAudience] = useState(asset.audience ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api(`/api/assets/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim(),
          type: type.trim() || null,
          url: url.trim(),
          folder: folder.trim() || null,
          audience: audience.trim() || null,
        }),
      });
      await onSaved();
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-4">
      <div>
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
      </div>
      <div>
        <Label>Type</Label>
        <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. pitch_deck" className="mt-1" />
      </div>
      <div>
        <Label>URL</Label>
        <Input value={url} onChange={(e) => setUrl(e.target.value)} required className="mt-1" />
      </div>
      <div>
        <Label>Folder</Label>
        <Input value={folder} onChange={(e) => setFolder(e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label>Audience</Label>
        <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. internal | partner | public" className="mt-1" />
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
      </div>
    </form>
  );
}
