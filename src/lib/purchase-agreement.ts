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
export type CommissionPayer = "seller" | "buyer" | "split";
export type DepositMode = "pct" | "custom";

/**
 * States where an attorney customarily handles or reviews the purchase
 * (attorney closing / attorney review states). Elsewhere attorney review
 * is not part of the terms.
 */
export const ATTORNEY_STATES = ["CT", "DE", "DC", "GA", "MA", "NJ", "NY", "NC", "SC", "WV"] as const;
export function isAttorneyState(code?: string | null) {
  return Boolean(code && (ATTORNEY_STATES as readonly string[]).includes(code.toUpperCase()));
}
/** Two-letter state from a "City, ST" location. */
export function stateFromLocation(location?: string) {
  const m = location?.match(/,\s*([A-Z]{2})\b/);
  return m?.[1];
}

export type PropertyCategory = "house" | "condo" | "multi_family" | "commercial" | "industrial" | "land";
export const PROPERTY_CATEGORY_LABEL: Record<PropertyCategory, string> = {
  house: "House", condo: "Apartment / condo", multi_family: "Multi-family", commercial: "Commercial (retail, office, garage)", industrial: "Industrial / warehouse", land: "Land",
};
export function propertyCategory(type?: string): PropertyCategory {
  const t = (type ?? "").toLowerCase();
  if (t.includes("land") || t.includes("lot")) return "land";
  if (t.includes("industrial") || t.includes("warehouse")) return "industrial";
  if (t.includes("commercial") || t.includes("retail") || t.includes("office") || t.includes("garage") || t.includes("mall")) return "commercial";
  if (t.includes("multi")) return "multi_family";
  if (t.includes("condo") || t.includes("apartment")) return "condo";
  return "house";
}

/** Inspection types that apply to each kind of property. */
export const INSPECTION_TYPES: Record<PropertyCategory, string[]> = {
  house: ["General home inspection", "Wood-destroying insects / termite", "Roof", "Radon", "Mold", "Sewer line (camera scope)", "HVAC", "Electrical", "Plumbing", "Foundation / structural", "Chimney", "Well water & septic", "Pool / spa", "Lead-based paint (pre-1978)"],
  condo: ["Unit interior inspection", "HVAC", "Electrical", "Plumbing", "Mold", "Radon", "Termite / pests", "Association documents & building condition", "Lead-based paint (pre-1978)"],
  multi_family: ["General inspection of all units", "Roof", "Foundation / structural", "HVAC", "Electrical", "Plumbing", "Sewer line", "Termite / pests", "Fire & life safety", "Code compliance / permits", "Rent roll & lease audit", "Mold", "Lead-based paint (pre-1978)"],
  commercial: ["Property condition assessment (PCA)", "Phase I environmental site assessment", "Roof", "HVAC / mechanical", "Electrical", "Plumbing", "Structural / parking structure", "ADA accessibility", "Fire & life safety", "Zoning & code compliance", "Elevators / escalators", "Asbestos survey"],
  industrial: ["Property condition assessment (PCA)", "Phase I environmental site assessment", "Phase II environmental (soil / groundwater)", "Roof", "Structural / slab", "Electrical capacity", "Fire suppression", "Loading docks & doors", "Zoning & code compliance", "Asbestos survey"],
  land: ["Land survey / boundary", "Soil / percolation test", "Phase I environmental site assessment", "Wetlands / flood zone", "Zoning & permitted use", "Utilities & access", "Topography"],
};

/** The commercial terms the agent proposes and the buyer confirms. */
export type AgreementTerms = {
  /** Earnest money as a share of the price. */
  depositPct: number;
  depositMode: DepositMode;
  /** Custom earnest money in USD when depositMode is "custom". */
  depositAmount: number;
  /** Whether the property is in an attorney state (attorney review applies). */
  attorneyApplicable: boolean;
  inspectionTypes: string[];
  /** Deadlines, in days from signing the agreement. */
  inspectionDeadlineDays: number;
  appraisalDeadlineDays: number;
  mortgageSubmissionDays: number;
  finalLoanApprovalDays: number;
  offerExpiresDays: number;
  commissionPayer: CommissionPayer;
  /** Share of the commission the seller pays when split, in %. */
  commissionSellerSharePct: number;
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
    depositMode: "pct",
    depositAmount: 0,
    attorneyApplicable: true,
    inspectionTypes: [],
    inspectionDeadlineDays: 14,
    appraisalDeadlineDays: 21,
    mortgageSubmissionDays: 10,
    finalLoanApprovalDays: 45,
    offerExpiresDays: 3,
    commissionPayer: "seller",
    commissionSellerSharePct: 50,
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

export function depositAmount(price: number, t: AgreementTerms) {
  return t.depositMode === "custom" ? Math.round(t.depositAmount || 0) : Math.round((price * t.depositPct) / 100);
}

export function commissionText(t: AgreementTerms) {
  if (t.commissionPayer === "buyer") return `${t.commissionPct}% of the price, paid by the buyer`;
  if (t.commissionPayer === "split") return `${t.commissionPct}% of the price, split — seller ${t.commissionSellerSharePct}% / buyer ${100 - t.commissionSellerSharePct}%`;
  return `${t.commissionPct}% of the price, paid by the seller`;
}

const days = (n: number) => `${n} day${n === 1 ? "" : "s"} from signing the agreement`;

/** Plain-language lines describing the proposed terms, shown to both sides. */
export function termsSummary(price: number, t: AgreementTerms): { label: string; value: string }[] {
  const terms = completeTerms(t, t.paymentMode === "financed");
  const deposit = depositAmount(price, terms);
  return [
    { label: "Purchase price", value: formatPrice(Math.round(price)) },
    {
      label: "Deposit (earnest money)",
      value: `${formatPrice(deposit)}${terms.depositMode === "custom" ? " (custom amount)" : ` (${terms.depositPct}%)`}, paid within ${terms.depositDays} business days and held in escrow`,
    },
    { label: "Target closing date", value: formatDate(terms.closingDate) },
    { label: "Possession / key handover", value: POSSESSION_LABEL[terms.possession] },
    { label: "How the purchase is paid", value: PAYMENT_LABEL[terms.paymentMode] },
    ...(terms.attorneyApplicable ? [{ label: "Attorney review", value: `${terms.attorneyReviewDays} business days for each side's attorney` }] : []),
    {
      label: "Inspection protection",
      value: terms.inspection
        ? `Included — within ${days(terms.inspectionDeadlineDays)}${terms.inspectionTypes.length ? `: ${terms.inspectionTypes.join(", ")}` : ""}`
        : "Not included — the property is taken as is",
    },
    { label: "Appraisal protection", value: terms.appraisal ? `Included — appraisal within ${days(terms.appraisalDeadlineDays)}` : "Not included" },
    {
      label: "Financing protection",
      value: terms.financing
        ? `Included — mortgage submitted within ${days(terms.mortgageSubmissionDays)}; final approval within ${days(terms.finalLoanApprovalDays)}`
        : "Not included",
    },
    { label: "Buyer's agent commission", value: commissionText(terms) },
    { label: "Included with the property", value: terms.includedItems || "as listed" },
    { label: "Excluded from the sale", value: terms.excludedItems || "none" },
    { label: "Seller concessions / credits", value: terms.sellerConcessions || "None" },
    { label: "Home warranty", value: HOME_WARRANTY_LABEL[terms.homeWarranty] },
    { label: "Offer expires", value: days(terms.offerExpiresDays) },
    ...(terms.specialTerms ? [{ label: "Additional terms", value: terms.specialTerms }] : []),
  ];
}

/** One-line chips for compact places (cards, timelines). */
export function termsChips(price: number, t: AgreementTerms): string[] {
  const terms = completeTerms(t, t.paymentMode === "financed");
  return [
    terms.depositMode === "custom" ? `Deposit ${formatPrice(depositAmount(price, terms))}` : `Deposit ${terms.depositPct}%`,
    `Closing ${formatDate(terms.closingDate)}`,
    PAYMENT_LABEL[terms.paymentMode],
    terms.inspection ? "Inspection protection" : "No inspection protection",
    terms.appraisal ? "Appraisal protection" : "No appraisal protection",
    terms.financing ? "Financing protection" : "No financing protection",
    `Commission ${terms.commissionPct}%`,
    formatPrice(Math.round(price)),
  ];
}
