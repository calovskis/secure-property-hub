import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Globe2, Handshake, Landmark, ShieldCheck } from "lucide-react";
import type { MortgageProfile, StoredDocument } from "@/lib/auth";
import { countryLabel } from "@/data/countries";
import { formatDate } from "@/lib/dates";
import { CountryCombobox } from "@/components/form/CountryCombobox";
import { DocumentUploadBox } from "@/components/mortgage/DocumentUploadBox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const LOQAL_VISA_FEE_USD = 100;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: MortgageProfile;
  onSave: (patch: Partial<MortgageProfile>) => void;
};

export function VisaSupportDialog({ open, onOpenChange, profile, onSave }: Props) {
  const [citizenship, setCitizenship] = useState(profile.citizenship ?? "");
  const [residence, setResidence] = useState(profile.countryOfResidence ?? "");
  const [passports, setPassports] = useState<StoredDocument[]>(profile.passportDocuments ?? []);
  const [editing, setEditing] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const onFile = Boolean(
    profile.citizenship && profile.countryOfResidence && profile.passportDocuments?.length,
  );

  useEffect(() => {
    if (!open) return;
    setCitizenship(profile.citizenship ?? "");
    setResidence(profile.countryOfResidence ?? "");
    setPassports(profile.passportDocuments ?? []);
    setEditing(false);
    setAgreed(false);
  }, [open, profile]);

  const reviewMode = onFile && !editing;
  const complete = Boolean(citizenship && residence && passports.length);

  const submit = () => {
    if (!complete || !agreed) return;
    onSave({
      citizenship,
      countryOfResidence: residence,
      passportDocuments: passports,
      visaSupport: "loqal",
      visaSupportRequestedAt: new Date().toISOString(),
    });
    toast.success("Loqal visa support requested");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Loqal visa support</DialogTitle>
          <DialogDescription>
            {reviewMode
              ? "Please review the details we have on file and confirm they are correct."
              : "Tell us a few details so we can start preparing your US visa application."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 rounded-lg border border-brand/30 bg-brand-tint/40 p-4 text-sm text-foreground">
          <div className="text-xs font-semibold uppercase tracking-wide text-brand">
            How it works
          </div>
          <Step icon={Globe2}>
            We engage a trusted visa partner in your country of residence, who first confirms that
            they can assist with your visa application.
          </Step>
          <Step icon={Handshake}>
            We introduce the partner to you, but Loqal manages all communication and paperwork on
            your behalf. We may occasionally ask you for additional details or documents.
          </Step>
          <Step icon={Landmark}>
            Your only personal commitment is attending the appointment at the US embassy or
            consulate — we take care of the bureaucracy.
          </Step>
          <Step icon={ShieldCheck}>
            Fees are fully transparent: visa partner and consular fees are passed on at cost, plus
            a Loqal support fee of <strong>{LOQAL_VISA_FEE_USD} USD</strong>.
          </Step>
        </div>

        {reviewMode ? (
          <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
            <Row label="Citizenship" value={countryLabel(citizenship)} />
            {profile.secondCitizenship ? (
              <Row label="Second citizenship" value={countryLabel(profile.secondCitizenship)} />
            ) : null}
            <Row label="Country of residence" value={countryLabel(residence)} />
            <Row
              label="Passport copy"
              value={passports
                .map((p) => `${p.name} (${formatDate(p.uploadedAt)})`)
                .join(", ")}
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="pt-1 text-xs font-semibold text-brand hover:underline"
            >
              Something is incorrect — update details
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-xs font-medium text-muted-foreground">
              Citizenship
              <CountryCombobox
                value={citizenship}
                onChange={setCitizenship}
                placeholder="Start typing a country…"
              />
            </label>
            <label className="block text-xs font-medium text-muted-foreground">
              Country of residence
              <CountryCombobox
                value={residence}
                onChange={setResidence}
                placeholder="Start typing a country…"
              />
            </label>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Passport copy</div>
              {passports.length ? (
                <ul className="mb-2 space-y-1 text-sm">
                  {passports.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-1.5"
                    >
                      <span className="truncate">{p.name}</span>
                      <button
                        type="button"
                        onClick={() => setPassports((xs) => xs.filter((x) => x.id !== p.id))}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <DocumentUploadBox
                title="Upload your passport"
                description="The photo page of a valid passport."
                confirmLabel="Attach passport copy"
                onConfirm={(docs) =>
                  setPassports((xs) => [
                    ...xs,
                    ...docs.map((d) => ({
                      id: d.id,
                      name: d.name,
                      url: d.url,
                      uploadedAt: new Date().toISOString(),
                    })),
                  ])
                }
              />
            </div>
          </div>
        )}

        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            {reviewMode ? "I confirm these details are correct and " : "I "}
            agree to the Loqal support fee of {LOQAL_VISA_FEE_USD} USD, in addition to visa
            partner and consular fees.
          </span>
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!complete || !agreed}
            onClick={submit}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
          >
            {reviewMode ? "Confirm and request support" : "Request visa support"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ icon: Icon, children }: { icon: typeof Globe2; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
