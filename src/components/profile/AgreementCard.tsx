/**
 * Partner-side view of the Loqal partnership agreement. Once Loqal approves
 * a partner registration, the partner signs here (typed-name signature with a
 * confirmation step); Loqal then countersigns in the admin console and the
 * partnership becomes fully active.
 */
import { useState } from "react";
import { fullName, type LoqalUser } from "@/lib/auth";
import { usePartnerRequests } from "@/lib/partner-requests";
import { logActivity } from "@/lib/activity";
import { formatDateTime } from "@/lib/dates";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

const STEPS = [
  "Registration submitted",
  "Approved by Loqal",
  "Partner signs the agreement",
  "Loqal countersigns — partnership active",
] as const;

export function AgreementCard({ user }: { user: LoqalUser }) {
  const { requests, updateRequest } = usePartnerRequests();
  const [signing, setSigning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [signature, setSignature] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  if (!request) return null;

  const stepIndex = request.agreementCountersignedAt
    ? 3
    : request.agreementSignedAt
      ? 2
      : request.status === "approved"
        ? 1
        : 0;

  function sign() {
    if (!request) return;
    if (signature.trim().toLowerCase() !== fullName(user).toLowerCase()) {
      setError(`Type your full legal name exactly as registered: ${fullName(user)}.`);
      return;
    }
    const now = new Date().toISOString();
    updateRequest(request.id, { agreementSignedAt: now, agreementSignedBy: signature.trim() });
    logActivity(signature.trim(), `signed the Loqal partnership agreement`, request.companyName);
    setSigning(false);
    setConfirming(false);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Loqal partnership agreement</h2>
        {request.agreementCountersignedAt ? (
          <span className="rounded-full bg-success/10 px-3 py-1 text-[11px] font-semibold text-success">
            Fully active
          </span>
        ) : request.status === "approved" ? (
          <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
            {request.agreementSignedAt ? "Awaiting Loqal countersignature" : "Signature required"}
          </span>
        ) : (
          <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
            {request.status === "pending" ? "Available after approval" : "Registration declined"}
          </span>
        )}
      </div>

      {/* progress */}
      <ol className="mt-4 space-y-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2.5 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                i <= stepIndex && !(i === 3 && !request.agreementCountersignedAt)
                  ? i < stepIndex ||
                    (i === 1 && request.agreementSignedAt) ||
                    (i === 2 && request.agreementCountersignedAt) ||
                    i === 3
                    ? "bg-success/15 text-success"
                    : "bg-brand-tint text-brand"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < stepIndex ||
              (i === 1 && !!request.agreementSignedAt) ||
              (i === 2 && !!request.agreementCountersignedAt) ||
              i === 3
                ? "✓"
                : i + 1}
            </span>
            <span className={i <= stepIndex ? "text-foreground" : "text-muted-foreground"}>
              {label}
              {i === 2 && request.agreementSignedAt
                ? ` — ${request.agreementSignedBy} · ${formatDateTime(request.agreementSignedAt)}`
                : ""}
              {i === 3 && request.agreementCountersignedAt
                ? ` — ${formatDateTime(request.agreementCountersignedAt)}`
                : ""}
            </span>
          </li>
        ))}
      </ol>

      {request.status === "approved" && !request.agreementSignedAt && !signing ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Your registration was approved. Sign the partnership agreement to activate your
            workspace — Loqal countersigns right after.
          </p>
          <button
            type="button"
            onClick={() => setSigning(true)}
            className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            Review & sign the agreement
          </button>
        </div>
      ) : null}

      {signing && !confirming ? (
        <div className="mt-4 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Key terms</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>You act as an independent contractor for clients routed through Loqal.</li>
            <li>Buyer's agent engagements: 3% of the purchase price, payable at closing.</li>
            <li>Loqal platform fee: 20% of the agent commission (invoiced per file).</li>
            <li>Mortgage lenders: $250 platform fee per originated pre-approval.</li>
            <li>Licenses must stay valid; updates are due before expiry.</li>
            <li>Either party may terminate with 30 days written notice.</li>
          </ul>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Type your full legal name as signature
            </span>
            <input
              value={signature}
              onChange={(e) => {
                setSignature(e.target.value);
                setError(null);
              }}
              placeholder={fullName(user)}
              className={inputClass}
            />
          </label>
          <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            I have read and agree to the Loqal partnership terms and the partner T&amp;C I accepted
            at registration.
          </label>
          {error ? <p className="mt-2 text-xs font-semibold text-destructive">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={!agreed || !signature.trim()}
              onClick={() => setConfirming(true)}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
            >
              Sign agreement
            </button>
            <button
              type="button"
              onClick={() => setSigning(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold-tint/40 p-4">
          <h3 className="text-sm font-semibold text-foreground">Confirm your signature</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            You are signing the Loqal partnership agreement for{" "}
            <strong className="text-foreground">{request.companyName}</strong> as{" "}
            <strong className="text-foreground">{signature.trim()}</strong>. This is legally
            binding and cannot be undone.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={sign}
              className="rounded-md bg-success px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
            >
              Confirm & sign
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
      ) : null}

      {request.agreementSignedAt && !request.agreementCountersignedAt ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Signed on {formatDateTime(request.agreementSignedAt)}. Loqal countersigns shortly — you
          will be notified when the partnership is fully active.
        </p>
      ) : null}
    </section>
  );
}
