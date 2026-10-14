/**
 * Inspection requests: after the purchase agreement is signed, the buyer sends
 * the inspections agreed in the terms to Loqal's inspection partners. Approved
 * inspection companies covering the property's state see the open job and can
 * accept it with a fee and proposed date; they then schedule and upload the
 * report. Stored in `inspection_requests`; access is enforced server-side.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type InspectionStatus = "open" | "awaiting_client" | "accepted" | "scheduled" | "report_uploaded" | "completed" | "cancelled";

export const INSPECTION_STATUS_LABEL: Record<InspectionStatus, string> = {
  open: "Collecting offers",
  awaiting_client: "Awaiting your confirmation",
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
  /** Requested by the buyer on top of the signed agreement — no contractual rights against the seller. */
  outsideAgreement: boolean;
  clientNote?: string | null;
  propertyId?: string | null;
  offersDueAt?: string | null;
  selectedOfferId?: string | null;
  agentNote?: string | null;
  clientConfirmedAt?: string | null;
  invoices: InspectionInvoice[];
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
  outsideAgreement: Boolean(r.outside_agreement),
  clientNote: (r.client_note as string | null) ?? null,
  propertyId: (r.property_id as string | null) ?? null,
  offersDueAt: (r.offers_due_at as string | null) ?? null,
  selectedOfferId: (r.selected_offer_id as string | null) ?? null,
  agentNote: (r.agent_note as string | null) ?? null,
  clientConfirmedAt: (r.client_confirmed_at as string | null) ?? null,
  invoices: (r.invoices as InspectionInvoice[] | null) ?? [],
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
  outsideAgreement?: boolean | undefined; clientNote?: string | undefined;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Please sign in again.");
  const now = new Date().toISOString();
  const { data, error } = await db().insert({
    lead_id: input.leadId, client_user_id: u.user.id, client_email: input.clientEmail.toLowerCase(), client_label: input.clientLabel,
    agent_email: input.agentEmail?.toLowerCase() ?? null, property_id: input.propertyId ?? null, property_label: input.propertyLabel,
    state: input.state, property_category: input.propertyCategory, inspection_types: input.inspectionTypes,
    deadline_days: input.deadlineDays ?? null, agreement_signed_at: input.agreementSignedAt ?? null, status: "open",
    outside_agreement: Boolean(input.outsideAgreement), client_note: input.clientNote?.trim() || null,
    client_acknowledged_at: input.outsideAgreement ? now : null,
    history: [{ status: "open", at: now, by: input.clientLabel, ...(input.outsideAgreement ? { note: "Additional inspection outside the purchase agreement; buyer acknowledged no claim against the seller" } : {}) }],
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

/* ---------- Offers: inspectors quote, the buyer's agent recommends, the client confirms ---------- */

export type InspectionInvoice = {
  number: string; kind: "inspection_service" | "loqal_fee"; issuedAt: string;
  from: { name: string; email?: string; phone?: string }; to: { name: string; email?: string };
  description: string; amount: number; payableTo: string; due: string;
};

export type InspectionOffer = {
  id: string; requestId: string; inspectorUserId: string; company: string;
  contact: { name?: string; phone?: string; email?: string } | null;
  price: number; visitSlots: string[]; visitFlexible: boolean; reportDays: number; note?: string | null;
  status: "submitted" | "selected" | "not_selected" | "withdrawn"; createdAt: string;
};

const offerFrom = (r: Row): InspectionOffer => ({
  id: String(r.id), requestId: String(r.request_id), inspectorUserId: String(r.inspector_user_id), company: String(r.company ?? ""),
  contact: r.contact ?? null, price: Number(r.price), visitSlots: (r.visit_slots as string[]) ?? [], visitFlexible: Boolean(r.visit_flexible),
  reportDays: Number(r.report_days), note: r.note ?? null, status: r.status, createdAt: String(r.created_at),
});
const offersDb = () => supabase.from("inspection_offers" as never) as unknown as ReturnType<typeof supabase.from>;

/** Offers visible to the caller (own offers, or all offers when agent/client/admin). */
export function useInspectionOffers(requestIds: string[]) {
  const key = requestIds.slice().sort().join(",");
  const [offers, setOffers] = useState<InspectionOffer[]>([]);
  const refresh = useCallback(async () => {
    if (!key) { setOffers([]); return; }
    const { data, error } = await offersDb().select("*").in("request_id", key.split(",")).order("price", { ascending: true });
    if (error) console.error("inspection_offers load failed", error.message);
    setOffers(((data ?? []) as Row[]).map(offerFrom));
  }, [key]);
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 20000); return () => clearInterval(t); }, [refresh]);
  return { offers, refresh };
}

export async function submitInspectionOffer(input: {
  requestId: string; partnerRequestId?: string | undefined; company: string; contact: InspectionOffer["contact"];
  price: number; visitSlots: string[]; visitFlexible: boolean; reportDays: number; note?: string | undefined; existingId?: string | undefined;
}) {
  const row = {
    request_id: input.requestId, partner_request_id: input.partnerRequestId ?? null, company: input.company, contact: input.contact,
    price: input.price, visit_slots: input.visitSlots, visit_flexible: input.visitFlexible, report_days: input.reportDays, note: input.note?.trim() || null,
  };
  const { error } = input.existingId
    ? await offersDb().update(row as never).eq("id", input.existingId)
    : await offersDb().insert(row as never);
  if (error) throw new Error(error.message);
}

export async function selectInspectionOffer(offerId: string, note: string) {
  const { error } = await supabase.rpc("select_inspection_offer" as never, { _offer_id: offerId, _note: note } as never);
  if (error) throw new Error(error.message);
}

export async function confirmInspectionOffer(requestId: string) {
  const { error } = await supabase.rpc("confirm_inspection_offer" as never, { _request_id: requestId } as never);
  if (error) throw new Error(error.message);
}

export type AgentContact = { email: string; name: string; company: string; phone: string };
export async function fetchAgentContact(requestId: string): Promise<AgentContact | null> {
  const { data } = await supabase.rpc("inspection_agent_contact" as never, { _request_id: requestId } as never);
  return (data as AgentContact | null) ?? null;
}

/* ---------- Inspector ↔ buyer's agent thread (one per inspector per request) ---------- */

export type InspectionMessage = {
  id: string; requestId: string; inspectorUserId: string; inspectorEmail: string; fromSide: "inspector" | "agent";
  authorName: string; body: string; callSlots: string[]; chosenSlot?: string | null; createdAt: string;
};
const msgDb = () => supabase.from("inspection_messages" as never) as unknown as ReturnType<typeof supabase.from>;
const msgFrom = (r: Row): InspectionMessage => ({
  id: String(r.id), requestId: String(r.request_id), inspectorUserId: String(r.inspector_user_id), inspectorEmail: String(r.inspector_email ?? ""),
  fromSide: r.from_side, authorName: String(r.author_name ?? ""), body: String(r.body ?? ""), callSlots: (r.call_slots as string[]) ?? [],
  chosenSlot: r.chosen_slot ?? null, createdAt: String(r.created_at),
});

export function useInspectionMessages(requestId: string, inspectorUserId?: string) {
  const [messages, setMessages] = useState<InspectionMessage[]>([]);
  const refresh = useCallback(async () => {
    let q = msgDb().select("*").eq("request_id", requestId).order("created_at", { ascending: true });
    if (inspectorUserId) q = q.eq("inspector_user_id", inspectorUserId);
    const { data } = await q;
    setMessages(((data ?? []) as Row[]).map(msgFrom));
  }, [requestId, inspectorUserId]);
  useEffect(() => { void refresh(); const t = setInterval(() => void refresh(), 15000); return () => clearInterval(t); }, [refresh]);
  return { messages, refresh };
}

export async function sendInspectionMessage(input: {
  requestId: string; inspectorUserId: string; inspectorEmail: string; fromSide: "inspector" | "agent"; authorName: string; body: string; callSlots?: string[];
}) {
  const { error } = await msgDb().insert({
    request_id: input.requestId, inspector_user_id: input.inspectorUserId, inspector_email: input.inspectorEmail.toLowerCase(),
    from_side: input.fromSide, author_name: input.authorName, body: input.body, call_slots: input.callSlots ?? [],
  } as never);
  if (error) throw new Error(error.message);
}

export async function chooseCallSlot(messageId: string, slot: string) {
  const { error } = await msgDb().update({ chosen_slot: slot } as never).eq("id", messageId);
  if (error) throw new Error(error.message);
}

/* ---------- Invoice PDF ---------- */

export async function downloadInspectionInvoice(inv: InspectionInvoice) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const d = new Date(inv.issuedAt);
  const date = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  doc.setFontSize(18); doc.text("INVOICE", 20, 24);
  doc.setFontSize(10);
  doc.text(`Invoice no. ${inv.number}`, 20, 34); doc.text(`Issued ${date}`, 20, 40);
  doc.setFontSize(11); doc.text("From", 20, 54); doc.text("Bill to", 110, 54);
  doc.setFontSize(10);
  [inv.from.name, inv.from.email, inv.from.phone].filter(Boolean).forEach((l, i) => doc.text(String(l), 20, 61 + i * 6));
  [inv.to.name, inv.to.email].filter(Boolean).forEach((l, i) => doc.text(String(l), 110, 61 + i * 6));
  doc.line(20, 86, 190, 86);
  doc.text(doc.splitTextToSize(inv.description, 130) as string[], 20, 94);
  doc.text(money(inv.amount), 190, 94, { align: "right" });
  doc.line(20, 110, 190, 110);
  doc.setFontSize(12); doc.text(`Total due: ${money(inv.amount)}`, 190, 120, { align: "right" });
  doc.setFontSize(9);
  doc.text(`Payable to: ${inv.payableTo}`, 20, 134); doc.text(`Due: ${inv.due}`, 20, 140);
  doc.text("Generated by Loqal from the price and timing confirmed by the client.", 20, 152);
  doc.save(`${inv.number}.pdf`);
}
