/**
 * Draft state for the buyer's-agent setup dialog.
 *
 * The client agrees to the 3% buyer's-agent fee, then picks representation and
 * a kickoff option. Those steps can be interrupted — closing the pop-up must
 * never lose what was already chosen, and re-opening must resume exactly where
 * the client left off instead of restarting from the agreement screen.
 */

export type BuyerAgentDraft = {
  step?: "representation" | "kickoff";
  representation?: "loqal_rep" | "buyer_direct";
  kickoff?: "live_call" | "photo_visit" | "video_showcase";
  notes?: string;
  callSlot?: string;
  callMeetUrl?: string;
  tourSlots?: string[];
  updatedAt?: string;
};

const KEY = "loqal.buyerAgentDrafts.v1";

function readAll(): Record<string, BuyerAgentDraft> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, BuyerAgentDraft>) : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, BuyerAgentDraft>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
}

export function loadBuyerAgentDraft(leadId: string): BuyerAgentDraft {
  if (typeof window === "undefined") return {};
  return readAll()[leadId] ?? {};
}

/** Merge and persist the parts of the setup the client has filled in so far. */
export function saveBuyerAgentDraft(leadId: string, patch: BuyerAgentDraft) {
  if (typeof window === "undefined") return;
  const all = readAll();
  all[leadId] = { ...all[leadId], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
}

export function clearBuyerAgentDraft(leadId: string) {
  if (typeof window === "undefined") return;
  const all = readAll();
  delete all[leadId];
  writeAll(all);
}
