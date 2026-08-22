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
import {
  getTeamSnapshot,
  isCompanyOnVacation,
  pickAssignee,
  type AssignCounts,
} from "@/lib/lender-team";
import { pickRealtor } from "@/lib/realtors";

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
  url?: string;
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
  /** Lending company that issued the terms (shown to the client). */
  lenderName?: string;
  /** Company NMLS number (shown to the client). */
  lenderNmls?: string;
  /** Annual interest rate as a percentage, e.g. 6.75 */
  ratePct: number;
  termYears: number;
  downPaymentPct: number;
  closingCostPct: number;
  taxInsurancePct: number;
  issuedAt: string;
};

/** What the client decided about the lender's priced pre-approval offer. */
export type ClientDecision = "accepted" | "hold" | "declined";

export const CLIENT_DECISION_LABEL: Record<ClientDecision, string> = {
  accepted: "Continuing with the terms",
  hold: "Put on hold",
  declined: "Not continuing",
};

/** A question the client asked the lender about the issued terms. */
export type ClientQuestion = {
  id: string;
  text: string;
  askedAt: string;
  answer?: string;
  answeredAt?: string;
};

/** Who steers the purchase on the buyer's side after the terms are accepted. */
export type Representation = "loqal_rep" | "buyer_direct";

/** How the buyer wants to kick off the work with the buyer's agent. */
export type KickoffRequest = "live_call" | "photo_visit" | "video_showcase" | "in_person_visit";

export const KICKOFF_LABEL: Record<KickoffRequest, string> = {
  live_call: "Live call with the buyer's agent",
  photo_visit: "Agent visit for updated property photos",
  video_showcase: "Real-time video showcasing of the property",
  in_person_visit: "In-person visit of the property",
};

/** Buyer's agent engagement, created when the client accepts the terms. */
export type BuyerAgentEngagement = {
  /** When the client confirmed the buyer's agent agreement (3% fee at closing). */
  agreedAt: string;
  feePct: number;
  agentId?: string;
  agentName?: string;
  assignedAt?: string;
  /** How the client wants to start working with the agent (legacy two-option flow). */
  nextStep?: "live_call" | "start";
  liveCallRequestedAt?: string;
  /**
   * Who represents the buyer day-to-day: a Loqal personal advocate (extra 1%
   * fee on the purchase price) or the buyer directly with the agent.
   */
  representation?: Representation;
  /** Loqal personal advocate fee, % of the purchase price at closing. */
  loqalManagerFeePct?: number;
  /** Kickoff choice when the buyer works with the agent directly. */
  kickoff?: KickoffRequest;
  /** Free-text notes the buyer attached to their choice. */
  kickoffNotes?: string;
  kickoffAt?: string;
};

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
  /** Set once the client answers the priced pre-approval terms. */
  clientDecision?: ClientDecision;
  clientDecisionAt?: string;
  /** Questions the client raised about the issued terms. */
  clientQuestions?: ClientQuestion[];
  /** Buyer's agent engagement after the client accepts the terms. */
  buyerAgent?: BuyerAgentEngagement;
  /** Team member inside the lender company reviewing this inquiry. */
  assignedToId?: string | undefined;
  assignedToName?: string | undefined;
  assignedAt?: string | undefined;
  /** Set when the lender company was on vacation mode at submission time. */
  routedToOtherPartner?: boolean;

  infoRequests: InfoRequest[];
  debts?: DebtProfile;
};

/**
 * Estimates unlock when the lender returned full pricing — plus a soft credit
 * score for applicants with an SSN. Applicants without an SSN (no US credit
 * file) get terms only: no score and no DTI ceiling is shown to them.
 */
export function hasPricedOffer(lead?: MortgageLead): lead is MortgageLead {
  return Boolean(
    lead &&
      lead.status === "qualified" &&
      lead.terms &&
      (lead.creditScore || !lead.profile.ssn),
  );
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

export type MortgageFileStage =
  | "awaiting_client"
  | "client_on_hold"
  | "client_declined"
  | "in_underwriting";

export function mortgageStage(lead: MortgageLead): MortgageFileStage {
  if (lead.clientDecision === "accepted") return "in_underwriting";
  if (lead.clientDecision === "declined") return "client_declined";
  if (lead.clientDecision === "hold") return "client_on_hold";
  return "awaiting_client";
}

export const MORTGAGE_STAGE_LABEL: Record<MortgageFileStage, string> = {
  awaiting_client: "Awaiting client decision",
  client_on_hold: "On hold by client",
  client_declined: "Qualified — client not continuing",
  in_underwriting: "Open mortgage file (hard check)",
};

/* ----------------------------------------------------- decision reminders */

/**
 * While a priced offer waits for the client's answer we remind on this
 * schedule (days after the terms were issued). From day 3 onwards the
 * reminder also goes out by e-mail, not only on the platform.
 */
export const OFFER_REMINDER_DAYS = [1, 3, 7, 14, 30, 60, 75] as const;

export type OfferReminder = {
  day: number;
  dueAt: string;
  due: boolean;
  /** true → this reminder is also sent by e-mail. */
  email: boolean;
};

/** A priced offer the client has not answered yet. */
export function pendingOfferDecision(lead: MortgageLead) {
  return hasPricedOffer(lead) && !lead.clientDecision;
}

export function offerReminders(lead: MortgageLead, now: Date = new Date()): OfferReminder[] {
  if (!pendingOfferDecision(lead)) return [];
  const issued = new Date(lead.terms!.issuedAt).getTime();
  return OFFER_REMINDER_DAYS.map((day) => {
    const at = new Date(issued + day * 24 * 60 * 60 * 1000);
    return { day, dueAt: at.toISOString(), due: at.getTime() <= now.getTime(), email: day >= 3 };
  });
}

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
  askClientQuestion: (leadId: string, text: string) => void;
  answerClientQuestion: (leadId: string, questionId: string, answer: string) => void;
  /**
   * Client confirmed the terms AND the buyer's agent agreement — assigns a
   * realtor (licensed in the property state, available, lightest pipeline).
   */
  agreeBuyerAgent: (leadId: string, languages?: string[]) => void;
  setBuyerAgentNextStep: (leadId: string, step: "live_call" | "start") => void;
  /**
   * Client picked who steers the purchase (Loqal personal manager or working
   * with the buyer's agent directly) and, for the direct path, the kickoff.
   */
  setBuyerRepresentation: (
    leadId: string,
    representation: Representation,
    kickoff?: KickoffRequest,
    notes?: string,
  ) => void;

  leadsForClient: (email: string) => MortgageLead[];
  leadForProperty: (email: string, propertyId: number) => MortgageLead | undefined;
};

const LeadsContext = createContext<LeadsContextValue | null>(null);

/** Decide (and return) the auto-assignment patch for a newly created lead. */
export function autoAssign(
  lead: Pick<MortgageLead, "propertyPrice" | "propertyLabel">,
  existingLeads: MortgageLead[],
): Partial<MortgageLead> {
  const snapshot = getTeamSnapshot();
  if (isCompanyOnVacation(snapshot)) {
    return { routedToOtherPartner: true };
  }
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - now.getDay() * 24 * 60 * 60 * 1000;
  const counts: AssignCounts = { openByMember: {}, todayByMember: {}, weekByMember: {} };
  for (const l of existingLeads) {
    if (!l.assignedToId) continue;
    if (isOpenRequest(l)) {
      counts.openByMember[l.assignedToId] = (counts.openByMember[l.assignedToId] ?? 0) + 1;
    }
    const at = l.assignedAt ? new Date(l.assignedAt).getTime() : 0;
    if (at >= startOfDay)
      counts.todayByMember[l.assignedToId] = (counts.todayByMember[l.assignedToId] ?? 0) + 1;
    if (at >= startOfWeek)
      counts.weekByMember[l.assignedToId] = (counts.weekByMember[l.assignedToId] ?? 0) + 1;
  }
  const m = lead.propertyLabel.match(/\b([A-Z]{2})\b\s*$/);
  const state = m?.[1] ?? "";
  const parts = lead.propertyLabel.split(",").map((s) => s.trim());
  const city = parts.length > 1 ? parts[parts.length - 2]! : (parts[0] ?? "");
  const picked = pickAssignee({ state, city, price: lead.propertyPrice }, counts, snapshot);
  if (!picked) return {};
  return {
    assignedToId: picked.id,
    assignedToName: picked.name,
    assignedAt: new Date().toISOString(),
  };
}

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
        /* A re-submission for the same client + property refreshes the file,
         * it does not wipe the lender's workflow state (decision, terms,
         * info requests, debts, assignment) or previously confirmed docs. */
        const existing = leads.find(
          (l) => l.clientEmail === input.clientEmail && l.propertyId === input.propertyId,
        );
        const lead: MortgageLead = {
          ...input,
          id: existing?.id ?? uid(),
          status: existing?.status ?? "new",
          dtiLimit: existing?.dtiLimit ?? DEFAULT_DTI_LIMIT,
          infoRequests: existing?.infoRequests ?? [],
          submittedAt: new Date().toISOString(),
          ...(existing
            ? {
                ...(existing.creditScore !== undefined
                  ? { creditScore: existing.creditScore }
                  : {}),
                ...(existing.lenderNote ? { lenderNote: existing.lenderNote } : {}),
                ...(existing.decidedAt ? { decidedAt: existing.decidedAt } : {}),
                ...(existing.terms ? { terms: existing.terms } : {}),
                ...(existing.clientDecision
                  ? { clientDecision: existing.clientDecision }
                  : {}),
                ...(existing.clientDecisionAt
                  ? { clientDecisionAt: existing.clientDecisionAt }
                  : {}),
                ...(existing.clientQuestions ? { clientQuestions: existing.clientQuestions } : {}),
                ...(existing.buyerAgent ? { buyerAgent: existing.buyerAgent } : {}),
                ...(existing.assignedToId
                  ? {
                      assignedToId: existing.assignedToId,
                      assignedToName: existing.assignedToName,
                      assignedAt: existing.assignedAt,
                    }
                  : {}),
                ...(existing.routedToOtherPartner ? { routedToOtherPartner: true } : {}),
                ...(existing.debts ? { debts: existing.debts } : {}),
              }
            : autoAssign(input, leads)),
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
      askClientQuestion: (leadId, text) =>
        patchLead(leadId, (l) => ({
          ...l,
          clientQuestions: [
            ...(l.clientQuestions ?? []),
            { id: uid(), text, askedAt: new Date().toISOString() },
          ],
        })),
      answerClientQuestion: (leadId, questionId, answer) =>
        patchLead(leadId, (l) => ({
          ...l,
          clientQuestions: (l.clientQuestions ?? []).map((q) =>
            q.id === questionId ? { ...q, answer, answeredAt: new Date().toISOString() } : q,
          ),
        })),
      agreeBuyerAgent: (leadId, languages = []) =>
        patchLead(leadId, (l) => {
          const now = new Date().toISOString();
          const activeCounts: Record<string, number> = {};
          for (const other of leads) {
            const id = other.buyerAgent?.agentId;
            if (id && other.clientDecision === "accepted")
              activeCounts[id] = (activeCounts[id] ?? 0) + 1;
          }
          const picked = pickRealtor(
            { state: leadState(l), languages, price: l.propertyPrice },
            activeCounts,
          );
          return {
            ...l,
            clientDecision: "accepted",
            clientDecisionAt: now,
            buyerAgent: {
              agreedAt: now,
              feePct: 3,
              ...(picked
                ? {
                    agentId: picked.id,
                    agentName: `${picked.firstName} ${picked.lastName}`,
                    assignedAt: now,
                  }
                : {}),
            },
          };
        }),
      setBuyerAgentNextStep: (leadId, step) =>
        patchLead(leadId, (l) =>
          l.buyerAgent
            ? {
                ...l,
                buyerAgent: {
                  ...l.buyerAgent,
                  nextStep: step,
                  ...(step === "live_call"
                    ? { liveCallRequestedAt: new Date().toISOString() }
                    : {}),
                },
              }
            : l,
        ),
      setBuyerRepresentation: (leadId, representation, kickoff, notes) =>
        patchLead(leadId, (l) =>
          l.buyerAgent
            ? {
                ...l,
                buyerAgent: {
                  ...l.buyerAgent,
                  representation,
                  ...(representation === "loqal_rep" ? { loqalManagerFeePct: 1 } : {}),
                  ...(kickoff ? { kickoff } : {}),
                  kickoffNotes: notes ?? "",
                  kickoffAt: new Date().toISOString(),
                },
              }
            : l,
        ),

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
