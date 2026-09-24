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
export type PossessionMode = "at_closing" | "by_agreement" | "seller_rent_back";
export type HomeWarrantyMode = "none" | "seller" | "buyer";

/** The commercial terms the agent proposes and the buyer confirms. */
export type AgreementTerms = {
  /** Earnest money as a share of the price. */
  depositPct: number;
  /** Business days after signing to pay the deposit. */
  depositDays: number;
  /** Target closing date, ISO. */
  closingDate: string;
  possession: PossessionMode;
  attorneyReviewDays: number;
  paymentMode: PaymentMode;
  inspection: boolean;
  inspectionDays: number;
  appraisal: boolean;
  financing: boolean;
  financingDays: number;
  assignable: boolean;
  titleReview: boolean;
  surveyReview: boolean;
  dueDiligenceReview: boolean;
  inspectionDeadline: string;
  appraisalDeadline: string;
  mortgageSubmissionDeadline: string;
  finalLoanApprovalDeadline: string;
  titleObjectionDeadline: string;
  agreementExpiresAt: string;
  /** Buyer's broker commission, paid by the seller by default. */
  commissionPct: number;
  includedItems: string;
  excludedItems: string;
  sellerConcessions: string;
  homeWarranty: HomeWarrantyMode;
  closingCostsAllocation: string;
  prorationsNote: string;
  specialTerms: string;
};

const isoAfter = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export function defaultTerms(financed: boolean): AgreementTerms {
  return {
    depositPct: 10,
    depositDays: 5,
    closingDate: isoAfter(60),
    possession: "at_closing",
    attorneyReviewDays: 3,
    paymentMode: financed ? "financed" : "cash",
    inspection: true,
    inspectionDays: 12,
    appraisal: financed,
    financing: financed,
    financingDays: 45,
    assignable: false,
    titleReview: true,
    surveyReview: false,
    dueDiligenceReview: true,
    inspectionDeadline: isoAfter(14),
    appraisalDeadline: isoAfter(21),
    mortgageSubmissionDeadline: isoAfter(10),
    finalLoanApprovalDeadline: isoAfter(45),
    titleObjectionDeadline: isoAfter(21),
    agreementExpiresAt: isoAfter(3),
    commissionPct: 3,
    includedItems: "all fixtures, permanently attached systems, kitchen appliances and HVAC",
    excludedItems: "none",
    sellerConcessions: "None",
    homeWarranty: "none",
    closingCostsAllocation: "Each party pays its customary closing costs",
    prorationsNote: "Taxes, HOA, rents and utilities prorated at closing",
    specialTerms: "",
  };
}

/** Fills newer fields when opening terms saved by an earlier app version. */
export function completeTerms(saved?: Partial<AgreementTerms>, financed = true): AgreementTerms {
  return { ...defaultTerms(financed), ...(saved ?? {}) };
}

export const PAYMENT_LABEL: Record<PaymentMode, string> = {
  financed: "Financed with a mortgage",
  cash: "All-cash purchase",
  seller_finance: "Part seller financing",
};

export const POSSESSION_LABEL: Record<PossessionMode, string> = {
  at_closing: "At closing",
  by_agreement: "After closing by agreement",
  seller_rent_back: "Seller rent-back",
};

export const HOME_WARRANTY_LABEL: Record<HomeWarrantyMode, string> = {
  none: "Not included",
  seller: "Seller to provide",
  buyer: "Buyer to purchase",
};

/** Plain-language lines describing the proposed terms, shown to both sides. */
export function termsSummary(price: number, t: AgreementTerms): { label: string; value: string }[] {
  const terms = completeTerms(t, t.paymentMode === "financed");
  const deposit = Math.round((price * t.depositPct) / 100);
  return [
    { label: "Purchase price", value: formatPrice(Math.round(price)) },
    {
      label: "Deposit (earnest money)",
      value: `${formatPrice(deposit)} (${terms.depositPct}%), paid within ${terms.depositDays} business days and held in escrow`,
    },
    { label: "Target closing date", value: formatDate(terms.closingDate) },
    { label: "Possession / key handover", value: POSSESSION_LABEL[terms.possession] },
    { label: "How the purchase is paid", value: PAYMENT_LABEL[terms.paymentMode] },
    {
      label: "Attorney review",
      value: `${terms.attorneyReviewDays} business days for each side's attorney`,
    },
    {
      label: "Inspection protection",
      value: terms.inspection
        ? `Included — through ${formatDate(terms.inspectionDeadline)}, with the right to ask for repairs or walk away`
        : "Not included — the property is taken as is",
    },
    {
      label: "Appraisal protection",
      value: terms.appraisal
        ? `Included — appraisal due ${formatDate(terms.appraisalDeadline)}`
        : "Not included",
    },
    {
      label: "Financing protection",
      value: terms.financing
        ? `Included — submit by ${formatDate(terms.mortgageSubmissionDeadline)}; final approval by ${formatDate(terms.finalLoanApprovalDeadline)}`
        : "Not included",
    },
    { label: "Title and lien review", value: terms.titleReview ? `Included — objections by ${formatDate(terms.titleObjectionDeadline)}` : "Not included" },
    { label: "Survey / boundary review", value: terms.surveyReview ? "Included" : "Not included" },
    { label: "Due diligence / HOA review", value: terms.dueDiligenceReview ? "Included" : "Not included" },
    {
      label: "Right to transfer the purchase",
      value: terms.assignable
        ? "Yes — the purchase can be transferred to your company or another buyer"
        : "No",
    },
    {
      label: "Buyer's agent commission",
      value: `${terms.commissionPct}% of the price, paid by the seller`,
    },
    { label: "Included with the property", value: terms.includedItems || "as listed" },
    { label: "Excluded from the sale", value: terms.excludedItems || "none" },
    { label: "Seller concessions / credits", value: terms.sellerConcessions || "None" },
    { label: "Home warranty", value: HOME_WARRANTY_LABEL[terms.homeWarranty] },
    { label: "Closing costs", value: terms.closingCostsAllocation || "As customary" },
    { label: "Prorations and adjustments", value: terms.prorationsNote || "As agreed at closing" },
    { label: "Offer expires", value: formatDate(terms.agreementExpiresAt) },
    ...(terms.specialTerms ? [{ label: "Special terms and disclosures", value: terms.specialTerms }] : []),
  ];
}

/** One-line chips for compact places (cards, timelines). */
export function termsChips(price: number, t: AgreementTerms): string[] {
  const terms = completeTerms(t, t.paymentMode === "financed");
  return [
    `Deposit ${terms.depositPct}%`,
    `Closing ${formatDate(terms.closingDate)}`,
    PAYMENT_LABEL[terms.paymentMode],
    terms.inspection ? "Inspection protection" : "No inspection protection",
    terms.appraisal ? "Appraisal protection" : "No appraisal protection",
    terms.financing ? "Financing protection" : "No financing protection",
    `Commission ${terms.commissionPct}%`,
    formatPrice(Math.round(price)),
  ];
}
