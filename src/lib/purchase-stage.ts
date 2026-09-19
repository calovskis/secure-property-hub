/**
 * Where a property purchase stands, in the words used across the platform.
 *
 * The mortgage company needs this at a glance on every file it works:
 *
 *  - "In communication with the realtor" — no purchase price agreed yet;
 *  - "In negotiations with the seller"  — the price is agreed and the terms
 *    are with the seller;
 *  - "Signed purchase agreement"        — the agreement is signed, so the
 *    mortgage company must reconfirm its terms (hard check) and give its
 *    mortgage approval before the agreement's deadline.
 */
import { useMemo } from "react";
import { useEntityPlans, type EntityPlan } from "@/lib/entity-structure";
import { usePropertyRequests, type PurchaseRequest } from "@/lib/property-requests";
import type { AgreementTerms } from "@/lib/purchase-agreement";

export type PurchaseStage = "with_agent" | "with_seller" | "agreement_signed";

export const PURCHASE_STAGE_LABEL: Record<PurchaseStage, string> = {
  with_agent: "In communication with the realtor",
  with_seller: "In negotiations with the seller",
  agreement_signed: "Signed purchase agreement",
};

export const PURCHASE_STAGE_NOTE: Record<PurchaseStage, string> = {
  with_agent: "No purchase price agreed yet.",
  with_seller: "Purchase price agreed — the terms are with the seller.",
  agreement_signed: "Agreement signed — reconfirm your terms and give the mortgage approval.",
};

export const PURCHASE_STAGE_TONE: Record<PurchaseStage, string> = {
  with_agent: "bg-muted text-muted-foreground",
  with_seller: "bg-gold-tint text-gold",
  agreement_signed: "bg-success/10 text-success",
};

const DAY = 24 * 60 * 60 * 1000;

export type PurchaseProgress = {
  stage: PurchaseStage;
  /** The live purchase request on the file, if any. */
  purchase?: PurchaseRequest | undefined;
  /** Price agreed with the buyer's agent. */
  agreedPrice?: number | undefined;
  terms?: AgreementTerms | undefined;
  agreementDoc?: string | undefined;
  signedAt?: string | undefined;
  /** Target closing date from the agreed terms, ISO. */
  closingDate?: string | undefined;
  /** Date by which the mortgage company must give its approval, ISO. */
  approvalDueDate?: string | undefined;
  /** Mortgage company already reconfirmed its terms. */
  hardCheckConfirmedAt?: string | undefined;
  /** The hard check is an open task for the mortgage company. */
  hardCheckOpen: boolean;
};

/** Live purchase on a file — withdrawn ones do not count. */
function livePurchase(purchases: PurchaseRequest[], leadId: string) {
  return purchases
    .filter((p) => p.leadId === leadId && p.status !== "withdrawn")
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

export function purchaseProgress(
  leadId: string,
  purchases: PurchaseRequest[],
  plans: EntityPlan[],
): PurchaseProgress {
  const purchase = livePurchase(purchases, leadId);
  const plan = plans.find((p) => p.leadId === leadId);
  const terms = plan?.proposedTerms as AgreementTerms | undefined;
  const priceAgreed = purchase?.status === "price_supported";
  const signedAt = plan?.agreementSignedAt;
  const stage: PurchaseStage = signedAt
    ? "agreement_signed"
    : priceAgreed
      ? "with_seller"
      : "with_agent";

  /* The agreement gives the buyer a number of days to obtain the mortgage
     commitment — that is the mortgage company's approval deadline. */
  let approvalDueDate: string | undefined;
  if (signedAt && terms) {
    const days = terms.financing ? terms.financingDays : terms.attorneyReviewDays * 5;
    const due = new Date(new Date(signedAt).getTime() + days * DAY);
    const closing = terms.closingDate ? new Date(terms.closingDate) : undefined;
    approvalDueDate = (closing && closing < due ? closing : due).toISOString().slice(0, 10);
  }

  return {
    stage,
    purchase,
    ...(priceAgreed || signedAt ? { agreedPrice: purchase?.offerPrice } : {}),
    ...(terms ? { terms } : {}),
    ...(plan?.agreementDoc ? { agreementDoc: plan.agreementDoc } : {}),
    ...(signedAt ? { signedAt } : {}),
    ...(terms?.closingDate ? { closingDate: terms.closingDate } : {}),
    ...(approvalDueDate ? { approvalDueDate } : {}),
    ...(plan?.hardCheckConfirmedAt ? { hardCheckConfirmedAt: plan.hardCheckConfirmedAt } : {}),
    hardCheckOpen: Boolean(signedAt) && !plan?.hardCheckConfirmedAt,
  };
}

/** Hook version — one reactive read for every file shown on a page. */
export function usePurchaseProgress() {
  const { purchases } = usePropertyRequests();
  const { plans } = useEntityPlans();
  return useMemo(
    () => ({
      purchases,
      plans,
      progressOf: (leadId: string) => purchaseProgress(leadId, purchases, plans),
    }),
    [purchases, plans],
  );
}
