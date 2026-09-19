/**
 * Purchase terms proposed by the buyer's agent.
 *
 * Loqal does not draft the agreement text itself. The buyer's agent chooses the
 * commercial terms (deposit, closing date, how the purchase is paid, the
 * protections to keep, the commission) and sends them to the buyer for
 * confirmation. Only once the buyer confirms does the agent put those terms to
 * the seller. When both sides agree, the agent uploads the actual purchase
 * agreement for review and signing.
 */
import { formatPrice } from "@/data/properties";
import { formatDate } from "@/lib/dates";

export type PaymentMode = "cash" | "financed" | "seller_finance";

/** The commercial terms the agent proposes and the buyer confirms. */
export type AgreementTerms = {
  /** Earnest money as a share of the price. */
  depositPct: number;
  /** Business days after signing to pay the deposit. */
  depositDays: number;
  /** Target closing date, ISO. */
  closingDate: string;
  attorneyReviewDays: number;
  paymentMode: PaymentMode;
  inspection: boolean;
  inspectionDays: number;
  appraisal: boolean;
  financing: boolean;
  financingDays: number;
  assignable: boolean;
  /** Buyer's broker commission, paid by the seller by default. */
  commissionPct: number;
  includedItems: string;
  excludedItems: string;
};

export function defaultTerms(financed: boolean): AgreementTerms {
  const closing = new Date();
  closing.setDate(closing.getDate() + 60);
  return {
    depositPct: 10,
    depositDays: 5,
    closingDate: closing.toISOString().slice(0, 10),
    attorneyReviewDays: 3,
    paymentMode: financed ? "financed" : "cash",
    inspection: true,
    inspectionDays: 12,
    appraisal: financed,
    financing: financed,
    financingDays: 45,
    assignable: false,
    commissionPct: 3,
    includedItems: "all fixtures, permanently attached systems, kitchen appliances and HVAC",
    excludedItems: "none",
  };
}

export const PAYMENT_LABEL: Record<PaymentMode, string> = {
  financed: "Financed with a mortgage",
  cash: "All-cash purchase",
  seller_finance: "Part seller financing",
};

/** Plain-language lines describing the proposed terms, shown to both sides. */
export function termsSummary(price: number, t: AgreementTerms): { label: string; value: string }[] {
  const deposit = Math.round((price * t.depositPct) / 100);
  return [
    { label: "Purchase price", value: formatPrice(Math.round(price)) },
    {
      label: "Deposit (earnest money)",
      value: `${formatPrice(deposit)} (${t.depositPct}%), paid within ${t.depositDays} business days and held in escrow`,
    },
    { label: "Target closing date", value: formatDate(t.closingDate) },
    { label: "How the purchase is paid", value: PAYMENT_LABEL[t.paymentMode] },
    {
      label: "Attorney review",
      value: `${t.attorneyReviewDays} business days for each side's attorney`,
    },
    {
      label: "Inspection protection",
      value: t.inspection
        ? `Included — ${t.inspectionDays} days to inspect, with the right to ask for repairs or walk away`
        : "Not included — the property is taken as is",
    },
    {
      label: "Appraisal protection",
      value: t.appraisal
        ? "Included — protection if the property is valued below the agreed price"
        : "Not included",
    },
    {
      label: "Financing protection",
      value: t.financing
        ? `Included — ${t.financingDays} days to obtain the mortgage commitment`
        : "Not included",
    },
    {
      label: "Right to transfer the purchase",
      value: t.assignable
        ? "Yes — the purchase can be transferred to your company or another buyer"
        : "No",
    },
    {
      label: "Buyer's agent commission",
      value: `${t.commissionPct}% of the price, paid by the seller`,
    },
    { label: "Included with the property", value: t.includedItems || "as listed" },
    { label: "Excluded from the sale", value: t.excludedItems || "none" },
  ];
}

/** One-line chips for compact places (cards, timelines). */
export function termsChips(price: number, t: AgreementTerms): string[] {
  return [
    `Deposit ${t.depositPct}%`,
    `Closing ${formatDate(t.closingDate)}`,
    PAYMENT_LABEL[t.paymentMode],
    t.inspection ? "Inspection protection" : "No inspection protection",
    t.appraisal ? "Appraisal protection" : "No appraisal protection",
    t.financing ? "Financing protection" : "No financing protection",
    `Commission ${t.commissionPct}%`,
    formatPrice(Math.round(price)),
  ];
}
