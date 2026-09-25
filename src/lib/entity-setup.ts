/**
 * Loqal company (holding structure) set-up requests — stored in the database so
 * Loqal staff see them on any device. The client's browser syncs its request
 * up (idempotent); admins assign an entity manager, send an entity
 * recommendation and move the case through the statuses the client sees.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notifications";

export const ENTITY_STATUSES = [
  "requested",
  "manager_assigned",
  "recommendation_preparing",
  "recommendation_sent",
  "structure_agreed",
  "documents_collection",
  "filing_submitted",
  "ein_application",
  "bank_account",
  "entity_formed",
] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const ENTITY_STATUS_LABEL: Record<EntityStatus, string> = {
  requested: "Request received — assigning your entity manager",
  manager_assigned: "Entity manager assigned",
  recommendation_preparing: "Entity recommendation in preparation",
  recommendation_sent: "Recommendation sent — awaiting your review",
  structure_agreed: "Structure agreed with the client",
  documents_collection: "Collecting formation documents & signatures",
  filing_submitted: "Formation filed with the state",
  ein_application: "EIN (tax ID) application submitted",
  bank_account: "Business bank account being opened",
  entity_formed: "Entity formed — details on file",
};

/** Statuses a Loqal employee picks manually; the rest follow actions. */
export const MANUAL_ENTITY_STATUSES: EntityStatus[] = [
  "recommendation_preparing",
  "structure_agreed",
  "documents_collection",
  "filing_submitted",
  "ein_application",
  "bank_account",
  "entity_formed",
];

export type EntityHistoryEntry = { status: EntityStatus; at: string; by: string; note?: string };

export type EntityManager = {
  id: string;
  name: string;
  email: string;
  title: string;
  phone?: string;
  assignedAt: string;
  assignedBy: string;
};

export type EntityOwner = { name: string; percent: string; role: string };

/** Loqal's written entity recommendation for the client. */
export type EntityRecommendation = {
  entityType: string;
  formationState: string;
  entityName: string;
  foreignQualification: boolean;
  foreignQualificationState: string;
  whyThisStructure: string;
  registeredAgent: string;
  registeredAgentState: string;
  registeredAgentFee: string;
  owners: EntityOwner[];
  management: "member_managed" | "manager_managed" | "";
  managers: string;
  operatingAgreement: string;
  separateHolding: "yes" | "no" | "";
  holdingStructure: string;
  holdingReason: string;
  vesting: string;
  lenderNote: string;
  tax: string[];
  legal: string[];
  taxNotes: string;
  formationCost: string;
  annualCost: string;
  timeline: string;
  documentsNeeded: string;
  additionalNotes: string;
};

export type RecommendationSent = EntityRecommendation & { version: number; sentAt: string; sentBy: string };

export type RecommendationResponse = {
  decision: "confirmed" | "changes";
  at: string;
  items?: { key: string; label: string; note: string }[];
  note?: string;
};

export type EntitySetupRequest = {
  id: string;
  userId: string;
  email: string;
  clientName: string;
  propertyLabel: string | null;
  leadId: string | null;
  status: EntityStatus;
  statusNote: string | null;
  history: EntityHistoryEntry[];
  requestedAt: string;
  updatedAt: string;
  manager: EntityManager | null;
  recommendation: RecommendationSent | null;
  response: RecommendationResponse | null;
  recommendationHistory: { recommendation: RecommendationSent; response: RecommendationResponse | null }[];
};

export const isEntityOpen = (r: EntitySetupRequest) => r.status !== "entity_formed";

/* eslint-disable @typescript-eslint/no-explicit-any */
const table = () => (supabase as any).from("entity_setup_requests");

function map(r: any): EntitySetupRequest {
  const legacy: Record<string, EntityStatus> = {};
  return {
    id: r.id,
    userId: r.user_id,
    email: r.email,
    clientName: r.client_name,
    propertyLabel: r.property_label,
    leadId: r.lead_id,
    status: (ENTITY_STATUSES as readonly string[]).includes(r.status) ? r.status : (legacy[r.status] ?? "requested"),
    statusNote: r.status_note,
    history: Array.isArray(r.history) ? r.history : [],
    requestedAt: r.requested_at,
    updatedAt: r.updated_at,
    manager: r.manager ?? null,
    recommendation: r.recommendation ?? null,
    response: r.recommendation_response ?? null,
    recommendationHistory: Array.isArray(r.recommendation_history) ? r.recommendation_history : [],
  };
}

let items: EntitySetupRequest[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refreshEntityRequests() {
  const { data, error } = await table().select("*").order("requested_at", { ascending: false });
  if (error) return;
  items = (data ?? []).map(map);
  loaded = true;
  emit();
}

const entry = (status: EntityStatus, by: string, note?: string): EntityHistoryEntry => ({
  status,
  at: new Date().toISOString(),
  by,
  ...(note ? { note } : {}),
});

let timer: ReturnType<typeof setInterval> | null = null;
export function useEntityRequests() {
  const snap = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
  useEffect(() => {
    if (!loaded) void refreshEntityRequests();
    if (!timer) timer = setInterval(() => void refreshEntityRequests(), 30_000);
    const onFocus = () => void refreshEntityRequests();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const update = useCallback(async (r: EntitySetupRequest, status: EntityStatus, by: string, note?: string) => {
    const { error } = await table()
      .update({ status, status_note: note ?? null, history: [...r.history, entry(status, by, note)] })
      .eq("id", r.id);
    if (error) throw error;
    notify({
      id: `entity-status-${r.id}-${status}-${Date.now()}`,
      to: r.email,
      title: "Company set-up — progress update",
      body: `${ENTITY_STATUS_LABEL[status]}${note ? ` — ${note}` : ""}`,
      href: "/profile?focus=entity",
      severity: "info",
    });
    await refreshEntityRequests();
  }, []);

  const assignManager = useCallback(
    async (r: EntitySetupRequest, m: Omit<EntityManager, "assignedAt" | "assignedBy">, by: string) => {
      const manager: EntityManager = { ...m, assignedAt: new Date().toISOString(), assignedBy: by };
      const advance = r.status === "requested";
      const status: EntityStatus = advance ? "manager_assigned" : r.status;
      const { error } = await table()
        .update({
          manager,
          status,
          history: [...r.history, entry("manager_assigned", by, `${m.name} is leading the company set-up`)],
        })
        .eq("id", r.id);
      if (error) throw error;
      notify({
        id: `entity-manager-${r.id}-${m.id}`,
        to: r.email,
        title: "Your entity manager is assigned",
        body: `${m.name} (${m.title}) now leads your company set-up and is in your Loqal team.`,
        href: "/",
        severity: "info",
      });
      await refreshEntityRequests();
    },
    [],
  );

  const sendRecommendation = useCallback(async (r: EntitySetupRequest, rec: EntityRecommendation, by: string) => {
    const version = (r.recommendation?.version ?? 0) + 1;
    const sent: RecommendationSent = { ...rec, version, sentAt: new Date().toISOString(), sentBy: by };
    const history = r.recommendation
      ? [...r.recommendationHistory, { recommendation: r.recommendation, response: r.response }]
      : r.recommendationHistory;
    const { error } = await table()
      .update({
        recommendation: sent,
        recommendation_response: null,
        recommendation_history: history,
        status: "recommendation_sent",
        history: [...r.history, entry("recommendation_sent", by, version > 1 ? `Revised recommendation (v${version})` : undefined)],
      })
      .eq("id", r.id);
    if (error) throw error;
    notify({
      id: `entity-rec-${r.id}-v${version}`,
      to: r.email,
      title: version > 1 ? "Revised entity recommendation" : "Your entity recommendation is ready",
      body: `${rec.entityType} in ${rec.formationState} — please review and confirm.`,
      href: "/profile?focus=entity&open=entity-recommendation",
      severity: "warning",
    });
    await refreshEntityRequests();
  }, []);

  return { requests: snap, update, assignManager, sendRecommendation };
}

/** Client side: confirm or ask for changes to the recommendation. */
export async function respondToRecommendation(r: EntitySetupRequest, response: RecommendationResponse) {
  const { error } = await (supabase as any).rpc("respond_entity_recommendation", { _id: r.id, _response: response });
  if (error) throw error;
  notify({
    id: `entity-rec-answer-${r.id}-${r.recommendation?.version}`,
    to: "admins",
    title:
      response.decision === "confirmed"
        ? `Entity recommendation confirmed — ${r.clientName}`
        : `Changes requested on the entity recommendation — ${r.clientName}`,
    body: response.items?.map((i) => `${i.label}: ${i.note}`).join(" · ") || response.note || "",
    href: `/admin?tab=cases&case=entity&focus=${r.id}`,
    severity: response.decision === "confirmed" ? "info" : "warning",
  });
  await refreshEntityRequests();
}

const synced = new Set<string>();
/** Client side: create the request once (idempotent per user). */
export async function submitEntityRequest(input: {
  email: string;
  clientName: string;
  propertyLabel?: string | undefined;
  leadId?: string | undefined;
  requestedAt?: string | undefined;
}) {
  const email = input.email.toLowerCase();
  if (synced.has(email)) return;
  synced.add(email);
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data: existing } = await table().select("id").eq("user_id", u.user.id).maybeSingle();
  if (existing) return;
  const at = input.requestedAt ?? new Date().toISOString();
  await table().insert({
    user_id: u.user.id,
    email,
    client_name: input.clientName,
    property_label: input.propertyLabel ?? null,
    lead_id: input.leadId ?? null,
    requested_at: at,
    history: [{ status: "requested", at, by: input.clientName }],
  });
  await refreshEntityRequests();
}

/** The signed-in client's own company set-up case (if any). */
export function useMyEntityCase(email: string | undefined) {
  const { requests } = useEntityRequests();
  return email ? requests.find((r) => r.email === email.toLowerCase()) : undefined;
}
