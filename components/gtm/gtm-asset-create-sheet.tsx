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
import { api } from "@/lib/api";
import { toast } from "sonner";
import { FolderOpen } from "lucide-react";
import type { AssetOption } from "@/components/gtm/gtm-view";
import { LibraryPicker, type LibraryDocumentOption } from "@/components/documents/library-picker";

export function GtmAssetCreateSheet({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (asset: AssetOption) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [url, setUrl] = useState("");
  const [folder, setFolder] = useState("");
  const [audience, setAudience] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !url.trim()) return;
    setSubmitting(true);
    try {
      const asset = await api<AssetOption>("/api/assets", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          type: type.trim() || null,
          url: url.trim(),
          folder: folder.trim() || null,
          audience: audience.trim() || null,
        }),
      });
      onCreated(asset);
      onClose();
    } catch {
      toast.error("Failed to create asset");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add asset</SheetTitle>
        </SheetHeader>
        <SheetBody>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1" />
          </div>
          <div>
            <Label>Type</Label>
            <Input value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. pitch_deck, one_pager" className="mt-1" />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>URL</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => setLibraryPickerOpen(true)}
              >
                <FolderOpen className="h-3 w-3" />
                From library
              </Button>
            </div>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} required placeholder="https://..." className="mt-1" />
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
            <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
        </SheetBody>
        <LibraryPicker
          open={libraryPickerOpen}
          onClose={() => setLibraryPickerOpen(false)}
          onSelect={(doc: LibraryDocumentOption) => {
            setName(doc.title);
            setUrl(doc.fileUrl);
            setLibraryPickerOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
