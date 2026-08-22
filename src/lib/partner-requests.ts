/**
 * Partner & corporate registration requests. Every request submitted through
 * /partner-access lands here and stays pending until a Loqal admin approves
 * or declines it in the admin console. Approved realtors are promoted into
 * the realtor directory (src/lib/realtors.ts) and become assignable.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { PartnerType } from "@/lib/auth";
import type { RealtorLicense } from "@/lib/realtors";

export type PartnerRequestStatus = "pending" | "approved" | "declined";

export type PartnerRequest = {
  id: string;
  kind: "partner" | "corporate";
  partnerType?: PartnerType;
  companyName: string;
  companyType: string;
  registrationNumber: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  firstName: string;
  lastName: string;
  position: string;
  email: string;
  phone: string;
  allStates: boolean;
  states: string[];
  /** Mortgage lenders: NMLS / state licence number. */
  lenderLicence?: string;
  /** Realtors: one license per licensed state. */
  realtorLicenses?: RealtorLicense[];
  /** Realtors: languages they work in. */
  languages?: string[];
  submittedAt: string;
  status: PartnerRequestStatus;
  decidedAt?: string;
};

type RequestState = { requests: PartnerRequest[] };

const STORAGE_KEY = "loqal.partner.requests.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

let state: RequestState | null = null;
const listeners = new Set<() => void>();

function load(): RequestState {
  if (state) return state;
  let next: RequestState = { requests: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { requests: (JSON.parse(raw) as Partial<RequestState>).requests ?? [] };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: RequestState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const SERVER_SNAPSHOT: RequestState = { requests: [] };

export function usePartnerRequests() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );

  const submit = useCallback((input: Omit<PartnerRequest, "id" | "submittedAt" | "status">) => {
    const cur = load();
    commit({
      requests: [
        { ...input, id: uid(), submittedAt: new Date().toISOString(), status: "pending" },
        ...cur.requests,
      ],
    });
  }, []);

  const setStatus = useCallback((id: string, status: PartnerRequestStatus) => {
    const cur = load();
    commit({
      requests: cur.requests.map((r) =>
        r.id === id ? { ...r, status, decidedAt: new Date().toISOString() } : r,
      ),
    });
  }, []);

  return { requests: snapshot.requests, submit, setStatus };
}
