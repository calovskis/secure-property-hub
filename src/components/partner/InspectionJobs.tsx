/**
 * Inspection company workspace: open requests in the states they cover, and
 * their accepted jobs through scheduling to report upload.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getProperty } from "@/data/properties";
import { InspectionThread } from "@/components/inspections/InspectionThread";
import { toast } from "sonner";
import { Download, ExternalLink, FileText, MessageSquare, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { DateInput } from "@/components/form/DateInput";
import { notify } from "@/lib/notifications";
import { formatDate, formatDateTime } from "@/lib/dates";
import { fullName, type LoqalUser } from "@/lib/auth";
import {
  INSPECTION_STATUS_LABEL,
  downloadInspectionInvoice,
  downloadInspectionReport,
  fetchAgentContact,
  submitInspectionOffer,
  useInspectionOffers,
  type AgentContact,
  type InspectionInvoice,
  updateInspection,
  uploadInspectionReport,
  type InspectionRequest,
} from "@/lib/inspections";

const input = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground";

export function InspectionJobs({ user, items, ready, refresh, compact = false }: { user: LoqalUser; items: InspectionRequest[]; ready: boolean; refresh: () => void; compact?: boolean }) {
  const { authUserId } = useAuth();
  const [category, setCategory] = useState("all");
  const [stage, setStage] = useState("all");
  const filtered = items.filter((i) => (category === "all" || i.propertyCategory === category) && (stage === "all" || (stage === "active" ? i.status === "accepted" || i.status === "scheduled" : stage === "reports" ? i.status === "report_uploaded" || i.status === "completed" : (i.status === "open" || i.status === "awaiting_client"))));
  const open = filtered.filter((i) => i.status === "open" || (i.status === "awaiting_client" && i.inspectorUserId == null));
  const mine = filtered.filter((i) => i.inspectorUserId === authUserId && i.status !== "open" && i.status !== "awaiting_client" && i.status !== "cancelled");
  const visibleOpen = compact ? open.slice(0, 3) : open;
  const visibleMine = compact ? mine.filter((r) => r.status === "accepted" || r.status === "scheduled").slice(0, 3) : mine;

  return (
    <div className="space-y-6">
      {!compact ? <div className="space-y-4"><div role="group" aria-label="Property type" className="flex flex-wrap gap-2">{([["all", "All property types"], ["house", "Houses"], ["apartment", "Apartments"], ["commercial", "Commercial"], ["land", "Land"]] as const).map(([id, label]) => <Button key={id} size="sm" variant={category === id ? "secondary" : "ghost"} aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</Button>)}</div><label className="flex items-center gap-3 text-xs font-medium text-muted-foreground">Case stage<select aria-label="Case stage" value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"><option value="all">All stages</option><option value="open">New requests</option><option value="active">Scheduled & in progress</option><option value="reports">Reports & completed</option></select></label></div> : null}

      <section className="border-t border-border py-5">
        <h2 className="text-base font-semibold text-foreground">New inspection requests</h2>
        <div className="mt-4 space-y-3">
          {!ready ? <p className="text-sm text-muted-foreground">Loading…</p> : !visibleOpen.length ? <p className="text-sm text-muted-foreground">No new requests in this view.</p> : visibleOpen.map((r) => <OpenJob key={r.id} r={r} user={user} onDone={refresh} />)}
        </div>
      </section>

      <section className="border-t border-border py-5">
        <h2 className="text-base font-semibold text-foreground">{compact ? "Cases requiring follow-up" : "My inspection cases"}</h2>
        <div className="mt-4 space-y-3">
          {!ready ? <p className="text-sm text-muted-foreground">Loading…</p> : !visibleMine.length ? <p className="text-sm text-muted-foreground">No assigned cases in this view.</p> : visibleMine.map((r) => <MyJob key={r.id} r={r} onDone={refresh} />)}
        </div>
      </section>
    </div>
  );
}

function JobHead({ r }: { r: InspectionRequest }) {
  const deadline = r.agreementSignedAt && r.deadlineDays ? new Date(new Date(r.agreementSignedAt).getTime() + r.deadlineDays * 86400000).toISOString() : null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{r.propertyLabel} <span className="font-normal text-muted-foreground">· {r.state}</span></p>
        <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand">{INSPECTION_STATUS_LABEL[r.status]}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Buyer {r.clientLabel}{deadline && !r.outsideAgreement ? ` · inspection period ends ${formatDate(deadline)}` : ""}</p>
      {r.outsideAgreement ? <p className="mt-1 inline-block rounded bg-gold-tint px-2 py-0.5 text-[10px] font-semibold text-gold">Additional inspection requested by the buyer — not part of the purchase agreement</p> : null}
      {r.clientNote ? <p className="mt-1 text-xs text-muted-foreground">Buyer's note: {r.clientNote}</p> : null}
      <ul className="mt-2 flex flex-wrap gap-1.5">{r.inspectionTypes.map((t) => <li key={t} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground">{t}</li>)}</ul>
    </>
  );
}

export function InspectionJobDetails({ r, user, onDone }: { r: InspectionRequest; user: LoqalUser; onDone: () => void }) {
  return r.status === "open" || r.status === "awaiting_client" ? <OpenJob r={r} user={user} onDone={onDone} /> : <MyJob r={r} onDone={onDone} />;
}

function useAgent(r: InspectionRequest) {
  const [agent, setAgent] = useState<AgentContact | null>(null);
  useEffect(() => { void fetchAgentContact(r.id).then(setAgent); }, [r.id]);
  return agent;
}

/** What an inspection company needs before quoting: property, scope, deadlines, access via the buyer's agent. */
function RequestBrief({ r }: { r: InspectionRequest }) {
  const property = r.propertyId ? getProperty(Number(r.propertyId)) : undefined;
  const deadline = r.agreementSignedAt && r.deadlineDays ? new Date(new Date(r.agreementSignedAt).getTime() + r.deadlineDays * 86400000).toISOString() : null;
  const facts: [string, string][] = [
    ["Property type", property?.type ?? r.propertyCategory],
    ["Location", property ? `${property.address}, ${property.location}` : `${r.propertyLabel}, ${r.state}`],
    ["Size", property ? `${property.sqft.toLocaleString("en-US")} ${property.type === "Land" ? "acres" : "sqft"}` : "—"],
    ["Layout", property?.beds ? `${property.beds} bed · ${property.baths} bath` : "—"],
    ["Inspection period ends", deadline && !r.outsideAgreement ? formatDate(deadline) : r.outsideAgreement ? "Not contractual (buyer's extra)" : "—"],
    ["Offers due", r.offersDueAt ? formatDateTime(r.offersDueAt) : "—"],
  ];
  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">{facts.map(([k, v]) => <div key={k} className="rounded-md border border-border bg-muted/30 px-3 py-2"><p className="text-[10px] font-semibold uppercase text-muted-foreground">{k}</p><p className="mt-0.5 text-xs font-semibold text-foreground">{v}</p></div>)}</div>
      <p className="text-[11px] leading-5 text-muted-foreground">Access is arranged through the buyer's agent with the seller's side (lockbox, occupancy, utilities on). The buyer is identified by first name and client number only. Your fee is paid directly by the client; Loqal's 10% partner fee is invoiced after completion.</p>
      {property ? <Button asChild size="sm" variant="outline"><Link to="/property/$propertyId" params={{ propertyId: String(property.id) }} target="_blank"><ExternalLink aria-hidden /> View original listing</Link></Button> : null}
    </div>
  );
}

function AgentBox({ r, user, inspectorUserId }: { r: InspectionRequest; user: LoqalUser; inspectorUserId: string }) {
  const agent = useAgent(r);
  const [open, setOpen] = useState(false);
  if (!r.agentEmail) return <p className="mt-3 text-xs text-muted-foreground">No buyer's agent on this file — Loqal will coordinate access.</p>;
  return (
    <div className="mt-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs"><p className="font-semibold text-foreground">Buyer's agent: {agent?.name || r.agentEmail}</p><p className="text-muted-foreground">{[agent?.company, agent?.phone, agent?.email ?? r.agentEmail].filter(Boolean).join(" · ")}</p></div>
        <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}><MessageSquare aria-hidden /> {open ? "Hide messages" : "Message / schedule call"}</Button>
      </div>
      {open ? <div className="mt-3"><InspectionThread r={r} side="inspector" inspectorUserId={inspectorUserId} inspectorEmail={user.email} authorName={user.companyName || fullName(user)} counterpartEmail={r.agentEmail ?? undefined} /></div> : null}
    </div>
  );
}

function OpenJob({ r, user, onDone }: { r: InspectionRequest; user: LoqalUser; onDone: () => void }) {
  const { authUserId } = useAuth();
  const { offers, refresh } = useInspectionOffers([r.id]);
  const mine = offers.find((o) => o.inspectorUserId === authUserId);
  const [form, setForm] = useState(false);
  const [price, setPrice] = useState("");
  const [slots, setSlots] = useState([{ date: "", time: "10:00" }, { date: "", time: "10:00" }, { date: "", time: "10:00" }]);
  const [flexible, setFlexible] = useState(false);
  const [reportDays, setReportDays] = useState("2");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const closed = r.status !== "open";

  function edit() {
    if (mine) {
      setPrice(String(mine.price)); setFlexible(mine.visitFlexible); setReportDays(String(mine.reportDays)); setNote(mine.note ?? "");
      setSlots([0, 1, 2].map((i) => { const s = mine.visitSlots[i]; if (!s) return { date: "", time: "10:00" }; const d = new Date(s); return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }; }));
    }
    setForm(true);
  }

  async function submit() {
    const visitSlots = slots.filter((s) => s.date).map((s) => new Date(`${s.date}T${s.time}`).toISOString());
    if (!(Number(price) > 0)) { toast("Enter your total price."); return; }
    if (!flexible && !visitSlots.length) { toast("Add at least one visit date or choose Flexible."); return; }
    if (!(Number(reportDays) > 0)) { toast("Enter how many business days until the report is ready."); return; }
    setBusy(true);
    try {
      const { data: pr } = await supabase.from("partner_requests").select("id,company_name").eq("user_id", authUserId ?? "").eq("partner_type", "inspector").eq("status", "approved").maybeSingle();
      const company = user.companyName || (pr?.company_name as string | undefined) || fullName(user);
      await submitInspectionOffer({ requestId: r.id, partnerRequestId: pr?.id as string | undefined, company, contact: { name: fullName(user), phone: user.phone ?? "", email: user.email }, price: Number(price), visitSlots, visitFlexible: flexible, reportDays: Number(reportDays), note, existingId: mine?.id });
      if (r.agentEmail) notify({ id: `inspection-offer-${r.id}-${authUserId}`, to: r.agentEmail, title: mine ? "Inspection offer updated" : "New inspection offer", body: `${r.propertyLabel} — ${company}: $${Number(price).toLocaleString("en-US")}, ${flexible ? "flexible timing" : `from ${formatDateTime(visitSlots[0] ?? "")}`}, report in ${reportDays} business days.`, href: `/partner?tab=buyers&focus=${r.leadId}`, severity: "info" });
      notify({ id: `inspection-offer-admin-${r.id}-${authUserId}`, to: "admins", title: "Inspection offer received", body: `${r.propertyLabel} — ${company}, $${Number(price).toLocaleString("en-US")}.`, href: "/admin", severity: "info" });
      toast(mine ? "Offer updated" : "Offer sent to the buyer's agent");
      setForm(false); await refresh(); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't send the offer"); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-md border border-border bg-background p-4">
      <JobHead r={r} />
      <RequestBrief r={r} />
      {authUserId ? <AgentBox r={r} user={user} inspectorUserId={authUserId} /> : null}
      {mine && !form ? (
        <div className="mt-3 rounded-md border border-brand/30 bg-brand-tint/30 p-3 text-xs">
          <p className="font-semibold text-foreground">Your offer: ${mine.price.toLocaleString("en-US")} · report in {mine.reportDays} business days</p>
          <p className="mt-1 text-muted-foreground">Visit: {mine.visitFlexible ? "Flexible" : ""}{mine.visitSlots.length ? `${mine.visitFlexible ? " · preferred " : ""}${mine.visitSlots.map((s, i) => `${i + 1}. ${formatDateTime(s)}`).join("  ")}` : ""}</p>
          <p className="mt-1 text-muted-foreground">{closed ? (r.selectedOfferId === mine.id ? "The buyer's agent recommended your offer — waiting for the client's confirmation." : "The buyer's agent recommended another offer; the client hasn't confirmed yet.") : "The buyer's agent compares offers and recommends one to the client."}</p>
          {!closed ? <Button size="sm" variant="outline" className="mt-2" onClick={edit}>Edit offer</Button> : null}
        </div>
      ) : form ? (
        <div className="mt-3 space-y-3 rounded-md border border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">Total price for all listed inspections (USD)<input className={input} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} /></label>
            <label className="text-xs text-muted-foreground">Report ready within (business days after the visit)<input className={input} inputMode="numeric" value={reportDays} onChange={(e) => setReportDays(e.target.value.replace(/\D/g, ""))} /></label>
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">When could you visit? (in order of preference)</p>
            <label className="mt-2 flex items-center gap-2 text-xs text-foreground"><input type="checkbox" className="accent-brand" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} /> Flexible — any time that suits the buyer's agent and seller within the inspection period</label>
            <div className="mt-2 grid gap-2">{slots.map((s, i) => (
              <div key={i} className="grid grid-cols-[80px_1fr_110px] items-center gap-2 text-xs text-muted-foreground">
                <span>Priority {i + 1}</span>
                <DateInput value={s.date} onChange={(v) => setSlots(slots.map((x, j) => (j === i ? { ...x, date: v } : x)))} />
                <input type="time" aria-label={`Priority ${i + 1} time`} className={input} value={s.time} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
              </div>))}</div>
          </div>
          <label className="block text-xs text-muted-foreground">Note (optional — what's included, access needs, add-ons)<textarea rows={2} className={input} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="flex gap-2"><Button size="sm" disabled={busy} onClick={submit}>{busy ? "Sending…" : mine ? "Update offer" : "Send offer"}</Button><Button size="sm" variant="outline" onClick={() => setForm(false)}>Cancel</Button></div>
        </div>
      ) : !closed ? (
        <Button size="sm" onClick={() => setForm(true)} className="mt-3">Send price & availability</Button>
      ) : null}
    </div>
  );
}

function Invoices({ r, kinds }: { r: InspectionRequest; kinds: InspectionInvoice["kind"][] }) {
  const list = r.invoices.filter((i) => kinds.includes(i.kind));
  if (!list.length) return null;
  return <div className="mt-3 flex flex-wrap gap-2">{list.map((inv) => <Button key={inv.number} size="sm" variant="outline" onClick={() => downloadInspectionInvoice(inv).catch(() => toast.error("Download failed"))}><FileText aria-hidden /> {inv.kind === "loqal_fee" ? "Loqal fee invoice" : "Client invoice"} {inv.number} · ${inv.amount.toLocaleString("en-US")}</Button>)}</div>;
}

function MyJob({ r, onDone }: { r: InspectionRequest; onDone: () => void }) {
  const { user, authUserId } = useAuth();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  async function confirmDate() {
    setBusy(true);
    try {
      await updateInspection(r.id, { status: "scheduled", scheduled_at: r.proposedAt });
      notify({ id: `inspection-scheduled-${r.id}`, to: r.clientEmail, title: "Your inspection is scheduled", body: `${r.propertyLabel} — ${r.proposedAt ? formatDateTime(r.proposedAt) : ""} with ${r.inspectorCompany}.`, href: "/my-properties", severity: "info" });
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }
  async function upload(file: File) {
    setBusy(true);
    try {
      await uploadInspectionReport(r, file);
      notify({ id: `inspection-report-${r.id}-${Date.now()}`, to: r.clientEmail, title: "Your inspection report is ready", body: `${r.propertyLabel} — ${r.inspectorCompany} uploaded the report. Review it with your agent before the inspection period ends.`, href: "/my-properties", severity: "info" });
      if (r.agentEmail) notify({ id: `inspection-report-agent-${r.id}-${Date.now()}`, to: r.agentEmail, title: "Inspection report uploaded", body: `${r.propertyLabel} — the buyer may ask for repairs or credits.`, href: `/partner?tab=buyers&focus=${r.leadId}`, severity: "warning" });
      toast("Report uploaded");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <JobHead r={r} />
      <Invoices r={r} kinds={["inspection_service", "loqal_fee"]} />
      {user && authUserId ? <AgentBox r={r} user={user} inspectorUserId={authUserId} /> : null}
      <p className="mt-2 text-xs text-muted-foreground">Fee ${r.fee?.toLocaleString("en-US")} · {r.scheduledAt ? `scheduled ${formatDateTime(r.scheduledAt)}` : r.proposedAt ? `proposed ${formatDateTime(r.proposedAt)}` : ""}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.status === "accepted" ? <Button size="sm" disabled={busy} onClick={confirmDate}>Mark as scheduled</Button> : null}
        <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}><Upload aria-hidden/> {r.reportFiles.length ? "Add another report file" : "Upload report"}</Button>
        <input ref={fileInput} aria-label="Inspection report file" type="file" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        {r.reportFiles.map((f) => <Button key={f.path} type="button" variant="ghost" size="sm" onClick={() => downloadInspectionReport(f).catch(() => toast.error("Download failed"))} className="text-xs text-brand"><Download className="h-3.5 w-3.5" aria-hidden /> {f.name}</Button>)}
      </div>
    </div>
  );
}
