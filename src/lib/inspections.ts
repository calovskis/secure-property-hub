/**
 * Inspection requests: after the purchase agreement is signed, the buyer sends
 * the inspections agreed in the terms to Loqal's inspection partners. Approved
 * inspection companies covering the property's state see the open job and can
 * accept it with a fee and proposed date; they then schedule and upload the
 * report. Stored in `inspection_requests`; access is enforced server-side.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type InspectionStatus = "open" | "accepted" | "scheduled" | "report_uploaded" | "completed" | "cancelled";

export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  open: "Looking for an inspector",
  accepted: "Inspector assigned",
  scheduled: "Inspection scheduled",
  report_uploaded: "Report ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type InspectionReport = { path: string; name: string; uploadedAt: string };

export type InspectionRequest = {
  id: string;
  leadId: string;
  clientEmail: string;
  clientLabel: string;
  agentEmail?: string | null;
  propertyLabel: string;
  state: string;
  propertyCategory: string;
  inspectionTypes: string[];
  deadlineDays?: number | null;
  agreementSignedAt?: string | null;
  status: InspectionStatus;
  inspectorCompany?: string | null;
  inspectorUserId?: string | null;
  inspectorContact?: { name?: string; phone?: string; email?: string } | null;
  fee?: number | null;
  proposedAt?: string | null;
  scheduledAt?: string | null;
  reportFiles: InspectionReport[];
  createdAt: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any> & { [k: string]: any };
const fromRow = (r: any): InspectionRequest => ({
  id: String(r.id),
  leadId: String(r.lead_id),
  clientEmail: String(r.client_email ?? ""),
  clientLabel: String(r.client_label ?? ""),
  agentEmail: (r.agent_email as string | null) ?? null,
  propertyLabel: String(r.property_label ?? ""),
  state: String(r.state ?? ""),
  propertyCategory: String(r.property_category ?? "house"),
  inspectionTypes: (r.inspection_types as string[] | null) ?? [],
  deadlineDays: (r.deadline_days as number | null) ?? null,
  agreementSignedAt: (r.agreement_signed_at as string | null) ?? null,
  status: (r.status as InspectionStatus) ?? "open",
  inspectorCompany: (r.inspector_company as string | null) ?? null,
  inspectorUserId: (r.inspector_user_id as string | null) ?? null,
  inspectorContact: (r.inspector_contact as InspectionRequest["inspectorContact"]) ?? null,
  fee: r.fee == null ? null : Number(r.fee),
  proposedAt: (r.proposed_at as string | null) ?? null,
  scheduledAt: (r.scheduled_at as string | null) ?? null,
  reportFiles: (r.report_files as InspectionReport[] | null) ?? [],
  createdAt: String(r.created_at),
});

const db = () => supabase.from("inspection_requests" as never) as unknown as ReturnType<typeof supabase.from>;

/** Requests visible to the signed-in user (own, assigned, or open in their states). */
export function useInspectionRequests(leadId?: string) {
  const [items, setItems] = useState<InspectionRequest[]>([]);
  const [ready, setReady] = useState(false);
  const refresh = useCallback(async () => {
    let q = db().select("*").order("created_at", { ascending: false });
    if (leadId) q = q.eq("lead_id", leadId);
    const { data, error } = await q;
    if (error) console.error("inspection_requests load failed", error.message);
    setItems(((data ?? []) as Row[]).map(fromRow));
    setReady(true);
  }, [leadId]);
  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 20000);
    return () => clearInterval(t);
  }, [refresh]);
  return { items, ready, refresh };
}

export async function createInspectionRequest(input: {
  leadId: string; clientEmail: string; clientLabel: string; agentEmail?: string | undefined; propertyId?: string | undefined;
  propertyLabel: string; state: string; propertyCategory: string; inspectionTypes: string[]; deadlineDays?: number | undefined; agreementSignedAt?: string | undefined;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Please sign in again.");
  const now = new Date().toISOString();
  const { data, error } = await db().insert({
    lead_id: input.leadId, client_user_id: u.user.id, client_email: input.clientEmail.toLowerCase(), client_label: input.clientLabel,
    agent_email: input.agentEmail?.toLowerCase() ?? null, property_id: input.propertyId ?? null, property_label: input.propertyLabel,
    state: input.state, property_category: input.propertyCategory, inspection_types: input.inspectionTypes,
    deadline_days: input.deadlineDays ?? null, agreement_signed_at: input.agreementSignedAt ?? null, status: "open",
    history: [{ status: "open", at: now, by: input.clientLabel }],
  } as never).select("*").single();
  if (error) throw new Error(error.message);
  return fromRow(data as Row);
}

export async function acceptInspection(id: string, fee: number, proposedAt: string, contact: InspectionRequest["inspectorContact"]) {
  const { error } = await supabase.rpc("accept_inspection_request" as never, { _id: id, _fee: fee, _proposed_at: proposedAt, _contact: contact } as never);
  if (error) throw new Error(error.message);
}

export async function updateInspection(id: string, patch: Row) {
  const { error } = await db().update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function uploadInspectionReport(req: InspectionRequest, file: File) {
  const path = `${req.id}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
  const { error } = await supabase.storage.from("inspection-reports").upload(path, file);
  if (error) throw new Error(error.message);
  const reportFiles = [...req.reportFiles, { path, name: file.name, uploadedAt: new Date().toISOString() }];
  await updateInspection(req.id, { report_files: reportFiles, status: "report_uploaded" });
}

export async function downloadInspectionReport(r: InspectionReport) {
  const { data, error } = await supabase.storage.from("inspection-reports").createSignedUrl(r.path, 120, { download: r.name });
  if (error || !data) throw new Error(error?.message ?? "Download failed");
  window.open(data.signedUrl, "_blank", "noopener");
}
