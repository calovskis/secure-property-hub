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
import { countryLabel } from "@/data/countries";
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

  const known = knownDetails(request.kind, profile, user?.usPerson ?? false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{request.title}</DialogTitle>
          <DialogDescription>{request.description}</DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border bg-background p-3 text-xs">
          <div className="font-semibold text-foreground">Mortgage pre-approval questionnaire</div>
          <div className="mt-0.5 text-muted-foreground">
            {user ? fullName(user) : "—"} · submitted {formatDate(profile.submittedAt)}
          </div>
          {known.length ? (
            <dl className="mt-3 grid gap-1.5 border-t border-border pt-3 sm:grid-cols-2">
              {known.map((item) => (
                <div key={item.label}>
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd className="font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

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

/** Everything already on file that relates to the requested document. */
function knownDetails(
  kind: DocumentRequest["kind"],
  profile: MortgageProfile,
  usPerson: boolean,
): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  const date = (v?: string) => (v ? isoToUsDate(v) || v : "—");

  if (kind === "visaDocuments") {
    const status = usStatusOf(profile, usPerson);
    out.push({
      label: "Declared status",
      value:
        status === "other" && profile.otherVisaType
          ? `Other — ${profile.otherVisaType}`
          : US_STATUS_LABEL[status],
    });
    out.push({ label: "Issued", value: date(profile.visaIssued) });
    out.push({ label: "Valid until", value: date(profile.visaValidUntil) });
    out.push({ label: "Citizenship", value: countryLabel(profile.citizenship) || "—" });
  }

  if (kind === "idDocuments") {
    out.push({
      label: "Status on file",
      value: US_STATUS_LABEL[usStatusOf(profile, usPerson)],
    });
    out.push({ label: "Date of birth", value: date(profile.dateOfBirth) });
    out.push({ label: "Citizenship", value: countryLabel(profile.citizenship) || "—" });
    if (profile.hasItin) out.push({ label: "ITIN", value: profile.itin ? "On file" : "Declared" });
    out.push({
      label: "Accepted documents",
      value: "Driver's licence (front & back), green card or passport",
    });
  }

  if (kind === "bankruptcyDocuments") {
    const d = profile.declarations;
    out.push({ label: "Bankruptcy declared", value: d?.bankruptcy ? "Yes" : "—" });
    out.push({
      label: "Chapter(s)",
      value: d?.bankruptcyChapters?.length ? d.bankruptcyChapters.join(", ") : "—",
    });
    out.push({
      label: "Discharge date",
      value: d?.bankruptcyDischargeDate ? d.bankruptcyDischargeDate : "—",
    });
  }

  return out.filter((i) => i.value && i.value !== "—");
}
