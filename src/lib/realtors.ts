/**
 * Realtor (buyer's agent) partner directory and the assignment engine that
 * picks an agent when a client accepts their pre-approval terms.
 *
 * Assignment criteria (in order):
 *   1. hard filter — approved by a Loqal admin
 *   2. hard filter — holds a valid (unexpired) license in the property state
 *   3. hard filter — not on vacation
 *   4. preference  — speaks a language the client speaks
 *   5. preference  — smallest active buyer pipeline
 */
import { useCallback, useSyncExternalStore } from "react";

export type RealtorLicense = {
  /** Two-letter state code. */
  state: string;
  number: string;
  /** ISO yyyy-mm-dd — optional, we only track validity. */
  issuedAt?: string;
  /** ISO yyyy-mm-dd — the license stops counting for assignment after this. */
  validUntil: string;
};

export type Realtor = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: { street: string; city: string; state: string; zip: string; country: string };
  licenses: RealtorLicense[];
  languages: string[];
  vacationFrom?: string;
  vacationUntil?: string;
  /** Empty while the registration is still waiting for Loqal admin approval. */
  approvedAt: string;
};

export const REALTOR_LANGUAGES = [
  "English",
  "Spanish",
  "Russian",
  "Portuguese",
  "French",
  "German",
  "Italian",
  "Mandarin",
  "Arabic",
  "Hindi",
  "Hebrew",
  "Ukrainian",
];

export function realtorName(r: Realtor) {
  return `${r.firstName} ${r.lastName}`.trim();
}

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Licensed in `state` with a license that is still valid today? */
export function realtorLicensedIn(r: Realtor, state: string, today = todayIso()) {
  return r.licenses.some((l) => l.state === state && l.validUntil >= today);
}

export function isRealtorOnVacation(r: Realtor, today = todayIso()) {
  return Boolean(r.vacationFrom && r.vacationUntil && today >= r.vacationFrom && today <= r.vacationUntil);
}

/** All states where the realtor currently holds a valid license. */
export function activeLicenseStates(r: Realtor, today = todayIso()) {
  return r.licenses.filter((l) => l.validUntil >= today).map((l) => l.state);
}

/* ------------------------------------------------------------------ store */

type RealtorState = { realtors: Realtor[] };

const STORAGE_KEY = "loqal.realtors.v2";
const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * No demo agents: the assignable pool is built exclusively from realtor
 * partners a Loqal admin has approved (their registration is synced into this
 * store on approval). Seed rows would otherwise win real assignments.
 */
const DEFAULT_STATE = (): RealtorState => ({ realtors: [] });

let state: RealtorState | null = null;
const listeners = new Set<() => void>();

function normalise(next: Partial<RealtorState>): RealtorState {
  return {
    realtors: (next.realtors ?? []).map((r) => ({
      ...r,
      licenses: r.licenses ?? [],
      languages: r.languages ?? [],
      approvedAt: r.approvedAt ?? "",
    })),
  };
}

function load(): RealtorState {
  if (state) return state;
  let next = DEFAULT_STATE();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = normalise(JSON.parse(raw) as Partial<RealtorState>);
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

/** Raw, non-hook accessor — used by leads.tsx when auto-assigning an agent. */
export function getRealtorSnapshot(): RealtorState {
  return load();
}

function commit(next: RealtorState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const SERVER_SNAPSHOT: RealtorState = { realtors: [] };

/* -------------------------------------------------------- assignment engine */

export type RealtorAssignContext = {
  /** Two-letter state of the property. */
  state: string;
  /** Languages the client speaks (best effort). */
  languages: string[];
  price: number;
};

/**
 * Pick the buyer's agent for a file. Licensed + approved + available agents
 * only; among them prefer a language match, then the lightest pipeline.
 */
export function pickRealtor(
  ctx: RealtorAssignContext,
  activeCounts: Record<string, number>,
  snapshot: RealtorState = load(),
): Realtor | null {
  const pool = snapshot.realtors.filter(
    (r) => r.approvedAt && realtorLicensedIn(r, ctx.state) && !isRealtorOnVacation(r),
  );
  if (!pool.length) return null;
  const scored = pool.map((r) => ({
    r,
    langMatch: ctx.languages.some((l) => r.languages.includes(l)) ? 1 : 0,
    load: activeCounts[r.id] ?? 0,
  }));
  scored.sort((a, b) => b.langMatch - a.langMatch || a.load - b.load);
  return scored[0]!.r;
}

/* ------------------------------------------------------------------- hook */

export function useRealtors() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );

  const addRealtor = useCallback((input: Omit<Realtor, "id"> & { id?: string }) => {
    const cur = load();
    if (cur.realtors.some((r) => r.email.toLowerCase() === input.email.toLowerCase())) {
      // Existing seat (e.g. self-provisioned at sign-in) gets upgraded in place.
      commit({
        realtors: cur.realtors.map((r) =>
          r.email.toLowerCase() === input.email.toLowerCase() ? { ...r, ...input, id: r.id } : r,
        ),
      });
      return;
    }
    commit({ realtors: [...cur.realtors, { ...input, id: input.id ?? uid() }] });
  }, []);

  const updateRealtor = useCallback((id: string, patch: Partial<Realtor>) => {
    const cur = load();
    commit({ realtors: cur.realtors.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }, []);

  /** Find the seat for a signed-in partner; create a pending one on first visit. */
  const ensureSeat = useCallback((email: string, firstName: string, lastName: string, phone: string) => {
    const cur = load();
    const existing = cur.realtors.find((r) => r.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing;
    const seat: Realtor = {
      id: uid(),
      firstName,
      lastName,
      email,
      phone,
      address: { street: "", city: "", state: "", zip: "", country: "US" },
      licenses: [],
      languages: ["English"],
      approvedAt: "",
    };
    commit({ realtors: [...cur.realtors, seat] });
    return seat;
  }, []);

  return { realtors: snapshot.realtors, addRealtor, updateRealtor, ensureSeat };
}
