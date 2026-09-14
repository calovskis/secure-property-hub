/**
 * Once the buyer's price is agreed with the buyer's agent and goes to the
 * seller, the buyer moves to signing the purchase agreement. Foreign national
 * purchases are typically completed through a US company/entity that holds the
 * property, so each file keeps the buyer's ownership-structure decision:
 *
 *  - do they already have a US entity, and do they want to buy through it;
 *  - if not, will they open the company themselves and share the details when
 *    ready, or should Loqal set the structure up;
 *  - whether the transparent Loqal fees were acknowledged, and whether the
 *    purchase agreement was signed.
 *
 * Kept per property file (leadId) so the buyer, the agent and the Loqal team
 * see the same state.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

/** One-time Loqal Managerial Set-up fee, USD. */
export const LOQAL_SETUP_FEE_USD = 500;
/** Transparent cap on all related third-party services, USD. */
export const RELATED_SERVICES_MAX_USD = 1000;

export type EntityPath =
  /** Buying through an entity the client already owns. */
  | "existing_entity"
  /** Client opens the company themselves and shares the details when ready. */
  | "own_setup"
  /** Loqal sets up the holding structure. */
  | "loqal_setup";

export const ENTITY_PATH_LABEL: Record<EntityPath, string> = {
  existing_entity: "Buying through your existing US entity",
  own_setup: "You are opening the company yourself",
  loqal_setup: "Loqal is setting up the holding structure",
};

export type EntityPlan = {
  leadId: string;
  /** Does the client already have a US entity? null = not answered yet. */
  hasEntity: boolean | null;
  /** When they have one — do they want to purchase through it? */
  useExisting?: boolean;
  entityName?: string;
  entityState?: string;
  entityEin?: string;
  path?: EntityPath;
  /** Client confirmed the Loqal set-up fees. */
  feesAcknowledgedAt?: string;
  /** Client opened the corporate-structure guide. */
  guideSeenAt?: string;
  /** Purchase agreement signed by the buyer. */
  agreementSignedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

type State = { plans: EntityPlan[] };

const STORAGE_KEY = "loqal.entityStructure.v1";
const EMPTY: State = { plans: [] };

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  let next = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { plans: (JSON.parse(raw) as Partial<State>).plans ?? [] };
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

export function useEntityPlan(leadId: string) {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => EMPTY,
  );

  const plan = useMemo(
    () => snapshot.plans.find((p) => p.leadId === leadId),
    [snapshot.plans, leadId],
  );

  const savePlan = useCallback(
    (patch: Partial<Omit<EntityPlan, "leadId" | "createdAt" | "updatedAt">>) => {
      const cur = load();
      const now = new Date().toISOString();
      const existing = cur.plans.find((p) => p.leadId === leadId);
      const next: EntityPlan = existing
        ? { ...existing, ...patch, updatedAt: now }
        : {
            leadId,
            hasEntity: null,
            ...patch,
            createdAt: now,
            updatedAt: now,
          };
      commit({
        plans: existing
          ? cur.plans.map((p) => (p.leadId === leadId ? next : p))
          : [...cur.plans, next],
      });
      return next;
    },
    [leadId],
  );

  return { plan, savePlan };
}

/** Why a foreign national is usually better off holding US property in a company. */
export const CORPORATE_STRUCTURE_GUIDE: { title: string; body: string }[] = [
  {
    title: "Liability stays with the property, not with you",
    body: "A company owns the property, so claims from tenants, contractors or accidents are directed at the entity and its insurance — not at your personal assets abroad.",
  },
  {
    title: "US estate tax exposure",
    body: "Property held directly by a foreign national can fall into the US estate tax net at a very low exemption. A properly chosen holding structure is the standard way to manage that exposure.",
  },
  {
    title: "Cleaner tax treatment of rental income",
    body: "An entity gives you a clear place to record rental income, expenses and depreciation, and makes the annual US filings predictable instead of improvised.",
  },
  {
    title: "Privacy in public records",
    body: "In most states the buyer's name appears in the deed and in public search results. With an entity, the company name appears instead of yours.",
  },
  {
    title: "Banking and payments actually work",
    body: "A US entity with its own bank account makes deposits, closing wires, utilities, HOA dues and property-management payouts straightforward — the usual pain point for a foreign buyer.",
  },
  {
    title: "Financing and future partners",
    body: "Lenders that work with foreign nationals commonly lend to an entity. It is also far easier to add a family member or co-investor by moving shares than by re-deeding the property.",
  },
  {
    title: "Selling and passing it on",
    body: "Selling the company, or transferring shares within the family, avoids much of the friction (and cost) of transferring the title itself.",
  },
];

/** Transparent breakdown of what a Loqal-managed set-up involves. */
export const SETUP_COST_LINES: { label: string; note: string }[] = [
  {
    label: "Loqal Managerial Set-up",
    note: `One-time fee of $${LOQAL_SETUP_FEE_USD} — we design the structure, coordinate every provider and keep you out of the paperwork.`,
  },
  {
    label: "Company formation & state filing fees",
    note: "State registration of the entity that will hold the property.",
  },
  {
    label: "Registered agent & EIN",
    note: "Required US address of record for the company and its federal tax number.",
  },
  {
    label: "US bank account opening",
    note: "Business account for the closing wire, rent and running costs.",
  },
];
