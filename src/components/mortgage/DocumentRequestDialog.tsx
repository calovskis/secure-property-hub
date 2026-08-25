import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fullName, useAuth, type MortgageProfile, type StoredDocument } from "@/lib/auth";
import { useLeads } from "@/lib/leads";
import { uid, US_STATUS_LABEL, usStatusOf } from "@/lib/mortgage-form";
import { formatDate, isoToUsDate } from "@/lib/dates";
import {
  useStagedDocuments,
  type DocumentRequest,
  type StagedDocument,
} from "@/lib/document-requests";

/**
 * One focused upload form per outstanding document request, opened as a pop-up.
 * Chosen files stay pre-saved until the client explicitly confirms submission.
 */
export function DocumentRequestDialog({
  request,
  profile,
  open,
  onOpenChange,
}: {
  request: DocumentRequest;
  profile: MortgageProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, saveMortgageProfile } = useAuth();
  const { leadsForClient, updateLead } = useLeads();
  const { docs, add, remove, clear } = useStagedDocuments(user?.email, request.kind);
  const [busy, setBusy] = useState(false);

  const confirm = () => {
    if (!docs.length || !user) return;
    const now = new Date().toISOString();
    const stored: StoredDocument[] = docs.map((d) => ({
      id: d.id,
      name: d.name,
      uploadedAt: now,
      url: d.url,
    }));
    const next: MortgageProfile = {
      ...profile,
      [request.kind]: [...(profile[request.kind] ?? []), ...stored],
      ...(request.kind === "visaDocuments" && stored[0]
        ? { visaDocumentName: stored[0].name, visaDocumentUploadedAt: now }
        : {}),
    };
    saveMortgageProfile(next);
    for (const lead of leadsForClient(user.email)) {
      if (lead.profile) updateLead(lead.id, { profile: next });
    }
    clear();
    toast.success(`${request.title} submitted`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription>{request.description}</DialogDescription>
        </DialogHeader>

        <p className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">{request.reason}</p>

        <div className="mt-3 space-y-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint hover:text-brand">
            {docs.length ? "Add more files" : "Choose files"}
            <input
              type="file"
              multiple
              accept="image/*,application/pdf"
              className="hidden"
              onChange={async (e) => {
                const selected = Array.from(e.target.files ?? []);
                e.currentTarget.value = "";
                if (!selected.length) return;
                setBusy(true);
                const next: StagedDocument[] = await Promise.all(
                  selected.map(async (file) => ({
                    id: uid(),
                    name: file.name,
                    addedAt: new Date().toISOString(),
                    url: await new Promise<string>((resolve) => {
                      const reader = new FileReader();
                      reader.onload = () =>
                        resolve(typeof reader.result === "string" ? reader.result : "");
                      reader.readAsDataURL(file);
                    }),
                  })),
                );
                add(next);
                setBusy(false);
              }}
            />
          </label>

          {docs.length ? (
            <>
              <ul className="space-y-2">
                {docs.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-xs"
                  >
                    <span className="truncate text-foreground">📎 {doc.name}</span>
                    <button
                      type="button"
                      onClick={() => remove(doc.id)}
                      className="font-semibold text-destructive"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                These files are pre-saved. Nothing is submitted until you confirm below — you can
                close this window and finish later.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              No files added yet. This form stays under <strong>Unfinished forms</strong> until you
              submit it.
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Save for later
          </button>
          <button
            type="button"
            disabled={!docs.length || busy}
            onClick={confirm}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
          >
            Confirm and submit
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
