/**
 * Buyer ↔ buyer's agent process state that lives outside the mortgage lead
 * itself: realtor calendar bookings, property photo deliveries with the
 * agent's recommendations, and the buyer's next-step decisions once photos
 * and comments arrive.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { MortgageLead } from "@/lib/leads";
import { formatDate } from "@/lib/dates";

const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ types */

export type ProcessPhoto = { id: string; name: string; uploadedAt: string };

export type PhotoDelivery = {
  requestedAt: string;
  /** The buyer's agent owes photos within 3 days of the request. */
  dueAt: string;
  status: "awaiting" | "delayed" | "delivered";
  /** Set when the seller cannot receive the agent within 3 days. */
  delayReason?: string;
  etaAt?: string;
  deliveredAt?: string;
  photos: ProcessPhoto[];
  /** Agent's written comments and recommended next moves. */
  comments?: string;
  inspectionsSuggested: string[];
  appraisalNote?: string;
  negotiationNote?: string;
  suggestedPrice?: number;
};

export type CallKind = "intro_call" | "video_tour";

export type CallBooking = {
  id: string;
  leadId: string;
  realtorId?: string;
  clientName: string;
  propertyLabel: string;
  kind: CallKind;
  /** ISO start/end — 1 hour per booking. */
  startAt: string;
  endAt: string;
  createdAt: string;
};

export type ClientNextAction =
  | "more_info"
  | "agree_inspections"
  | "agree_negotiation"
  | "sign_prepurchase"
  | "property_change"
  | "live_call";

export const CLIENT_ACTION_LABEL: Record<ClientNextAction, string> = {
  more_info: "Requested more information about the property",
  agree_inspections: "Agreed to proceed with inspections",
  agree_negotiation: "Agreed to the proposed negotiation price",
  sign_prepurchase: "Proceeding to the prepurchase agreement",
  property_change: "Requested a property change",
  live_call: "Requested a live call",
};

export type PropertyChangeMode = "platform" | "agent_propose" | "change_criteria";

export const PROPERTY_CHANGE_LABEL: Record<PropertyChangeMode, string> = {
  platform: "Buyer picks another property on the platform",
  agent_propose: "Agent proposes other properties on the same criteria",
  change_criteria: "Buyer changed the search criteria",
};

export type ClientAction = {
  id: string;
  action: ClientNextAction;
  details?: string;
  extraInspections?: string[];
  propertyChangeMode?: PropertyChangeMode;
  createdAt: string;
};

export const INSPECTION_OPTIONS = [
  "General home inspection",
  "Roof",
  "Termite / pest",
  "Mold",
  "Foundation / structural",
  "HVAC",
  "Plumbing",
  "Electrical",
  "Pool & spa",
  "Sewer line",
];

export type BuyerProcessState = {
  photos: Record<string, PhotoDelivery>;
  bookings: CallBooking[];
  actions: Record<string, ClientAction[]>;
};

/* ------------------------------------------------------------------ store */

const STORAGE_KEY = "loqal.buyer-process.v1";

const EMPTY: BuyerProcessState = { photos: {}, bookings: [], actions: {} };

let state: BuyerProcessState | null = null;
const listeners = new Set<() => void>();

function load(): BuyerProcessState {
  if (state) return state;
  let next = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BuyerProcessState>;
      next = {
        photos: parsed.photos ?? {},
        bookings: parsed.bookings ?? [],
        actions: parsed.actions ?? {},
      };
    }
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: BuyerProcessState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

/* ------------------------------------------------------------- scheduling */

export type Slot = { startAt: string; label: string };
export type SlotDay = { day: string; label: string; slots: Slot[] };

function timeLabel(d: Date) {
  const h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}:00 ${ampm}`;
}

/**
 * Real-time free slots on a realtor's calendar: weekday hours 9:00–17:00,
 * 1-hour bookings, for the next two weeks, minus slots already booked.
 */
export function availableSlots(
  realtorId: string | undefined,
  bookings: CallBooking[],
  maxDays = 10,
): SlotDay[] {
  const booked = new Set(
    bookings.filter((b) => b.realtorId === realtorId).map((b) => b.startAt),
  );
  const out: SlotDay[] = [];
  const now = Date.now();
  for (let d = 0; d < 21 && out.length < maxDays; d++) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // weekends off
    const slots: Slot[] = [];
    for (let h = 9; h <= 16; h++) {
      const start = new Date(date);
      start.setHours(h, 0, 0, 0);
      if (start.getTime() <= now + 60 * 60 * 1000) continue; // at least 1h notice
      const iso = start.toISOString();
      if (booked.has(iso)) continue;
      slots.push({ startAt: iso, label: timeLabel(start) });
    }
    if (slots.length) {
      out.push({ day: date.toISOString(), label: formatDate(date.toISOString()), slots });
    }
  }
  return out;
}

/* ------------------------------------------------------- lender summary */

/**
 * Big-picture status of the buyer ↔ agent cooperation for the mortgage
 * lender — deliberately without nuances (no comments, prices or documents).
 */
export function buyerAgentSummary(
  lead: MortgageLead,
  proc: Pick<BuyerProcessState, "photos" | "bookings" | "actions">,
): string | null {
  const ba = lead.buyerAgent;
  if (!ba || lead.clientDecision !== "accepted") return null;
  if (!ba.representation) {
    return "Buyer accepted the terms — choosing how to work with the buyer's agent";
  }
  if (ba.representation === "loqal_rep") {
    return "Purchase is steered by a Loqal personal manager on the buyer's behalf";
  }
  const agent = ba.agentName ?? "the assigned buyer's agent";
  const actions = proc.actions[lead.id] ?? [];
  const last = actions[actions.length - 1];
  const photo = proc.photos[lead.id];
  if (last) {
    const suffix =
      last.action === "property_change" && last.propertyChangeMode
        ? ` (${PROPERTY_CHANGE_LABEL[last.propertyChangeMode].toLowerCase()})`
        : "";
    return `Buyer and ${agent} — ${CLIENT_ACTION_LABEL[last.action].toLowerCase()}${suffix}`;
  }
  if (photo) {
    if (photo.status === "delivered")
      return `Property photos and recommendations from ${agent} delivered — buyer deciding next steps`;
    if (photo.status === "delayed")
      return `${agent} rescheduled the property visit — updated photos expected ${photo.etaAt ? formatDate(photo.etaAt) : "soon"}`;
    return `Buyer asked ${agent} for updated property photos`;
  }
  if (ba.kickoff === "live_call") {
    const booking = proc.bookings.find((b) => b.leadId === lead.id && b.kind === "intro_call");
    return booking
      ? `Intro call between buyer and ${agent} booked for ${formatDate(booking.startAt)}`
      : `Buyer requested an intro call with ${agent}`;
  }
  if (ba.kickoff === "video_showcase") return `Buyer asked ${agent} for a live video tour of the property`;
  return `Buyer is working directly with ${agent}`;
}

/* ------------------------------------------------------------------- hook */

export function useBuyerProcess() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => EMPTY,
  );

  /** Buyer asked the agent to visit the property — photos due in 3 days. */
  const requestPhotos = useCallback((leadId: string) => {
    const cur = load();
    if (cur.photos[leadId]?.status !== "delivered" && cur.photos[leadId]) return;
    const now = new Date();
    const due = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    commit({
      ...cur,
      photos: {
        ...cur.photos,
        [leadId]: {
          requestedAt: now.toISOString(),
          dueAt: due.toISOString(),
          status: "awaiting",
          photos: [],
          inspectionsSuggested: [],
        },
      },
    });
  }, []);

  /** Seller unavailable — agent sets a new visit/photo date with a reason. */
  const delayPhotos = useCallback((leadId: string, reason: string, etaAt: string) => {
    const cur = load();
    const existing = cur.photos[leadId];
    if (!existing) return;
    commit({
      ...cur,
      photos: {
        ...cur.photos,
        [leadId]: { ...existing, status: "delayed", delayReason: reason, etaAt },
      },
    });
  }, []);

  /** Agent uploads the photos together with comments and recommendations. */
  const deliverPhotos = useCallback(
    (
      leadId: string,
      photoNames: string[],
      payload: {
        comments: string;
        inspectionsSuggested: string[];
        appraisalNote: string;
        negotiationNote: string;
        suggestedPrice?: number;
      },
    ) => {
      const cur = load();
      const existing = cur.photos[leadId];
      if (!existing) return;
      const now = new Date().toISOString();
      commit({
        ...cur,
        photos: {
          ...cur.photos,
          [leadId]: {
            ...existing,
            status: "delivered",
            deliveredAt: now,
            photos: photoNames.map((name) => ({ id: uid(), name, uploadedAt: now })),
            comments: payload.comments,
            inspectionsSuggested: payload.inspectionsSuggested,
            appraisalNote: payload.appraisalNote,
            negotiationNote: payload.negotiationNote,
            ...(payload.suggestedPrice !== undefined
              ? { suggestedPrice: payload.suggestedPrice }
              : {}),
          },
        },
      });
    },
    [],
  );

  const bookCall = useCallback(
    (input: {
      leadId: string;
      realtorId?: string;
      clientName: string;
      propertyLabel: string;
      kind: CallKind;
      startAt: string;
    }) => {
      const cur = load();
      const end = new Date(new Date(input.startAt).getTime() + 60 * 60 * 1000);
      const booking: CallBooking = {
        id: uid(),
        leadId: input.leadId,
        clientName: input.clientName,
        propertyLabel: input.propertyLabel,
        kind: input.kind,
        startAt: input.startAt,
        endAt: end.toISOString(),
        createdAt: new Date().toISOString(),
        ...(input.realtorId ? { realtorId: input.realtorId } : {}),
      };
      commit({ ...cur, bookings: [...cur.bookings, booking] });
      return booking;
    },
    [],
  );

  const addClientAction = useCallback(
    (
      leadId: string,
      action: ClientNextAction,
      payload: {
        details?: string;
        extraInspections?: string[];
        propertyChangeMode?: PropertyChangeMode;
      } = {},
    ) => {
      const cur = load();
      const record: ClientAction = {
        id: uid(),
        action,
        createdAt: new Date().toISOString(),
        ...(payload.details ? { details: payload.details } : {}),
        ...(payload.extraInspections?.length
          ? { extraInspections: payload.extraInspections }
          : {}),
        ...(payload.propertyChangeMode
          ? { propertyChangeMode: payload.propertyChangeMode }
          : {}),
      };
      commit({
        ...cur,
        actions: { ...cur.actions, [leadId]: [...(cur.actions[leadId] ?? []), record] },
      });
    },
    [],
  );

  return {
    ...snapshot,
    requestPhotos,
    delayPhotos,
    deliverPhotos,
    bookCall,
    addClientAction,
  };
}
