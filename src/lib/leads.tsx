import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MortgageProfile } from "@/lib/auth";

export type LeadStatus = "new" | "info_required" | "not_qualified" | "qualified";

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New inquiry",
  info_required: "More information required",
  not_qualified: "Not qualified",
  qualified: "Qualified",
};

export type LeadDocument = {
  id: string;
  name: string;
  uploadedAt: string;
};

export type InfoRequest = {
  id: string;
  question: string;
  needsDocument: boolean;
  requestedAt: string;
  answer?: string;
  documents: LeadDocument[];
  answeredAt?: string;
};

export type OtherObligation = { id: string; label: string; amount: number };

export type DebtProfile = {
  propertyLoans: number;
  vehicleLoans: number;
  insurance: number;
  other: OtherObligation[];
  submittedAt: string;
};

/** Pricing the lender returns with a decision — required before any estimate. */
export type LenderTerms = {
  /** Annual interest rate as a percentage, e.g. 6.75 */
  ratePct: number;
  termYears: number;
  downPaymentPct: number;
  closingCostPct: number;
  taxInsurancePct: number;
  issuedAt: string;
};

/** What the client decided about the lender's priced pre-approval offer. */
export type ClientDecision = "accepted" | "declined";

export type MortgageLead = {
  id: string;
  clientEmail: string;
  clientName: string;
  usPerson: boolean;
  propertyId: number;
  propertyLabel: string;
  propertyPrice: number;
  submittedAt: string;
  profile: MortgageProfile;
  status: LeadStatus;
  creditScore?: number;
  lenderNote?: string;
  decidedAt?: string;
  /** Lender may tighten or relax the DTI ceiling per applicant. */
  dtiLimit: number;
  /** Lender-issued loan pricing. Estimates stay locked until this exists. */
  terms?: LenderTerms;
  /** Set once the client accepts or declines the priced pre-approval terms. */
  clientDecision?: ClientDecision;
  clientDecisionAt?: string;
  /** Team member inside the lender company reviewing this inquiry. */
  assignedToId?: string;
  assignedToName?: string;
  assignedAt?: string;
  infoRequests: InfoRequest[];
  debts?: DebtProfile;
};


/** Estimates unlock only when the lender returned a score AND full pricing. */
export function hasPricedOffer(lead?: MortgageLead): lead is MortgageLead {
  return Boolean(lead && lead.status === "qualified" && lead.creditScore && lead.terms);
}

/** Still being worked on the pre-approval desk. */
export function isOpenRequest(lead: MortgageLead) {
  return lead.status === "new" || lead.status === "info_required";
}

/** Qualified + client accepted → a live mortgage file. */
export function isMortgageFile(lead: MortgageLead) {
  return hasPricedOffer(lead) && lead.clientDecision === "accepted";
}

/** Qualified but the client has not (yet) accepted the terms. */
export function isQualifiedNotApproved(lead: MortgageLead) {
  return lead.status === "qualified" && lead.clientDecision !== "accepted";
}

export type MortgageFileStage = "awaiting_client" | "client_declined" | "in_underwriting";

export function mortgageStage(lead: MortgageLead): MortgageFileStage {
  if (lead.clientDecision === "accepted") return "in_underwriting";
  if (lead.clientDecision === "declined") return "client_declined";
  return "awaiting_client";
}

export const MORTGAGE_STAGE_LABEL: Record<MortgageFileStage, string> = {
  awaiting_client: "Awaiting client confirmation",
  client_declined: "Qualified — not approved by client",
  in_underwriting: "Open mortgage file (hard check)",
};

/** Two-letter state parsed from the property label, e.g. "New York, NY". */
export function leadState(lead: MortgageLead) {
  const m = lead.propertyLabel.match(/\b([A-Z]{2})\b\s*$/);
  return m?.[1] ?? "—";
}

/** City parsed from the property label, e.g. "Austin, TX" → "Austin". */
export function leadCity(lead: MortgageLead) {
  const parts = lead.propertyLabel.split(",").map((s) => s.trim());
  return parts.length > 1 ? parts[parts.length - 2]! : (parts[0] ?? "—");
}



/** Convert lender terms into the loan terms used by the investment model. */
export function toLoanTerms(terms: LenderTerms) {
  return {
    rate: terms.ratePct / 100,
    termYears: terms.termYears,
    downPaymentPct: terms.downPaymentPct / 100,
    closingCostPct: terms.closingCostPct / 100,
    taxInsurancePct: terms.taxInsurancePct / 100,
  };
}

const STORAGE_KEY = "loqal.leads.v1";
export const DEFAULT_DTI_LIMIT = 0.5;

const uid = () => Math.random().toString(36).slice(2, 10);

type LeadsContextValue = {
  leads: MortgageLead[];
  ready: boolean;
  createLead: (
    input: Omit<MortgageLead, "id" | "status" | "infoRequests" | "submittedAt" | "dtiLimit">,
  ) => MortgageLead;
  updateLead: (id: string, patch: Partial<MortgageLead>) => void;
  addInfoRequest: (id: string, question: string, needsDocument: boolean) => void;
  answerInfoRequest: (
    leadId: string,
    requestId: string,
    answer: string,
    documents: string[],
  ) => void;
  saveDebts: (leadId: string, debts: DebtProfile) => void;
  setClientDecision: (leadId: string, decision: ClientDecision) => void;

  leadsForClient: (email: string) => MortgageLead[];
  leadForProperty: (email: string, propertyId: number) => MortgageLead | undefined;
};

const LeadsContext = createContext<LeadsContextValue | null>(null);

export function LeadsProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<MortgageLead[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLeads(JSON.parse(raw) as MortgageLead[]);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const persist = useCallback((next: MortgageLead[]) => {
    setLeads(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const value = useMemo<LeadsContextValue>(() => {
    const patchLead = (id: string, fn: (lead: MortgageLead) => MortgageLead) =>
      persist(leads.map((l) => (l.id === id ? fn(l) : l)));

    return {
      leads,
      ready,
      createLead: (input) => {
        const lead: MortgageLead = {
          ...input,
          id: uid(),
          status: "new",
          dtiLimit: DEFAULT_DTI_LIMIT,
          infoRequests: [],
          submittedAt: new Date().toISOString(),
        };
        const rest = leads.filter(
          (l) => !(l.clientEmail === lead.clientEmail && l.propertyId === lead.propertyId),
        );
        persist([lead, ...rest]);
        return lead;
      },
      updateLead: (id, patch) => patchLead(id, (l) => ({ ...l, ...patch })),
      addInfoRequest: (id, question, needsDocument) =>
        patchLead(id, (l) => ({
          ...l,
          status: "info_required",
          infoRequests: [
            ...l.infoRequests,
            {
              id: uid(),
              question,
              needsDocument,
              requestedAt: new Date().toISOString(),
              documents: [],
            },
          ],
        })),
      answerInfoRequest: (leadId, requestId, answer, documents) =>
        patchLead(leadId, (l) => ({
          ...l,
          infoRequests: l.infoRequests.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  answer,
                  answeredAt: new Date().toISOString(),
                  documents: [
                    ...r.documents,
                    ...documents.map((name) => ({
                      id: uid(),
                      name,
                      uploadedAt: new Date().toISOString(),
                    })),
                  ],
                }
              : r,
          ),
        })),
      saveDebts: (leadId, debts) => patchLead(leadId, (l) => ({ ...l, debts })),
      setClientDecision: (leadId, decision) =>
        patchLead(leadId, (l) => ({
          ...l,
          clientDecision: decision,
          clientDecisionAt: new Date().toISOString(),
        })),

      leadsForClient: (email) => leads.filter((l) => l.clientEmail === email),
      leadForProperty: (email, propertyId) =>
        leads.find((l) => l.clientEmail === email && l.propertyId === propertyId),
    };
  }, [leads, ready, persist]);

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
}

export function useLeads() {
  const ctx = useContext(LeadsContext);
  if (!ctx) throw new Error("useLeads must be used inside <LeadsProvider>");
  return ctx;
}

/* ---------------------------------------------------------------- DTI math */

export const LOAN_ASSUMPTIONS = {
  rate: 0.065,
  termMonths: 360,
  downPaymentPct: 0.2,
  /** Property taxes + hazard insurance, annual, as a share of purchase price. */
  taxInsurancePct: 0.0145,
};

export function totalMonthlyObligations(debts?: DebtProfile) {
  if (!debts) return 0;
  return (
    debts.propertyLoans +
    debts.vehicleLoans +
    debts.insurance +
    debts.other.reduce((sum, o) => sum + (o.amount || 0), 0)
  );
}

/** Monthly principal + interest per $1 of purchase price at the standard terms. */
function pitiFactorPerDollar() {
  const { rate, termMonths, downPaymentPct, taxInsurancePct } = LOAN_ASSUMPTIONS;
  const r = rate / 12;
  const loanPerDollar = 1 - downPaymentPct;
  const paymentFactor = r / (1 - Math.pow(1 + r, -termMonths));
  return loanPerDollar * paymentFactor + taxInsurancePct / 12;
}

export function monthlyPitiFor(price: number) {
  return price * pitiFactorPerDollar();
}

export type DtiResult = {
  monthlyIncome: number;
  obligations: number;
  dtiLimit: number;
  /** Monthly amount left for the new housing payment. */
  allowance: number;
  maxPurchasePrice: number;
  maxLoanAmount: number;
  requiredDownPayment: number;
  /** DTI if the applicant bought the listed property at asking price. */
  dtiAtListPrice: number;
  qualifiesAtListPrice: boolean;
};

export function computeDti({
  monthlyIncome,
  obligations,
  dtiLimit = DEFAULT_DTI_LIMIT,
  listPrice,
}: {
  monthlyIncome: number;
  obligations: number;
  dtiLimit?: number;
  listPrice: number;
}): DtiResult {
  const allowance = Math.max(0, monthlyIncome * dtiLimit - obligations);
  const maxPurchasePrice = allowance / pitiFactorPerDollar();
  const maxLoanAmount = maxPurchasePrice * (1 - LOAN_ASSUMPTIONS.downPaymentPct);
  const dtiAtListPrice =
    monthlyIncome > 0 ? (monthlyPitiFor(listPrice) + obligations) / monthlyIncome : 1;
  return {
    monthlyIncome,
    obligations,
    dtiLimit,
    allowance,
    maxPurchasePrice,
    maxLoanAmount,
    requiredDownPayment: maxPurchasePrice * LOAN_ASSUMPTIONS.downPaymentPct,
    dtiAtListPrice,
    qualifiesAtListPrice: dtiAtListPrice <= dtiLimit,
  };
}
