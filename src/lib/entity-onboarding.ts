/**
 * Client-level (not property-level) ownership-structure intent.
 *
 * Every foreign national who joins Loqal is told the US market practice of
 * holding property in an LLC or a trust, and asked one of two things:
 *
 *  - they already have a US entity → we keep its details on file, so the
 *    purchase agreement and the closing can be prepared in the entity's name;
 *  - they want Loqal to structure it → they confirm our transparent terms and
 *    a Loqal entity manager is assigned.
 *
 * Kept per client e-mail (the property-level decision continues to live in
 * src/lib/entity-structure.ts, per file).
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

export type EntityIntent = {
  /** Lowercased client e-mail. */
  email: string;
  /** Client confirmed they already hold a US entity. */
  hasEntity?: boolean | undefined;
  entityName?: string | undefined;
  entityType?: string | undefined;
  entityState?: string | undefined;
  entityEin?: string | undefined;
  entityProvidedAt?: string | undefined;
  /** Client asked Loqal to structure the holding and accepted the terms. */
  supportRequestedAt?: string | undefined;
  termsAcceptedAt?: string | undefined;
  /** Client closed the tip — no longer shown on the dashboard. */
  dismissedAt?: string | undefined;
  createdAt: string;
  updatedAt: string;
};

type State = { intents: EntityIntent[] };

const STORAGE_KEY = "loqal.entityIntent.v1";
const EMPTY: State = { intents: [] };

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  let next = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { intents: (JSON.parse(raw) as Partial<State>).intents ?? [] };
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

export type EntityIntentPatch = {
  [K in keyof Omit<EntityIntent, "email" | "createdAt" | "updatedAt">]?:
    | EntityIntent[K]
    | undefined;
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useEntityIntent(email: string | undefined) {
  const snapshot = useSyncExternalStore(subscribe, () => load(), () => EMPTY);
  const key = (email ?? "").toLowerCase();

  const intent = useMemo(
    () => snapshot.intents.find((i) => i.email === key),
    [snapshot.intents, key],
  );

  const saveIntent = useCallback(
    (patch: EntityIntentPatch) => {
      if (!key) return;
      const cur = load();
      const now = new Date().toISOString();
      const existing = cur.intents.find((i) => i.email === key);
      const next: EntityIntent = existing
        ? { ...existing, ...patch, updatedAt: now }
        : { email: key, ...patch, createdAt: now, updatedAt: now };
      commit({
        intents: existing
          ? cur.intents.map((i) => (i.email === key ? next : i))
          : [...cur.intents, next],
      });
    },
    [key],
  );

  return { intent, saveIntent };
}

/** All intents — used by the Loqal team views. */
export function useEntityIntents() {
  const snapshot = useSyncExternalStore(subscribe, () => load(), () => EMPTY);
  return { intents: snapshot.intents };
}

/** Common US holding forms offered at this stage. */
export const ENTITY_TYPES = [
  "LLC",
  "Corporation (C-Corp)",
  "Revocable trust",
  "Irrevocable trust",
  "Limited partnership",
  "Other",
];
