/**
 * Renewal pop-up for ONE expiring (or expired) state licence.
 *
 * Nothing else on the realtor's coverage list is touched here: we only ask for
 * the renewed licence number, its new validity date and a copy of the renewed
 * licence for that single state.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/form/DateInput";
import { formatDate } from "@/lib/dates";
import type { RealtorLicenseDoc } from "@/lib/partner-requests";
import { storeLicenceFile } from "@/lib/licence-files";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

export function LicenceRenewalDialog({
  open,
  onOpenChange,
  license,
  onSubmit,
  completed = false,
  ownerEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  license: RealtorLicenseDoc | undefined;
  onSubmit: (next: { number: string; validUntil: string; doc: string }) => void;
  /** Partner the copy belongs to — keeps the file for Loqal to download. */
  ownerEmail?: string;
  /** Renewal already provided — show what is on file instead of an empty form. */
  completed?: boolean;
}) {
  const [number, setNumber] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [doc, setDoc] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setNumber(license?.number ?? "");
    setValidUntil("");
    setDoc("");
    setConfirmed(false);
    setError(null);
  }, [open, license?.state, license?.number]);

  if (!license) return null;

  if (completed) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{license.state} licence updated</DialogTitle>
            <DialogDescription>
              Thank you — we have updated your {license.state} licence information. Nothing else is
              needed from you for this state.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-success">
                Now on file
              </div>
              <div className="mt-1 font-semibold text-foreground">Licence no. {license.number}</div>
              <div className="text-xs text-muted-foreground">
                Valid until {formatDate(license.validUntil)}
              </div>
              {license.doc ? (
                <div className="mt-1 truncate text-xs font-semibold text-gold">📎 {license.doc}</div>
              ) : null}
              {license.uploadedAt ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Provided on {formatDate(license.uploadedAt)}
                </div>
              ) : null}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }


  const expired = new Date(license.validUntil).getTime() < Date.now();

  function submit() {
    if (!number.trim()) return setError("Enter the renewed licence number.");
    if (!validUntil) return setError("Enter the new validity date.");
    if (new Date(validUntil).getTime() <= Date.now())
      return setError("The new validity date has to be in the future.");
    if (!doc) return setError("Attach a copy of the renewed licence.");
    if (!confirmed) return setError("Please confirm the details before submitting.");
    setError(null);
    onSubmit({ number: number.trim(), validUntil, doc });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Renew your {license.state} licence</DialogTitle>
          <DialogDescription>
            {expired
              ? `Your ${license.state} licence expired on ${formatDate(license.validUntil)}.`
              : `Your ${license.state} licence is valid until ${formatDate(license.validUntil)}.`}{" "}
            Only this state is affected — your other licences stay exactly as they are.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-4">
          <div className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
            Currently on file: <span className="font-semibold text-foreground">{license.number}</span>{" "}
            · valid till {formatDate(license.validUntil)}
          </div>

          <div>
            <label className={labelClass} htmlFor="renew-number">
              New licence number
            </label>
            <input
              id="renew-number"
              className={inputClass}
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder={`${license.state} licence number`}
            />
          </div>

          <div>
            <label className={labelClass}>New validity date</label>
            <DateInput value={validUntil} onChange={setValidUntil} />
          </div>

          <div>
            <label className={labelClass}>Copy of the renewed licence</label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="cursor-pointer rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand">
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setDoc(file.name);
                      if (ownerEmail && license)
                        void storeLicenceFile(ownerEmail, license.state, file);
                    }
                    e.target.value = "";
                  }}
                />
                {doc ? "Change file" : "Attach file"}
              </label>
              {doc ? (
                <span className="truncate text-xs font-semibold text-gold">📎 {doc}</span>
              ) : null}
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            I confirm this document is correct and authentic and I have legal rights to share it with
            Loqal.
          </label>

          {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Submit renewal
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
