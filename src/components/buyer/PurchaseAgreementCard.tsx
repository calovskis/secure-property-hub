/**
 * The buyer's step after the agent confirms the price and takes it to the
 * seller. This is the compact card on the property file; the actual work —
 * the company/entity decision, the agreement draft and the e-signature — happens
 * in the stepped signing window (PurchaseAgreementWizard), the same way the
 * mortgage application works.
 */
import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/data/properties";
import { ENTITY_PATH_LABEL, useEntityPlan } from "@/lib/entity-structure";
import { useDeepLinkAction } from "@/lib/deep-link";
import { PurchaseAgreementWizard } from "@/components/buyer/PurchaseAgreementWizard";
import type { PurchaseRequest } from "@/lib/property-requests";

const STEP_HINT = ["The company", "The agreement", "Signature"];

export function PurchaseAgreementCard({
  leadId,
  purchase,
  usPerson,
  agentName,
  agentEmail,
  clientLabel,
}: {
  leadId: string;
  purchase: PurchaseRequest;
  usPerson: boolean;
  agentName: string;
  agentEmail?: string | undefined;
  /** Privacy-safe label of the buyer used in partner/admin notifications. */
  clientLabel: string;
}) {
  const { plan } = useEntityPlan(leadId);
  const [open, setOpen] = useState(false);

  // "Your price is confirmed" notifications and cards land straight in here.
  useDeepLinkAction("agreement", () => setOpen(true));

  const signed = Boolean(plan?.agreementSignedAt);
  const step = signed ? 3 : plan?.path ? 2 : 1;

  return (
    <section
      id="purchase-agreement"
      className="mt-4 scroll-mt-24 rounded-lg border border-success/40 bg-success/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
          Your price is agreed — purchase agreement
        </h4>
        <span className="rounded-full bg-success/15 px-3 py-1 text-[11px] font-semibold text-success">
          {formatPrice(purchase.offerPrice)} going to the seller
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {agentName} confirmed {formatPrice(purchase.offerPrice)} for {purchase.propertyLabel}
        {purchase.respondedAt ? ` (${formatDateTime(purchase.respondedAt)})` : ""}.
        {purchase.agentNote ? ` ${agentName}: ${purchase.agentNote}` : ""}
      </p>

      <div className="mt-3 rounded-lg border border-border bg-background p-4">
        {signed ? (
          <>
            <p className="text-sm font-semibold text-success">
              Signed {formatDateTime(plan!.agreementSignedAt!)} — {agentName} is presenting the
              agreement to the seller.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {plan?.path ? `${ENTITY_PATH_LABEL[plan.path]}. ` : ""}The seller may accept, propose
              a lower price, or ask to adjust terms — you decide before anything changes.
            </p>
          </>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              {STEP_HINT.map((title, i) => (
                <span
                  key={title}
                  className={`rounded px-2 py-1 text-[11px] font-semibold ${
                    i + 1 === step
                      ? "bg-brand-tint text-brand"
                      : i + 1 < step
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1 < step ? "✓ " : ""}
                  {i + 1}. {title}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {step === 1
                ? "Three steps: tell us how the property will be held, review the agreement, then sign it."
                : "Pick up where you left off — review the agreement and sign it."}
            </p>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
        >
          {signed ? "View the signed agreement" : step === 1 ? "Start signing" : "Continue signing"}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <PurchaseAgreementWizard
        open={open}
        onOpenChange={setOpen}
        leadId={leadId}
        purchase={purchase}
        usPerson={usPerson}
        agentName={agentName}
        agentEmail={agentEmail}
        clientLabel={clientLabel}
      />
    </section>
  );
}
