/**
 * Partner agreement signing pop-up — the partner equivalent of the buyer's
 * purchase-agreement window.
 *
 * Step 1: the parties and every variable filled in from the partner's own
 *         registration (legal name, entity type, registration number,
 *         signatory, licences).
 * Step 2: the full agreement text, with a download of the same document.
 * Step 3: the electronic signature — typed legal name that must match the
 *         registered signatory, an explicit E-SIGN consent, then a final
 *         confirmation before the signature is applied.
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/dates";
import {
  buildPartnerAgreement,
  downloadAgreementDoc,
  executedAgreementText,
  LOQAL_PARTY,
} from "@/lib/partner-agreement";
import type { PartnerRequest } from "@/lib/partner-requests";

const STEP_LABELS = ["The parties", "The agreement", "Electronic signature"] as const;

export function PartnerAgreementDialog({
  open,
  onOpenChange,
  request,
  onSign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: PartnerRequest;
  onSign: (signature: string) => void;
}) {
  const agreement = useMemo(() => buildPartnerAgreement(request), [request]);
  const signed = !!request.agreementSignedAt;

  const [step, setStep] = useState(signed ? 2 : 0);
  const [signature, setSignature] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expected = `${request.firstName} ${request.lastName}`.trim();

  function download() {
    downloadAgreementDoc(
      agreement.fileBase,
      signed ? executedAgreementText(agreement, request) : agreement.body,
    );
  }

  function apply() {
    if (signature.trim().toLowerCase() !== expected.toLowerCase()) {
      setError(`Type the registered signatory's full legal name exactly: ${expected}.`);
      setConfirming(false);
      return;
    }
    onSign(signature.trim());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agreement.title}</DialogTitle>
        </DialogHeader>

        {/* steps */}
        <div className="flex flex-wrap gap-2">
          {STEP_LABELS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(i)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                i === step
                  ? "bg-brand text-background"
                  : i < step
                    ? "bg-success/10 text-success"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {step === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Everything below is taken from your Loqal registration and written into the
              agreement automatically. If something is wrong, request a correction in My Profile
              before signing — company and name changes are approved by Loqal.
            </p>
            <dl className="grid gap-x-6 gap-y-3 rounded-lg border border-border p-4 sm:grid-cols-2">
              {agreement.variables.map((v) => (
                <div key={v.label}>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {v.label}
                  </dt>
                  <dd className="text-sm text-foreground">{v.value || "—"}</dd>
                </div>
              ))}
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Counterparty
                </dt>
                <dd className="text-sm text-foreground">
                  {LOQAL_PARTY.legalName} — {LOQAL_PARTY.signatoryName},{" "}
                  {LOQAL_PARTY.signatoryTitle}
                </dd>
              </div>
            </dl>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
              >
                Read the agreement
              </button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="max-h-[52vh] overflow-y-auto rounded-lg border border-border bg-background p-4">
              <pre className="whitespace-pre-wrap font-serif text-[12.5px] leading-relaxed text-foreground">
                {agreement.body}
              </pre>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={download}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
              >
                Download the agreement
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
                >
                  {signed ? "Signature details" : "Sign electronically"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            {signed ? (
              <div className="rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
                <p className="font-semibold text-success">Signed electronically</p>
                <p className="mt-1 text-muted-foreground">
                  {request.agreementSignedBy} for {request.companyName} ·{" "}
                  {formatDateTime(request.agreementSignedAt as string)}
                </p>
                <p className="mt-2 text-muted-foreground">
                  {request.agreementCountersignedAt
                    ? `Countersigned by Loqal on ${formatDateTime(request.agreementCountersignedAt)} — the partnership is fully active.`
                    : "Loqal countersigns shortly — you will be notified when the partnership is fully active."}
                </p>
                <button
                  type="button"
                  onClick={download}
                  className="mt-3 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
                >
                  Download the signed agreement
                </button>
              </div>
            ) : confirming ? (
              <div className="rounded-lg border border-gold/40 bg-gold-tint/40 p-4">
                <h3 className="text-sm font-semibold text-foreground">Confirm your signature</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  You are electronically signing the {agreement.title} on behalf of{" "}
                  <strong className="text-foreground">{request.companyName}</strong> as{" "}
                  <strong className="text-foreground">{signature.trim()}</strong>,{" "}
                  {request.position || "authorized representative"}. This is legally binding and
                  cannot be undone.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={apply}
                    className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
                  >
                    Confirm &amp; sign
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-xs text-muted-foreground">
                  Signing happens inside the Loqal portal. Your typed name, the exact time, your
                  account and this document version are stored together as the signature record.
                </p>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Type the signatory's full legal name
                  </span>
                  <input
                    value={signature}
                    onChange={(e) => {
                      setSignature(e.target.value);
                      setError(null);
                    }}
                    placeholder={expected}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-serif text-base text-foreground outline-none focus:border-brand"
                  />
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Signing as {expected}
                  {request.position ? `, ${request.position}` : ""}, for {request.companyName}.
                </p>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  I have read the full agreement, I am authorized to bind {request.companyName},
                  and I consent to signing electronically under the U.S. E-SIGN Act.
                </label>
                {error ? (
                  <p className="text-xs font-semibold text-destructive">{error}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!consent || !signature.trim()}
                    onClick={() => setConfirming(true)}
                    className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
                  >
                    Apply electronic signature
                  </button>
                  <button
                    type="button"
                    onClick={download}
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
                  >
                    Download the agreement
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
