/**
 * Loqal's side of the partnership agreement — the admin counterpart of the
 * partner's signing window.
 *
 * Step 1: both parties side by side — the partner's registered details and
 *         Loqal's own contracting details, plus the Loqal signatory who will
 *         execute the agreement (chosen from the employees allowed to approve
 *         partners).
 * Step 2: the full agreement text as signed by the partner, with a download.
 * Step 3: the electronic countersignature — typed legal name that must match
 *         the selected signatory, an E-SIGN consent and a final confirmation.
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
import { permissionsOf, useStaff } from "@/lib/staff";

const STEP_LABELS = ["The parties", "The agreement", "Countersignature"] as const;

export type LoqalSignatory = { name: string; title: string };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}

export function PartnerCountersignDialog({
  open,
  onOpenChange,
  request,
  onCountersign,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: PartnerRequest;
  onCountersign: (signatory: LoqalSignatory) => void;
}) {
  const { members } = useStaff();
  const agreement = useMemo(() => buildPartnerAgreement(request), [request]);
  const done = !!request.agreementCountersignedAt;

  /** Employees authorised to bind Loqal in partner agreements. */
  const signatories = useMemo<LoqalSignatory[]>(() => {
    const list = members
      .filter((m) => permissionsOf(m).includes("partners.approve"))
      .map((m) => ({ name: m.name, title: m.title }));
    if (!list.some((s) => s.name === LOQAL_PARTY.signatoryName)) {
      list.unshift({ name: LOQAL_PARTY.signatoryName, title: LOQAL_PARTY.signatoryTitle });
    }
    return list;
  }, [members]);

  const [step, setStep] = useState(done ? 2 : 0);
  const [who, setWho] = useState(0);
  const [signature, setSignature] = useState("");
  const [consent, setConsent] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signatory = signatories[who] ?? {
    name: LOQAL_PARTY.signatoryName,
    title: LOQAL_PARTY.signatoryTitle,
  };

  function download() {
    downloadAgreementDoc(agreement.fileBase, executedAgreementText(agreement, request));
  }

  function apply() {
    if (signature.trim().toLowerCase() !== signatory.name.toLowerCase()) {
      setError(`Type the signatory's full legal name exactly: ${signatory.name}.`);
      setConfirming(false);
      return;
    }
    onCountersign({ name: signature.trim(), title: signatory.title });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agreement.title} — Loqal countersignature</DialogTitle>
        </DialogHeader>

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
            <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-xs">
              <p className="font-semibold text-success">Signed by the partner</p>
              <p className="mt-0.5 text-muted-foreground">
                {request.agreementSignedBy || "—"} for {request.companyName}
                {request.agreementSignedAt
                  ? ` · ${formatDateTime(request.agreementSignedAt)}`
                  : ""}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <dl className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                  Partner
                </p>
                {agreement.variables.map((v) => (
                  <Field key={v.label} label={v.label} value={v.value} />
                ))}
              </dl>
              <dl className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                  Loqal
                </p>
                <Field label="Legal name" value={LOQAL_PARTY.legalName} />
                <Field label="Entity type" value={`${LOQAL_PARTY.state} corporation`} />
                <Field label="Principal place of business" value={LOQAL_PARTY.address} />
                <Field label="Governing law / venue" value={LOQAL_PARTY.venue} />
                <div>
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Signatory for Loqal
                  </dt>
                  <dd className="mt-1">
                    {done ? (
                      <p className="text-sm text-foreground">
                        {request.agreementCountersignedBy || LOQAL_PARTY.signatoryName} ·{" "}
                        {request.agreementCountersignedTitle || LOQAL_PARTY.signatoryTitle}
                      </p>
                    ) : (
                      <select
                        value={who}
                        onChange={(e) => {
                          setWho(Number(e.target.value));
                          setSignature("");
                          setError(null);
                        }}
                        className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-brand"
                      >
                        {signatories.map((s, i) => (
                          <option key={s.name} value={i}>
                            {s.name} — {s.title}
                          </option>
                        ))}
                      </select>
                    )}
                  </dd>
                </div>
              </dl>
            </div>

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
                {executedAgreementText(agreement, request)}
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
                  {done ? "Signature record" : "Countersign electronically"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            {done ? (
              <div className="rounded-lg border border-success/40 bg-success/5 p-4 text-sm">
                <p className="font-semibold text-success">Countersigned by Loqal</p>
                <p className="mt-1 text-muted-foreground">
                  {request.agreementCountersignedBy || LOQAL_PARTY.signatoryName},{" "}
                  {request.agreementCountersignedTitle || LOQAL_PARTY.signatoryTitle}, for{" "}
                  {LOQAL_PARTY.legalName} ·{" "}
                  {formatDateTime(request.agreementCountersignedAt as string)}
                </p>
                <p className="mt-1 text-muted-foreground">
                  The partnership with {request.companyName} is fully active.
                </p>
                <button
                  type="button"
                  onClick={download}
                  className="mt-3 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
                >
                  Download the executed agreement
                </button>
              </div>
            ) : confirming ? (
              <div className="rounded-lg border border-gold/40 bg-gold-tint/40 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Confirm the countersignature
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  You are electronically countersigning the {agreement.title} for and on behalf of{" "}
                  <strong className="text-foreground">{LOQAL_PARTY.legalName}</strong> as{" "}
                  <strong className="text-foreground">{signature.trim()}</strong>,{" "}
                  {signatory.title}, binding Loqal to {request.companyName}. This is legally
                  binding and cannot be undone.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={apply}
                    className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
                  >
                    Confirm &amp; countersign
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
                  The typed name, the exact time, the signing account and this document version are
                  stored together as Loqal's signature record.
                </p>
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Type the Loqal signatory's full legal name
                  </span>
                  <input
                    value={signature}
                    onChange={(e) => {
                      setSignature(e.target.value);
                      setError(null);
                    }}
                    placeholder={signatory.name}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 font-serif text-base text-foreground outline-none focus:border-brand"
                  />
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Signing as {signatory.name}, {signatory.title}, for {LOQAL_PARTY.legalName}.
                </p>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  I have reviewed the partner's details and the signed agreement, I am authorised to
                  bind {LOQAL_PARTY.legalName}, and I consent to signing electronically under the
                  U.S. E-SIGN Act.
                </label>
                {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!consent || !signature.trim()}
                    onClick={() => setConfirming(true)}
                    className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
                  >
                    Apply countersignature
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
