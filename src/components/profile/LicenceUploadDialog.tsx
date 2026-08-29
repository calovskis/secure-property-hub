/**
 * Pop-up that collects a licence copy for every state the realtor declared.
 *
 * The whole list of states sits inside one window: attach, change or delete a
 * copy per state, stop whenever you like (progress is pre-saved), then
 * reconfirm and submit everything at once.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/dates";
import type { RealtorLicenseDoc } from "@/lib/partner-requests";
import {
  clearUploadDraft,
  getUploadDraft,
  onOpenUpload,
  saveUploadDraft,
} from "@/lib/upload-drafts";

export function LicenceUploadDialog({
  open,
  onOpenChange,
  draftId,
  licenses,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string;
  licenses: RealtorLicenseDoc[];
  /** state code → uploaded file name */
  onSubmit: (copies: Record<string, string>) => void;
}) {
  const [copies, setCopies] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"upload" | "confirm">("upload");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => onOpenUpload(draftId, () => onOpenChange(true)), [draftId, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const draft = getUploadDraft(draftId);
    setCopies(draft?.states ?? {});
    setRestored(Boolean(draft));
    setStep("upload");
    setConfirmed(false);
    setError(null);
  }, [open, draftId]);

  function persist(next: Record<string, string>) {
    saveUploadDraft({
      id: draftId,
      label: "State licence copies",
      files: [],
      states: next,
      expected: licenses.length || 1,
    });
  }

  function setCopy(state: string, name: string) {
    const next = { ...copies, [state]: name };
    setCopies(next);
    persist(next);
  }

  function removeCopy(state: string) {
    const { [state]: _drop, ...rest } = copies;
    setCopies(rest);
    persist(rest);
  }

  const staged = Object.keys(copies).length;
  const missing = licenses.filter((l) => !l.doc && !copies[l.state]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload your state licence copies</DialogTitle>
          <DialogDescription>
            One copy per state you are licensed in. You can stop at any point — what you attached is
            pre-saved and waiting for you under &quot;Unfinished uploads&quot;.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="mt-2 space-y-4">
            {restored ? (
              <p className="text-[11px] font-semibold text-gold">
                Pre-saved progress restored — {staged} copy(ies) attached, nothing submitted yet.
              </p>
            ) : null}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {licenses.length - missing.length} of {licenses.length} states covered
              </span>
              <div className="ml-3 h-1.5 w-40 rounded-full bg-muted">
                <div
                  className="h-1.5 rounded-full bg-brand"
                  style={{
                    width: `${licenses.length ? ((licenses.length - missing.length) / licenses.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <ul className="space-y-2">
              {licenses.map((l) => {
                const stagedName = copies[l.state];
                return (
                  <li
                    key={l.state}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {l.state} · {l.number}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Valid until {formatDate(l.validUntil)}
                      </div>
                      {stagedName ? (
                        <div className="mt-1 truncate text-xs font-semibold text-gold">
                          📎 {stagedName} · pre-saved
                        </div>
                      ) : l.doc ? (
                        <div className="mt-1 truncate text-xs text-success">
                          📎 {l.doc} · already on file
                        </div>
                      ) : (
                        <div className="mt-1 text-xs font-semibold text-gold">
                          {l.recopyRequestedAt
                            ? "Details changed — new copy required"
                            : "Copy still needed"}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <label className="cursor-pointer rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const name = e.target.files?.[0]?.name;
                            if (name) setCopy(l.state, name);
                            e.target.value = "";
                          }}
                        />
                        {stagedName || l.doc ? "Change" : "Upload"}
                      </label>
                      {stagedName ? (
                        <button
                          type="button"
                          onClick={() => removeCopy(l.state)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Save &amp; continue later
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!staged) return setError("Attach at least one licence copy.");
                  setError(null);
                  setStep("confirm");
                }}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
              >
                Review &amp; submit
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-4">
            <ul className="rounded-md border border-border bg-background p-3 text-xs text-foreground">
              {Object.entries(copies).map(([state, name]) => (
                <li key={state} className="py-0.5">
                  <span className="font-semibold">{state}</span> — 📎 {name}
                </li>
              ))}
            </ul>
            {missing.length ? (
              <p className="text-xs text-muted-foreground">
                {missing.length} state(s) still without a copy: {missing.map((m) => m.state).join(", ")}.
                You can submit what you have and finish the rest later.
              </p>
            ) : null}
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              I confirm each copy matches the licence number and validity date on file.
            </label>
            {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!confirmed) return setError("Please reconfirm before submitting.");
                  onSubmit(copies);
                  clearUploadDraft(draftId);
                  onOpenChange(false);
                }}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
              >
                Submit copies
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
