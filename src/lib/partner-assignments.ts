/**
 * Which Loqal partner serves which client file, and the paper trail when a
 * Loqal admin moves a file to a different partner.
 *
 * A handover is never silent: the receiving partner gets an offer with a
 * briefing on the client and must accept it before the file moves. Only then
 * is the client told about the change, and the swap is recorded permanently so
 * the admin console can show who worked the file and when it moved.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { MortgageLead } from "@/lib/leads";
import type { PartnerRequest } from "@/lib/partner-requests";
import { partnerCoversState } from "@/lib/licence-verification";

export type PartnerRole = "lender" | "realtor";

export const PARTNER_ROLE_LABEL: Record<PartnerRole, string> = {
  lender: "Mortgage lender",
  realtor: "Buyer's agent",
};

export type Handover = {
  id: string;
  leadId: string;
  role: PartnerRole;
  clientEmail: string;
  clientName: string;
  propertyLabel: string;
  fromId?: string;
  fromName?: string;
  /** partner_requests id of the receiving partner. */
  toId: string;
  toName: string;
  toEmail: string;
  toCompany?: string;
  reason: string;
  /** Situation briefing handed to the new partner. */
  briefing: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "accepted" | "declined";
  respondedAt?: string;
  responseNote?: string;
};

type State = { items: Handover[] };

const STORAGE_KEY = "loqal.partnerHandovers.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  let next: State = { items: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { items: (JSON.parse(raw) as Partial<State>).items ?? [] };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function getHandovers(): Handover[] {
  return load().items;
}

/** Admin starts a handover — nothing moves until the new partner accepts. */
export function requestHandover(input: Omit<Handover, "id" | "requestedAt" | "status">): Handover {
  const entry: Handover = {
    ...input,
    id: uid(),
    requestedAt: new Date().toISOString(),
    status: "pending",
  };
  commit({ items: [entry, ...load().items] });
  return entry;
}

export function respondToHandover(id: string, accept: boolean, note?: string) {
  commit({
    items: load().items.map((h) =>
      h.id === id
        ? {
            ...h,
            status: accept ? "accepted" : "declined",
            respondedAt: new Date().toISOString(),
            ...(note ? { responseNote: note } : {}),
          }
        : h,
    ),
  });
}

const SERVER_SNAPSHOT: State = { items: [] };

export function useHandovers() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );
  const respond = useCallback(
    (id: string, accept: boolean, note?: string) => respondToHandover(id, accept, note),
    [],
  );
  return { handovers: snapshot.items, respond, request: requestHandover };
}

/* --------------------------------------------------------------- helpers */

/** Two-letter state of the property on a file. */
function stateOf(lead: MortgageLead) {
  const m = lead.propertyLabel.match(/\b([A-Z]{2})\b\s*$/);
  return m?.[1] ?? "";
}

/** Approved partner registrations of one kind. */
export function approvedPartners(requests: PartnerRequest[], role: PartnerRole) {
  return requests.filter((r) => r.status === "approved" && r.partnerType === role);
}

export function partnerLabel(r: PartnerRequest) {
  const person = `${r.firstName} ${r.lastName}`.trim();
  return r.companyName ? `${person} · ${r.companyName}` : person;
}

/**
 * The partner currently serving a file. Lenders are stored on the file once a
 * handover happens; older files fall back to the approved lender covering the
 * property state.
 */
export function currentPartner(
  lead: MortgageLead,
  role: PartnerRole,
  requests: PartnerRequest[],
): PartnerRequest | undefined {
  const pool = approvedPartners(requests, role);
  if (role === "realtor") {
    const id = lead.buyerAgent?.agentId;
    return id ? pool.find((r) => r.id === id) : undefined;
  }
  if (lead.lenderPartnerId) return pool.find((r) => r.id === lead.lenderPartnerId);
  const st = stateOf(lead);
  /* Only lenders whose licence for that state is verified by Loqal. */
  return pool.find(
    (r) => (r.allStates || r.states.includes(st)) && partnerCoversState(r, st),
  );
}

/** Everything a receiving partner should know before accepting the client. */
export function buildBriefing(lead: MortgageLead, role: PartnerRole) {
  const lines: string[] = [];
  lines.push(`Client: ${lead.clientName}`);
  lines.push(`Property: ${lead.propertyLabel} · $${lead.propertyPrice.toLocaleString()}`);
  lines.push(`Application status: ${lead.status}`);
  if (lead.terms)
    lines.push(
      `Terms on file: ${lead.terms.ratePct}% · ${lead.terms.termYears} years · ${lead.terms.downPaymentPct}% down`,
    );
  if (lead.clientDecision) lines.push(`Client decision on terms: ${lead.clientDecision}`);
  const openInfo = lead.infoRequests.filter((r) => !r.answeredAt).length;
  lines.push(
    `Information requests: ${lead.infoRequests.length} total, ${openInfo} still open`,
  );
  if (role === "realtor" && lead.buyerAgent) {
    if (lead.buyerAgent.representation)
      lines.push(`Representation: ${lead.buyerAgent.representation}`);
    if (lead.buyerAgent.kickoff) lines.push(`Requested next step: ${lead.buyerAgent.kickoff}`);
    if (lead.buyerAgent.kickoffNotes) lines.push(`Client notes: ${lead.buyerAgent.kickoffNotes}`);
  }
  if (lead.clientQuestions?.length)
    lines.push(`Open client questions: ${lead.clientQuestions.length}`);
  return lines.join("\n");
}

/** Handovers a specific partner still has to answer. */
export function pendingFor(handovers: Handover[], partnerId: string | undefined) {
  if (!partnerId) return [];
  return handovers.filter((h) => h.toId === partnerId && h.status === "pending");
}

/** Files a partner worked on historically (received or handed away). */
export function historyForPartner(handovers: Handover[], partnerId: string | undefined) {
  if (!partnerId) return [];
  return handovers.filter((h) => h.toId === partnerId || h.fromId === partnerId);
}
