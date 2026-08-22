/**
 * Partner & corporate registration requests. Every request submitted through
 * /partner-access lands here and stays pending until a Loqal admin approves
 * or declines it in the admin console. Approved realtors are promoted into
 * the realtor directory (src/lib/realtors.ts) and become assignable.
 *
 * Lifecycle: submitted → (verification documents while pending) → approved →
 * partner signs the Loqal agreement → Loqal countersigns → fully active.
 */
import { useCallback, useSyncExternalStore } from "react";
import type { PartnerType } from "@/lib/auth";
import type { RealtorLicense } from "@/lib/realtors";

export type PartnerRequestStatus = "pending" | "approved" | "declined";

/** A person declared in the corporate KYB questionnaire (director / shareholder). */
export type KycPerson = {
  fullName: string;
  address: string;
  citizenship: string;
  countryOfResidence: string;
  /** Shareholders only — we must know every owner of 25% or more. */
  sharePct?: number;
  /** Uploaded ID document (file name). */
  idDoc?: string;
};

/** Corporate / non-realtor partner KYB questionnaire. */
export type KycInfo = {
  director: KycPerson;
  /** true → the profile creator is the director. */
  directorIsCreator: boolean;
  shareholders: KycPerson[];
  /**
   * true → the profile creator is neither director nor shareholder and
   * confirmed they hold an authorization to act for the company.
   */
  creatorAuthorized: boolean;
  /** Uploaded ID of the profile creator (file name). */
  creatorIdDoc?: string;
  /** Uploaded PoA / authorization document (file name). */
  authorizationDoc?: string;
  submittedAt: string;
};

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
  /** Realtors: the brokerage's own license and switchboard number. */
  companyLicence?: string;
  companyPhone?: string;
  /** Partner-specific T&C accepted at registration. */
  tcAcceptedAt?: string;
  /** Verification documents uploaded while awaiting approval (file names). */
  verificationDocs: string[];
  /** Corporate / non-realtor partner KYB questionnaire. */
  kyc?: KycInfo;
  /** Loqal partnership agreement, signed by the partner after approval. */
  agreementSignedAt?: string;
  agreementSignedBy?: string;
  /** Countersigned by Loqal — the partnership is fully active. */
  agreementCountersignedAt?: string;
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
    if (raw) {
      const parsed = (JSON.parse(raw) as Partial<RequestState>).requests ?? [];
      next = {
        requests: parsed.map((r) => ({ ...r, verificationDocs: r.verificationDocs ?? [] })),
      };
    }
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

  const submit = useCallback(
    (input: Omit<PartnerRequest, "id" | "submittedAt" | "status" | "verificationDocs">) => {
      const cur = load();
      commit({
        requests: [
          {
            ...input,
            id: uid(),
            submittedAt: new Date().toISOString(),
            status: "pending",
            verificationDocs: [],
          },
          ...cur.requests,
        ],
      });
    },
    [],
  );

  const setStatus = useCallback((id: string, status: PartnerRequestStatus) => {
    const cur = load();
    commit({
      requests: cur.requests.map((r) =>
        r.id === id ? { ...r, status, decidedAt: new Date().toISOString() } : r,
      ),
    });
  }, []);

  const updateRequest = useCallback((id: string, patch: Partial<PartnerRequest>) => {
    const cur = load();
    commit({ requests: cur.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }, []);

  return { requests: snapshot.requests, submit, setStatus, updateRequest };
}
