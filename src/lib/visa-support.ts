/**
 * Loqal visa support requests — stored in the database so Loqal staff see them
 * on any device. Clients create their own request; admins move it through the
 * progress statuses, which the client sees on My Profile.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export const VISA_STATUSES = [
  "requested",
  "partner_contacted",
  "partner_confirmed",
  "file_passed_to_partner",
  "visa_preparation",
  "embassy_meeting",
  "awaiting_issuance",
  "visa_issued",
] as const;
/** Earlier statuses kept so older history entries still read correctly. */
type LegacyVisaStatus = "documents_in_preparation" | "appointment_booked";
export type VisaStatus = (typeof VISA_STATUSES)[number] | "not_possible" | LegacyVisaStatus;

export type VisaPartner = {
  company: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export const VISA_STATUS_LABEL: Record<VisaStatus, string> = {
  requested: "Request received",
  partner_contacted: "Visa partner contacted",
  partner_confirmed: "Partner confirmed they can assist",
  file_passed_to_partner: "File passed to the visa support partner",
  visa_preparation: "Preparations for the visa",
  embassy_meeting: "Meeting at the embassy",
  awaiting_issuance: "Awaiting visa issuance",
  documents_in_preparation: "Application documents in preparation",
  appointment_booked: "Embassy appointment booked",
  visa_issued: "Visa issued",
  not_possible: "Assistance not possible",
};

/** What the client reads for each status. */
export const VISA_STATUS_CLIENT_TEXT: Record<VisaStatus, string> = {
  requested: "We have your request and are identifying a visa partner in your country of residence.",
  partner_contacted: "We have contacted a trusted visa partner in your country of residence.",
  partner_confirmed: "Our partner confirmed they can assist. We will introduce them to you shortly.",
  file_passed_to_partner: "We have passed your file to our visa support partner. Loqal continues to coordinate all communication.",
  visa_preparation: "Your visa application is being prepared. We may ask you for a few details or documents.",
  embassy_meeting: "Your embassy / consulate meeting is scheduled — please attend in person.",
  awaiting_issuance: "The embassy meeting has taken place. We are awaiting the visa decision and issuance.",
  documents_in_preparation: "Your application documents are being prepared. We may ask you for a few details.",
  appointment_booked: "Your embassy / consulate appointment is booked — please attend in person.",
  visa_issued: "Your US visa has been issued. Please add its details to your profile.",
  not_possible: "Unfortunately our partner cannot assist with this application. We will contact you about alternatives.",
};

export type VisaHistoryEntry = { status: VisaStatus; at: string; by: string; note?: string };

export type VisaRequest = {
  id: string;
  userId: string;
  email: string;
  clientName: string;
  citizenship: string | null;
  countryOfResidence: string | null;
  status: VisaStatus;
  statusNote: string | null;
  visaPartner: VisaPartner | null;
  history: VisaHistoryEntry[];
  requestedAt: string;
  updatedAt: string;
};

export const isVisaOpen = (r: VisaRequest) => r.status !== "visa_issued" && r.status !== "not_possible";

/* eslint-disable @typescript-eslint/no-explicit-any */
const table = () => (supabase as any).from("visa_support_requests");

function map(r: any): VisaRequest {
  return {
    id: r.id,
    userId: r.user_id,
    email: r.email,
    clientName: r.client_name,
    citizenship: r.citizenship,
    countryOfResidence: r.country_of_residence,
    status: r.status,
    statusNote: r.status_note,
    visaPartner: r.visa_partner ?? null,
    history: Array.isArray(r.history) ? r.history : [],
    requestedAt: r.requested_at,
    updatedAt: r.updated_at,
  };
}

let items: VisaRequest[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refreshVisaRequests() {
  const { data, error } = await table().select("*").order("requested_at", { ascending: false });
  if (error) return;
  items = (data ?? []).map(map);
  loaded = true;
  emit();
}

let timer: ReturnType<typeof setInterval> | null = null;
export function useVisaRequests() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
  useEffect(() => {
    if (!loaded) void refreshVisaRequests();
    if (!timer) timer = setInterval(() => void refreshVisaRequests(), 30_000);
    const onFocus = () => void refreshVisaRequests();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  const update = useCallback(
    async (r: VisaRequest, status: VisaStatus, by: string, note?: string) => {
      const entry: VisaHistoryEntry = { status, at: new Date().toISOString(), by, ...(note ? { note } : {}) };
      const { error } = await table()
        .update({ status, status_note: note ?? null, history: [...r.history, entry] })
        .eq("id", r.id);
      if (error) throw error;
      await refreshVisaRequests();
    },
    [],
  );
  const setPartner = useCallback(async (r: VisaRequest, partner: VisaPartner | null) => {
    const { error } = await table().update({ visa_partner: partner }).eq("id", r.id);
    if (error) throw error;
    await refreshVisaRequests();
  }, []);
  return { requests: snap, update, setPartner };
}

/** Client side: create the request once (idempotent). */
export async function submitVisaRequest(input: {
  email: string;
  clientName: string;
  citizenship?: string | undefined;
  countryOfResidence?: string | undefined;
  requestedAt?: string | undefined;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data: existing } = await table().select("id").eq("user_id", u.user.id).maybeSingle();
  if (existing) return;
  const at = input.requestedAt ?? new Date().toISOString();
  await table().insert({
    user_id: u.user.id,
    email: input.email.toLowerCase(),
    client_name: input.clientName,
    citizenship: input.citizenship ?? null,
    country_of_residence: input.countryOfResidence ?? null,
    requested_at: at,
    history: [{ status: "requested", at, by: input.clientName }],
  });
  await refreshVisaRequests();
}
