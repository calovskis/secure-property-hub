/**
 * Partner & corporate registration requests. Every request submitted through
 * /partner-access is stored in the database (table `partner_requests`) and
 * stays pending until a Loqal admin approves or declines it in the admin
 * console. Approved realtors are promoted into the realtor directory
 * (src/lib/realtors.ts) and become assignable.
 *
 * Access is enforced by row level security: a partner sees only their own
 * registration, admins see them all.
 *
 * Lifecycle: submitted → (verification documents while pending) → approved →
 * partner signs the Loqal agreement → Loqal countersigns → fully active.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
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

/**
 * Something Loqal asked the partner for while the registration is open:
 * either written information (optionally with documents) or a video call.
 */
export type PartnerAdminRequest = {
  id: string;
  kind: "info" | "call";
  message: string;
  /** Info requests only — the partner must attach a document. */
  requiresDocument?: boolean;
  requestedAt: string;
  requestedBy: string;
  /** Info requests — the partner's written reply. */
  answer?: string;
  answerDocs?: string[];
  answeredAt?: string;
  /** Call requests — the slot the partner booked. */
  scheduledAt?: string;
  meetUrl?: string | null;
};

/**
 * Realtor identity & licence verification — replaces the KYB questionnaire for
 * real estate agents. One identity document (driver's licence or passport) plus
 * one licence copy for every state declared at registration. Whenever a licence
 * number or validity date changes, Loqal must see a fresh copy, so the entry is
 * flagged and the old copy is dropped.
 */
export type RealtorLicenseDoc = {
  state: string;
  number: string;
  validUntil: string;
  /** Uploaded licence copy (file name). */
  doc?: string;
  uploadedAt?: string;
  /** Set when the number/validity changed and a new copy is required. */
  recopyRequestedAt?: string;
};

export type RealtorVerification = {
  identityType?: "drivers_license" | "passport";
  identityDoc?: string;
  identityUploadedAt?: string;
  licenseDocs: RealtorLicenseDoc[];
};

/**
 * Change to a name, surname or company name — those are on the Loqal
 * agreement, so an admin approves them before they take effect.
 */
export type ProfileChangeRequest = {
  id: string;
  field: "firstName" | "lastName" | "companyName";
  label: string;
  currentValue: string;
  requestedValue: string;
  requestedAt: string;
  status: "pending" | "approved" | "declined";
  decidedAt?: string;
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
  /** Information / video-call requests raised by a Loqal admin. */
  adminRequests: PartnerAdminRequest[];
  /** Realtors: identity document + one licence copy per licensed state. */
  realtorVerification?: RealtorVerification;
  /** Name / surname / company name edits awaiting a Loqal admin decision. */
  profileChangeRequests: ProfileChangeRequest[];
  /** Loqal partnership agreement, signed by the partner after approval. */
  agreementSignedAt?: string;
  agreementSignedBy?: string;
  /** Countersigned by Loqal — the partnership is fully active. */
  agreementCountersignedAt?: string;
  submittedAt: string;
  status: PartnerRequestStatus;
  decidedAt?: string;
};

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

function fromRow(r: Row): PartnerRequest {
  const s = (v: unknown) => (typeof v === "string" ? v : undefined);
  const out = {
    id: String(r["id"]),
    kind: (s(r["kind"]) as PartnerRequest["kind"]) ?? "partner",
    partnerType: s(r["partner_type"]) as PartnerType | undefined,
    companyName: s(r["company_name"]) ?? "",
    companyType: s(r["company_type"]) ?? "",
    registrationNumber: s(r["registration_number"]) ?? "",
    street: s(r["street"]) ?? "",
    city: s(r["city"]) ?? "",
    state: s(r["state"]) ?? "",
    zip: s(r["zip"]) ?? "",
    country: s(r["country"]) ?? "",
    firstName: s(r["first_name"]) ?? "",
    lastName: s(r["last_name"]) ?? "",
    position: s(r["position"]) ?? "",
    email: s(r["email"]) ?? "",
    phone: s(r["phone"]) ?? "",
    allStates: Boolean(r["all_states"]),
    states: (r["states"] as string[] | null) ?? [],
    lenderLicence: s(r["lender_licence"]),
    realtorLicenses: (r["realtor_licenses"] as RealtorLicense[] | null) ?? [],
    languages: (r["languages"] as string[] | null) ?? [],
    companyLicence: s(r["company_licence"]),
    companyPhone: s(r["company_phone"]),
    tcAcceptedAt: s(r["tc_accepted_at"]),
    verificationDocs: (r["verification_docs"] as string[] | null) ?? [],
    kyc: (r["kyc"] as KycInfo | null) ?? undefined,
    adminRequests: (r["admin_requests"] as PartnerAdminRequest[] | null) ?? [],
    agreementSignedAt: s(r["agreement_signed_at"]),
    agreementSignedBy: s(r["agreement_signed_by"]),
    agreementCountersignedAt: s(r["agreement_countersigned_at"]),
    submittedAt: s(r["submitted_at"]) ?? new Date().toISOString(),
    status: (s(r["status"]) as PartnerRequestStatus) ?? "pending",
    decidedAt: s(r["decided_at"]),
  };
  return out as PartnerRequest;
}

const COLUMN: Record<string, string> = {
  kind: "kind",
  partnerType: "partner_type",
  companyName: "company_name",
  companyType: "company_type",
  registrationNumber: "registration_number",
  street: "street",
  city: "city",
  state: "state",
  zip: "zip",
  country: "country",
  firstName: "first_name",
  lastName: "last_name",
  position: "position",
  email: "email",
  phone: "phone",
  allStates: "all_states",
  states: "states",
  lenderLicence: "lender_licence",
  realtorLicenses: "realtor_licenses",
  languages: "languages",
  companyLicence: "company_licence",
  companyPhone: "company_phone",
  tcAcceptedAt: "tc_accepted_at",
  verificationDocs: "verification_docs",
  kyc: "kyc",
  adminRequests: "admin_requests",
  agreementSignedAt: "agreement_signed_at",
  agreementSignedBy: "agreement_signed_by",
  agreementCountersignedAt: "agreement_countersigned_at",
  status: "status",
  decidedAt: "decided_at",
  submittedAt: "submitted_at",
};

function toRow(patch: Partial<PartnerRequest>): Row {
  const row: Row = {};
  for (const [key, value] of Object.entries(patch)) {
    const col = COLUMN[key];
    if (!col || value === undefined) continue;
    row[col] = value;
  }
  return row;
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

let requests: PartnerRequest[] = [];
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setRequests(next: PartnerRequest[]) {
  requests = next;
  emit();
}

export async function refreshPartnerRequests() {
  const { data, error } = await supabase
    .from("partner_requests")
    .select("*")
    .order("submitted_at", { ascending: false });
  if (error) {
    console.error("partner_requests load failed", error.message);
    return;
  }
  loaded = true;
  setRequests(((data ?? []) as Row[]).map(fromRow));
}

function ensureLoaded() {
  if (loaded || loading) return;
  loading = refreshPartnerRequests().finally(() => {
    loading = null;
  });
}

const SERVER_SNAPSHOT: PartnerRequest[] = [];

export function usePartnerRequests() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => requests,
    () => SERVER_SNAPSHOT,
  );

  useEffect(() => {
    ensureLoaded();
  }, []);

  const submit = useCallback(
    async (input: Omit<PartnerRequest, "id" | "submittedAt" | "status" | "verificationDocs" | "adminRequests">) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("You must be signed in to submit a registration.");
      const { data, error } = await supabase
        .from("partner_requests")
        .insert({ ...toRow(input), user_id: userId, status: "pending" } as never)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      setRequests([fromRow(data as Row), ...requests]);
    },
    [],
  );

  const setStatus = useCallback(async (id: string, status: PartnerRequestStatus) => {
    const decidedAt = new Date().toISOString();
    setRequests(requests.map((r) => (r.id === id ? { ...r, status, decidedAt } : r)));
    const { error } = await supabase
      .from("partner_requests")
      .update({ status, decided_at: decidedAt } as never)
      .eq("id", id);
    if (error) console.error("partner_requests update failed", error.message);
  }, []);

  const updateRequest = useCallback(async (id: string, patch: Partial<PartnerRequest>) => {
    setRequests(requests.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase
      .from("partner_requests")
      .update(toRow(patch) as never)
      .eq("id", id);
    if (error) console.error("partner_requests update failed", error.message);
  }, []);

  return { requests: snapshot, submit, setStatus, updateRequest, refresh: refreshPartnerRequests };
}
