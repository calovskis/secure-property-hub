/**
 * Loqal company (holding structure) set-up requests — stored in the database so
 * Loqal staff see them on any device. The client's browser syncs its request
 * up (idempotent); admins move it through the statuses the client sees.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export const ENTITY_STATUSES = [
  "requested",
  "manager_assigned",
  "structure_agreed",
  "filing_submitted",
  "entity_formed",
] as const;
export type EntityStatus = (typeof ENTITY_STATUSES)[number];

export const ENTITY_STATUS_LABEL: Record<EntityStatus, string> = {
  requested: "Request received",
  manager_assigned: "Entity manager assigned",
  structure_agreed: "Structure agreed with the client",
  filing_submitted: "Formation filed with the state",
  entity_formed: "Entity formed — details on file",
};

export type EntityHistoryEntry = { status: EntityStatus; at: string; by: string; note?: string };

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
};

export const isEntityOpen = (r: EntitySetupRequest) => r.status !== "entity_formed";

/* eslint-disable @typescript-eslint/no-explicit-any */
const table = () => (supabase as any).from("entity_setup_requests");

function map(r: any): EntitySetupRequest {
  return {
    id: r.id,
    userId: r.user_id,
    email: r.email,
    clientName: r.client_name,
    propertyLabel: r.property_label,
    leadId: r.lead_id,
    status: r.status,
    statusNote: r.status_note,
    history: Array.isArray(r.history) ? r.history : [],
    requestedAt: r.requested_at,
    updatedAt: r.updated_at,
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
  const update = useCallback(
    async (r: EntitySetupRequest, status: EntityStatus, by: string, note?: string) => {
      const entry: EntityHistoryEntry = { status, at: new Date().toISOString(), by, ...(note ? { note } : {}) };
      const { error } = await table()
        .update({ status, status_note: note ?? null, history: [...r.history, entry] })
        .eq("id", r.id);
      if (error) throw error;
      await refreshEntityRequests();
    },
    [],
  );
  return { requests: snap, update };
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
