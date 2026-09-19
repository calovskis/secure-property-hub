/**
 * The buyer's step after the agent confirms the price. The agent proposes the
 * purchase terms; this compact card on the property file shows where that
 * stands, and the window (PurchaseAgreementWizard) holds the company/entity
 * decision and the buyer's confirmation of the terms.
 */
import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/data/properties";
import { ENTITY_PATH_LABEL, useEntityPlan } from "@/lib/entity-structure";
import { useDeepLinkAction } from "@/lib/deep-link";
import { PurchaseAgreementWizard } from "@/components/buyer/PurchaseAgreementWizard";
import { termsChips, type AgreementTerms } from "@/lib/purchase-agreement";
import type { PurchaseRequest } from "@/lib/property-requests";

const STEP_HINT = ["The company", "The terms"];

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

  const terms = plan?.proposedTerms as AgreementTerms | undefined;
  const proposed = Boolean(plan?.termsProposedAt && terms);
  const confirmed = Boolean(plan?.termsConfirmedAt);
  const changeAsked = Boolean(plan?.termsChangeRequestedAt) && !confirmed;
  const step = plan?.path ? 2 : 1;

  return (
    <section
      id="purchase-agreement"
      className="mt-4 scroll-mt-24 rounded-lg border border-success/40 bg-success/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
          Your price is agreed — purchase terms
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
        {confirmed ? (
          <>
            <p className="text-sm font-semibold text-success">
              Terms confirmed {formatDateTime(plan!.termsConfirmedAt!)} — {agentName} is putting them
              to the seller.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {plan?.path ? `${ENTITY_PATH_LABEL[plan.path]}. ` : ""}The seller can confirm or come
              back with their own suggestions. Once the terms are mutually agreed, {agentName}{" "}
              uploads the purchase agreement for your review and signing.
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
              {changeAsked
                ? `${agentName} is adjusting the terms you asked about — you will be notified when they arrive.`
                : proposed
                  ? `${agentName} proposed the terms for the seller — your confirmation is needed before they go out.`
                  : step === 1
                    ? `Tell us how the property will be held. ${agentName} is preparing the terms to propose to the seller.`
                    : `${agentName} is preparing the terms to propose to the seller — you confirm them here.`}
            </p>
            {proposed && !changeAsked ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {termsChips(purchase.offerPrice, terms!)
                  .slice(0, 5)
                  .map((c) => (
                    <li
                      key={c}
                      className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand"
                    >
                      {c}
                    </li>
                  ))}
              </ul>
            ) : null}
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
        >
          {confirmed
            ? "View the confirmed terms"
            : proposed && !changeAsked
              ? "Review and confirm the terms"
              : "Continue"}
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
