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

export type CallKind = "intro_call" | "video_tour" | "in_person_visit";

export type CallBooking = {
  id: string;
  leadId: string;
  realtorId?: string;
  clientName: string;
  propertyLabel: string;
  kind: CallKind;
  /** ISO start/end — 1 hour per booking. While proposed, startAt is the first option. */
  startAt: string;
  endAt: string;
  createdAt: string;
  /**
   * video tours / in-person visits: the buyer proposes several slots and the
   * agent confirms one. Intro calls book instantly ("confirmed").
   */
  status: "proposed" | "confirmed";
  proposedSlots?: string[];
  /** Buyer's note attached to the proposal. */
  note?: string;
  /** Google Calendar event created in the agent's calendar. */
  googleEventId?: string;
  /** Google Meet link for the appointment. */
  meetUrl?: string;
  /** Link to the event in Google Calendar. */
  calendarLink?: string;
  confirmedAt?: string;
  /* ---- recording & AI transcript (in-platform video calls) ---- */
  recordingConsentedAt?: string;
  endedAt?: string;
  durationMin?: number;
  transcript?: string;
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
  sign_prepurchase: "Proceeding to the Purchase Agreement",
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
        // Bookings predate the proposal flow — they were all instantly confirmed.
        bookings: (parsed.bookings ?? []).map((b) => ({ ...b, status: b.status ?? "confirmed" })),
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
  // Only confirmed bookings block a slot — proposals are not on the calendar yet.
  const booked = new Set(
    bookings
      .filter((b) => b.realtorId === realtorId && b.status !== "proposed")
      .map((b) => b.startAt),
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
    return "Purchase is steered by a Loqal personal advocate on the buyer's behalf";
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
  if (ba.kickoff === "video_showcase") {
    const b = proc.bookings.find((x) => x.leadId === lead.id && x.kind === "video_tour");
    if (b?.status === "confirmed") return `Live video tour with ${agent} confirmed for ${formatDate(b.startAt)}`;
    return `Buyer proposed times for a live video tour — awaiting ${agent}'s confirmation`;
  }
  if (ba.kickoff === "in_person_visit") {
    const b = proc.bookings.find((x) => x.leadId === lead.id && x.kind === "in_person_visit");
    if (b?.status === "confirmed") return `In-person property visit with ${agent} confirmed for ${formatDate(b.startAt)}`;
    return `Buyer proposed times for an in-person visit — awaiting ${agent}'s confirmation`;
  }
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
      googleEventId?: string;
      meetUrl?: string | null;
      calendarLink?: string | null;
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
        status: "confirmed",
        confirmedAt: new Date().toISOString(),
        ...(input.realtorId ? { realtorId: input.realtorId } : {}),
        ...(input.googleEventId ? { googleEventId: input.googleEventId } : {}),
        ...(input.meetUrl ? { meetUrl: input.meetUrl } : {}),
        ...(input.calendarLink ? { calendarLink: input.calendarLink } : {}),
      };
      commit({ ...cur, bookings: [...cur.bookings, booking] });
      return booking;
    },
    [],
  );

  /** Buyer proposes several slots (video tour / in-person visit); the agent confirms one. */
  const proposeSlots = useCallback(
    (input: {
      leadId: string;
      realtorId?: string;
      clientName: string;
      propertyLabel: string;
      kind: CallKind;
      slots: string[];
      note?: string;
    }) => {
      if (!input.slots.length) return null;
      const cur = load();
      const sorted = [...input.slots].sort();
      const end = new Date(new Date(sorted[0]!).getTime() + 60 * 60 * 1000);
      const booking: CallBooking = {
        id: uid(),
        leadId: input.leadId,
        clientName: input.clientName,
        propertyLabel: input.propertyLabel,
        kind: input.kind,
        startAt: sorted[0]!,
        endAt: end.toISOString(),
        createdAt: new Date().toISOString(),
        status: "proposed",
        proposedSlots: sorted,
        ...(input.realtorId ? { realtorId: input.realtorId } : {}),
        ...(input.note ? { note: input.note } : {}),
        recordingConsentedAt: new Date().toISOString(),
      };
      commit({ ...cur, bookings: [...cur.bookings, booking] });
      return booking;
    },
    [],
  );

  /** Agent confirms one of the buyer's proposed slots. */
  const confirmProposal = useCallback((bookingId: string, slot: string) => {
    const cur = load();
    const end = new Date(new Date(slot).getTime() + 60 * 60 * 1000);
    commit({
      ...cur,
      bookings: cur.bookings.map((b) =>
        b.id === bookingId
          ? {
              ...b,
              status: "confirmed",
              startAt: slot,
              endAt: end.toISOString(),
              confirmedAt: new Date().toISOString(),
            }
          : b,
      ),
    });
  }, []);

  /** Call ended — the recording and the AI transcript are saved to the file. */
  const endCall = useCallback((bookingId: string, durationMin: number, transcript: string) => {
    const cur = load();
    commit({
      ...cur,
      bookings: cur.bookings.map((b) =>
        b.id === bookingId
          ? { ...b, endedAt: new Date().toISOString(), durationMin, transcript }
          : b,
      ),
    });
  }, []);

  const addClientAction = useCallback(
    (
      leadId: string,
      action: ClientNextAction,
      payload: {
        details?: string | undefined;
        extraInspections?: string[] | undefined;
        propertyChangeMode?: PropertyChangeMode | undefined;
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
    proposeSlots,
    confirmProposal,
    endCall,
    addClientAction,
  };
}
