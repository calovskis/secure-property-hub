/**
 * Buyer ↔ buyer's-agent requests on one property file that go beyond plain
 * messages:
 *
 *  1. "Proceed with the purchase" — the buyer either accepts the listing price
 *     or offers a lower one. The agent then either supports the offered price
 *     (and takes it to the seller) or comes back asking the buyer to go a
 *     little higher.
 *  2. "Property change" — the buyer asks the agent for similar properties with
 *     changed criteria, or picks another property themselves. Either way the
 *     buyer says why the current property did not work.
 *
 * Everything is kept per mortgage/property file (leadId) so both portals show
 * exactly the same state.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------------------------------------------------------------- purchase */

export type PurchaseRequestStatus =
  | "pending" // waiting for the agent
  | "price_supported" // agent will take the buyer's price to the seller
  | "price_pushback" // agent asks the buyer to raise the offer
  | "buyer_raised" // buyer answered the pushback with a new price
  | "withdrawn";

export type PurchaseRequest = {
  id: string;
  leadId: string;
  propertyId: number;
  propertyLabel: string;
  listingPrice: number;
  /** What the buyer wants to offer — equal to the listing price when accepted. */
  offerPrice: number;
  /** Whether the buyer accepted the listing price or offered less. */
  mode: "listing" | "lower";
  buyerNote?: string;
  createdAt: string;
  status: PurchaseRequestStatus;
  /** Agent's written opinion on the price. */
  agentNote?: string;
  /** Price the agent recommends instead of the buyer's offer. */
  agentSuggestedPrice?: number;
  respondedAt?: string;
  /** Set when the buyer answers a pushback with a higher price. */
  raisedPrice?: number;
  raisedAt?: string;
  /** The buyer's reason when they counter the agent's suggested price. */
  buyerCounterNote?: string;
  /**
   * How many times the agent has come back with a higher price. Used so each
   * round of the negotiation reaches both sides as its own notification.
   */
  round?: number;
  /** Every step of the price negotiation, oldest first. */
  negotiation?: {
    at: string;
    by: "buyer" | "agent";
    price: number;
    note?: string;
    kind: "offer" | "suggestion" | "counter" | "accepted";
  }[];
};

/* ------------------------------------------------------------------ change */

export const CHANGE_CRITERIA = [
  "Bigger living room",
  "More bedrooms",
  "More bathrooms",
  "More square footage",
  "Larger lot / outdoor space",
  "Garage or parking",
  "Newer building / recent renovation",
  "Move-in ready (no works needed)",
  "Better natural light / view",
  "Pool",
  "Elevator",
  "Quieter street",
  "Better school district",
  "Lower HOA / running costs",
  "Better rental potential",
] as const;

export type LocationPreference = "same_area" | "nearby" | "any_location";
export type PricePreference = "same_range" | "lower" | "higher";

export const LOCATION_LABEL: Record<LocationPreference, string> = {
  same_area: "Same area as this property",
  nearby: "Nearby areas are fine",
  any_location: "Open to a different location",
};

export const PRICE_LABEL: Record<PricePreference, string> = {
  same_range: "Keep the same price range",
  lower: "Look at lower prices",
  higher: "Ready to go higher",
};

export type ChangeRequest = {
  id: string;
  leadId: string;
  /** The property the buyer is stepping away from. */
  propertyId: number;
  propertyLabel: string;
  /** Agent proposes options, or the buyer already picked another property. */
  kind: "agent_proposes" | "buyer_picked";
  /** Why the current property did not work — always required. */
  reason: string;
  criteria: string[];
  customCriteria?: string;
  location?: LocationPreference;
  locationNote?: string;
  price?: PricePreference;
  /** Set when the buyer picked a property themselves. */
  pickedPropertyId?: number;
  pickedPropertyLabel?: string;
  createdAt: string;
  status: "pending" | "acknowledged";
  agentNote?: string;
  respondedAt?: string;
};

type State = { purchases: PurchaseRequest[]; changes: ChangeRequest[] };

const STORAGE_KEY = "loqal.propertyRequests.v1";
const EMPTY: State = { purchases: [], changes: [] };

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  let next = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      next = { purchases: parsed.purchases ?? [], changes: parsed.changes ?? [] };
    }
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

export function usePropertyRequests() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => EMPTY,
  );

  /** Buyer asks to proceed, at the listing price or at a lower one. */
  const requestPurchase = useCallback(
    (input: {
      leadId: string;
      propertyId: number;
      propertyLabel: string;
      listingPrice: number;
      offerPrice: number;
      mode: "listing" | "lower";
      buyerNote?: string;
    }) => {
      const cur = load();
      const entry: PurchaseRequest = {
        id: uid(),
        leadId: input.leadId,
        propertyId: input.propertyId,
        propertyLabel: input.propertyLabel,
        listingPrice: input.listingPrice,
        offerPrice: input.offerPrice,
        mode: input.mode,
        ...(input.buyerNote ? { buyerNote: input.buyerNote } : {}),
        createdAt: new Date().toISOString(),
        status: "pending",
        round: 0,
        negotiation: [
          {
            at: new Date().toISOString(),
            by: "buyer",
            price: input.offerPrice,
            ...(input.buyerNote ? { note: input.buyerNote } : {}),
            kind: "offer",
          },
        ],
      };
      commit({ ...cur, purchases: [...cur.purchases, entry] });
      return entry;
    },
    [],
  );

  /** Agent supports the buyer's price and takes it to the seller. */
  const supportPrice = useCallback((id: string, note?: string) => {
    const cur = load();
    const at = new Date().toISOString();
    commit({
      ...cur,
      purchases: cur.purchases.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "price_supported" as const,
              respondedAt: at,
              ...(note ? { agentNote: note } : {}),
              negotiation: [
                ...(p.negotiation ?? []),
                {
                  at,
                  by: "agent" as const,
                  price: p.offerPrice,
                  ...(note ? { note } : {}),
                  kind: "accepted" as const,
                },
              ],
            }
          : p,
      ),
    });
  }, []);

  /** Agent asks the buyer to raise the offer, with a recommended price. */
  const suggestHigherPrice = useCallback(
    (id: string, suggestedPrice: number, note?: string) => {
      const cur = load();
      const at = new Date().toISOString();
      commit({
        ...cur,
        purchases: cur.purchases.map((p) =>
          p.id === id
            ? {
                ...p,
                status: "price_pushback" as const,
                agentSuggestedPrice: suggestedPrice,
                respondedAt: at,
                ...(note ? { agentNote: note } : {}),
                round: (p.round ?? 0) + 1,
                negotiation: [
                  ...(p.negotiation ?? []),
                  {
                    at,
                    by: "agent" as const,
                    price: suggestedPrice,
                    ...(note ? { note } : {}),
                    kind: "suggestion" as const,
                  },
                ],
              }
            : p,
        ),
      });
    },
    [],
  );

  /**
   * Buyer answers a pushback with another price — the file goes back to the
   * agent, who can confirm it or come back once more. The loop continues
   * until one side agrees.
   */
  const raiseOffer = useCallback((id: string, price: number, note?: string) => {
    const cur = load();
    const at = new Date().toISOString();
    commit({
      ...cur,
      purchases: cur.purchases.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "buyer_raised" as const,
              raisedPrice: price,
              offerPrice: price,
              raisedAt: at,
              ...(note ? { buyerCounterNote: note } : {}),
              negotiation: [
                ...(p.negotiation ?? []),
                {
                  at,
                  by: "buyer" as const,
                  price,
                  ...(note ? { note } : {}),
                  kind: "counter" as const,
                },
              ],
            }
          : p,
      ),
    });
  }, []);

  /**
   * Buyer accepts the price the agent recommended. The agent already stands
   * behind that number, so the price is decided and goes to the seller.
   */
  const acceptAgentPrice = useCallback((id: string) => {
    const cur = load();
    const at = new Date().toISOString();
    commit({
      ...cur,
      purchases: cur.purchases.map((p) =>
        p.id === id
          ? {
              ...p,
              status: "price_supported" as const,
              offerPrice: p.agentSuggestedPrice ?? p.offerPrice,
              raisedPrice: p.agentSuggestedPrice ?? p.offerPrice,
              raisedAt: at,
              respondedAt: at,
              negotiation: [
                ...(p.negotiation ?? []),
                {
                  at,
                  by: "buyer" as const,
                  price: p.agentSuggestedPrice ?? p.offerPrice,
                  kind: "accepted" as const,
                },
              ],
            }
          : p,
      ),
    });
  }, []);

  const withdrawPurchase = useCallback((id: string) => {
    const cur = load();
    commit({
      ...cur,
      purchases: cur.purchases.map((p) =>
        p.id === id ? { ...p, status: "withdrawn" as const } : p,
      ),
    });
  }, []);

  /** Buyer asks for other properties, or names the one they picked. */
  const requestChange = useCallback(
    (input: Omit<ChangeRequest, "id" | "createdAt" | "status">) => {
      const cur = load();
      const entry: ChangeRequest = {
        ...input,
        id: uid(),
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      commit({ ...cur, changes: [...cur.changes, entry] });
      return entry;
    },
    [],
  );

  const acknowledgeChange = useCallback((id: string, note?: string) => {
    const cur = load();
    commit({
      ...cur,
      changes: cur.changes.map((c) =>
        c.id === id
          ? {
              ...c,
              status: "acknowledged" as const,
              respondedAt: new Date().toISOString(),
              ...(note ? { agentNote: note } : {}),
            }
          : c,
      ),
    });
  }, []);

  return {
    ...snapshot,
    requestPurchase,
    supportPrice,
    suggestHigherPrice,
    raiseOffer,
    acceptAgentPrice,
    withdrawPurchase,
    requestChange,
    acknowledgeChange,
  };
}

/** Everything on one file, newest first. */
export function useFileRequests(leadId: string) {
  const store = usePropertyRequests();
  const purchases = useMemo(
    () =>
      store.purchases
        .filter((p) => p.leadId === leadId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [store.purchases, leadId],
  );
  const changes = useMemo(
    () =>
      store.changes
        .filter((c) => c.leadId === leadId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [store.changes, leadId],
  );
  return { ...store, purchases, changes };
}

export const PURCHASE_STATUS_LABEL: Record<PurchaseRequestStatus, string> = {
  pending: "Waiting for your agent's price opinion",
  price_supported: "Price decided — your agent is presenting it to the seller",
  price_pushback: "Agent suggests a higher price",
  buyer_raised: "You raised your offer — with your agent",
  withdrawn: "Withdrawn",
};
