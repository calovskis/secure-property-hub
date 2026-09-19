/**
 * Partner-side view of the Loqal partnership agreement. Once Loqal approves a
 * partner registration, the partner opens the signing pop-up here: the full
 * agreement — generated from their own registration details — can be read and
 * downloaded, and is then signed electronically inside the portal. Loqal
 * countersigns in the admin console and the partnership becomes fully active.
 */
import { useEffect, useRef, useState } from "react";
import type { LoqalUser } from "@/lib/auth";
import { usePartnerRequests } from "@/lib/partner-requests";
import { logActivity } from "@/lib/activity";
import { formatDateTime } from "@/lib/dates";
import { useDeepLink } from "@/lib/deep-link";
import { PartnerAgreementDialog } from "@/components/profile/PartnerAgreementDialog";
import {
  buildPartnerAgreement,
  downloadAgreementDoc,
  executedAgreementText,
} from "@/lib/partner-agreement";

const STEPS = [
  "Registration submitted",
  "Approved by Loqal",
  "Partner signs the agreement",
  "Loqal countersigns — partnership active",
] as const;

export function AgreementCard({ user }: { user: LoqalUser }) {
  const { requests, updateRequest } = usePartnerRequests();
  const [signing, setSigning] = useState(false);

  const ref = useRef<HTMLElement>(null);
  const { open: openParam } = useDeepLink();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());

  // "Your agreement is ready to sign" notifications land on the signing window.
  useEffect(() => {
    if (openParam !== "agreement" || !request) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (request.status === "approved" && !request.agreementSignedAt) setSigning(true);
  }, [openParam, request]);

  if (!request) return null;

  const stepIndex = request.agreementCountersignedAt
    ? 3
    : request.agreementSignedAt
      ? 2
      : request.status === "approved"
        ? 1
        : 0;

  function sign(signature: string) {
    if (!request) return;
    const now = new Date().toISOString();
    updateRequest(request.id, { agreementSignedAt: now, agreementSignedBy: signature });
    logActivity(signature, `signed the Loqal partnership agreement`, request.companyName);
  }

  function downloadSigned() {
    if (!request) return;
    const agreement = buildPartnerAgreement(request);
    downloadAgreementDoc(agreement.fileBase, executedAgreementText(agreement, request));
  }


  return (
    <section ref={ref} className="rounded-lg border border-border bg-card p-6">
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

      {request.status === "approved" && !request.agreementSignedAt ? (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            Your registration was approved. Open the agreement — it is already filled in with your
            company details — read or download it, and sign it electronically here. Loqal
            countersigns right after.
          </p>
          <button
            type="button"
            onClick={() => setSigning(true)}
            className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            Review &amp; sign the agreement
          </button>
        </div>
      ) : null}

      {request.agreementSignedAt ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSigning(true)}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
          >
            Open the agreement
          </button>
          <button
            type="button"
            onClick={downloadSigned}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
          >
            Download the signed agreement
          </button>
        </div>
      ) : null}

      {request.agreementSignedAt && !request.agreementCountersignedAt ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Signed on {formatDateTime(request.agreementSignedAt)}. Loqal countersigns shortly — you
          will be notified when the partnership is fully active.
        </p>
      ) : null}

      <PartnerAgreementDialog
        open={signing}
        onOpenChange={setSigning}
        request={request}
        onSign={sign}
      />
    </section>
  );
}

