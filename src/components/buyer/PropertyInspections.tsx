/**
 * Client deal workspace: inspections after the purchase agreement is signed.
 * Agreed inspections come from the signed terms (contractual rights during the
 * inspection period). Additional inspections are the buyer's own choice and are
 * clearly marked as outside the agreement — informational only, no claim
 * against the seller.
 */
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileText, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEntityPlan } from "@/lib/entity-structure";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getProperty } from "@/data/properties";
import { completeTerms, INSPECTION_TYPES, propertyCategory, stateFromLocation, type AgreementTerms } from "@/lib/purchase-agreement";
import { INSPECTION_STATUS_LABEL, confirmInspectionOffer, createInspectionRequest, downloadInspectionInvoice, downloadInspectionReport, useInspectionOffers, useInspectionRequests, type InspectionRequest } from "@/lib/inspections";

type Props = { leadId: string; propertyId?: number | undefined; propertyLabel: string; clientLabel: string; agentEmail?: string | undefined };

function RequestStatus({ r, onDone }: { r: InspectionRequest; onDone: () => void }) {
  const { offers } = useInspectionOffers([r.id]);
  const [busy, setBusy] = useState(false);
  const live = offers.filter((o) => o.status !== "withdrawn");
  if (r.status === "open") return <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Search className="size-3.5" aria-hidden /> Sent {formatDateTime(r.createdAt)} — {live.length ? `${live.length} offer${live.length > 1 ? "s" : ""} received.` : "inspection companies are preparing offers."} Your agent will compare price and timing{r.offersDueAt ? ` by ${formatDateTime(r.offersDueAt)}` : ""} and recommend one.</p>;
  if (r.status === "awaiting_client") {
    const chosen = live.find((o) => o.id === r.selectedOfferId);
    const others = live.filter((o) => o.id !== r.selectedOfferId);
    async function confirm() {
      if (!chosen) return;
      setBusy(true);
      try {
        await confirmInspectionOffer(r.id);
        if (chosen.contact?.email) notify({ id: `inspection-confirmed-${r.id}`, to: chosen.contact.email.toLowerCase(), title: "You've been chosen for an inspection", body: `${r.propertyLabel} — the client confirmed $${chosen.price.toLocaleString("en-US")}. Coordinate access with the buyer's agent and mark the visit as scheduled.`, href: "/partner?tab=cases", severity: "info" });
        if (r.agentEmail) notify({ id: `inspection-confirmed-agent-${r.id}`, to: r.agentEmail.toLowerCase(), title: "Your buyer confirmed the inspection", body: `${r.propertyLabel} — ${chosen.company}, $${chosen.price.toLocaleString("en-US")}.`, href: `/partner?tab=buyers&focus=${r.leadId}`, severity: "info" });
        notify({ id: `inspection-confirmed-admin-${r.id}`, to: "admins", title: "Inspection confirmed — invoices issued", body: `${r.propertyLabel} — ${chosen.company}, $${chosen.price.toLocaleString("en-US")}.`, href: "/admin", severity: "info" });
        toast("Inspection confirmed", { description: "Your invoice is ready to download." });
        onDone();
      } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't confirm"); } finally { setBusy(false); }
    }
    return chosen ? (
      <div className="mt-2 space-y-2 rounded-md border border-brand/30 bg-brand-tint/30 p-3 text-xs">
        <p className="font-semibold text-foreground">Your agent recommends {chosen.company}</p>
        <p className="text-muted-foreground">Price <b className="text-foreground">${chosen.price.toLocaleString("en-US")}</b> · visit {chosen.visitSlots[0] ? <b className="text-foreground">{formatDateTime(chosen.visitSlots[0])}</b> : "flexible"}{chosen.visitSlots.length > 1 ? ` (+${chosen.visitSlots.length - 1} alternative${chosen.visitSlots.length > 2 ? "s" : ""})` : ""} · report within <b className="text-foreground">{chosen.reportDays} business days</b></p>
        {r.agentNote ? <p className="text-muted-foreground">Agent's note: “{r.agentNote}”</p> : null}
        {others.length ? <div className="text-muted-foreground"><p className="font-semibold text-foreground">Other offers</p>{others.map((o) => <p key={o.id}>{o.company} — ${o.price.toLocaleString("en-US")} · {o.visitSlots[0] ? formatDateTime(o.visitSlots[0]) : "flexible"} · report {o.reportDays} days</p>)}</div> : null}
        <p className="text-muted-foreground">By confirming, you agree to this price and timing. You pay the inspection company directly; an invoice is generated for you.</p>
        <Button size="sm" disabled={busy} onClick={confirm}>{busy ? "Confirming…" : "Confirm price & timing"}</Button>
      </div>
    ) : null;
  }
  return (
    <div className="mt-2 space-y-1.5 rounded-md border border-success/30 bg-success/5 p-3 text-xs">
      <p className="flex items-center gap-2 font-semibold text-foreground"><CheckCircle2 className="size-4 text-success" aria-hidden /> {r.inspectorCompany}</p>
      {r.inspectorContact ? <p className="text-muted-foreground">{[r.inspectorContact.name, r.inspectorContact.phone, r.inspectorContact.email].filter(Boolean).join(" · ")}</p> : null}
      {r.fee != null ? <p className="text-muted-foreground">Fee: <b className="text-foreground">${r.fee.toLocaleString("en-US")}</b> — paid directly to the inspector.</p> : null}
      {r.scheduledAt || r.proposedAt ? <p className="text-muted-foreground">{r.scheduledAt ? "Scheduled for " : "Proposed date: "}<b className="text-foreground">{formatDateTime(r.scheduledAt || r.proposedAt || "")}</b></p> : null}
      {r.invoices.filter((i) => i.kind === "inspection_service").map((inv) => <button key={inv.number} type="button" onClick={() => downloadInspectionInvoice(inv).catch(() => toast.error("Download failed"))} className="flex items-center gap-1.5 font-semibold text-brand"><FileText className="size-3.5" aria-hidden /> Invoice {inv.number}</button>)}
      {r.reportFiles.map((f) => <button key={f.path} type="button" onClick={() => downloadInspectionReport(f).catch(() => toast.error("Download failed"))} className="flex items-center gap-1.5 font-semibold text-brand"><Download className="size-3.5" aria-hidden /> {f.name}</button>)}
    </div>
  );
}

function RequestRow({ r, onDone }: { r: InspectionRequest; onDone: () => void }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">{r.inspectionTypes.map((t) => <span key={t} className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-foreground">{t}</span>)}</div>
        <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand">{INSPECTION_STATUS_LABEL[r.status]}</span>
      </div>
      {r.outsideAgreement ? <p className="mt-2 text-[11px] font-semibold text-gold">Additional — not part of the purchase agreement</p> : null}
      <RequestStatus r={r} onDone={onDone} />
    </div>
  );
}

export function PropertyInspections({ leadId, propertyId, propertyLabel, clientLabel, agentEmail }: Props) {
  const { plan } = useEntityPlan(leadId);
  const { user } = useAuth();
  const { items, ready, refresh } = useInspectionRequests(leadId);
  const [confirmAgreed, setConfirmAgreed] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!plan?.agreementSignedAt) return null;

  const terms = completeTerms(plan.proposedTerms as Partial<AgreementTerms> | undefined);
  const property = getProperty(propertyId ?? -1);
  const state = stateFromLocation(property?.location) ?? "";
  const category = propertyCategory(property?.type);
  const agreedTypes = terms.inspection ? terms.inspectionTypes : [];
  const deadline = terms.inspection ? new Date(new Date(plan.agreementSignedAt).getTime() + terms.inspectionDeadlineDays * 86400000).toISOString() : null;
  const live = items.filter((i) => i.status !== "cancelled");
  const agreedReq = live.find((i) => !i.outsideAgreement);
  const extras = live.filter((i) => i.outsideAgreement);
  const extraOptions = [...INSPECTION_TYPES[category], "Other (describe in note)"];

  async function send(outside: boolean) {
    if (!state) { toast.error("We couldn't read the property's state — please contact Loqal support."); return; }
    const types = outside ? picked : agreedTypes;
    setBusy(true);
    try {
      await createInspectionRequest({
        leadId, clientEmail: user?.email ?? "", clientLabel, agentEmail, propertyId: propertyId == null ? undefined : String(propertyId), propertyLabel, state,
        propertyCategory: category, inspectionTypes: types, deadlineDays: outside ? undefined : terms.inspectionDeadlineDays,
        agreementSignedAt: plan!.agreementSignedAt, outsideAgreement: outside, clientNote: outside ? note : undefined,
      });
      const what = outside ? "Additional inspection (outside the agreement)" : "Inspection request";
      notify({ id: `inspection-request-${outside ? "extra-" : ""}${leadId}-${Date.now()}`, to: "admins", title: `New ${what.toLowerCase()}`, body: `${propertyLabel} (${state}) — ${types.join(", ")}.`, href: "/admin", severity: "info" });
      if (agentEmail) notify({ id: `inspection-request-agent-${leadId}-${Date.now()}`, to: agentEmail.toLowerCase(), title: outside ? "Your buyer ordered an additional inspection" : "Your buyer ordered the inspections", body: `${propertyLabel} — ${types.join(", ")}.${outside ? " Not part of the purchase agreement; please help arrange property access with the seller's side." : ""}`, href: `/partner?tab=buyers&focus=${leadId}`, severity: "info" });
      toast(outside ? "Additional inspection requested" : "Inspection request sent", { description: "Inspection companies covering this area can now accept it." });
      setConfirmAgreed(false); setExtraOpen(false); setPicked([]); setNote(""); setAck(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The request didn't go through.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start gap-3">
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Agreed in your purchase agreement</p>
            {deadline ? <p className="mt-0.5 text-xs text-muted-foreground">Your inspection period ends on <b className="text-foreground">{formatDate(deadline)}</b> ({terms.inspectionDeadlineDays} days from signing). Within this period, findings from these inspections can be used to ask the seller for repairs or credits, as your agreement allows.</p> : <p className="mt-0.5 text-xs text-muted-foreground">Your signed agreement does not include an inspection contingency.</p>}
          </div>
        </div>
        {!ready ? null : agreedTypes.length === 0 ? null : agreedReq ? <div className="mt-3"><RequestRow r={agreedReq} onDone={refresh} /></div> : (
          <div className="mt-3">
            <div className="flex flex-wrap gap-1.5">{agreedTypes.map((t) => <span key={t} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground">{t}</span>)}</div>
            {confirmAgreed ? (
              <div className="mt-3 rounded-md border border-brand/30 bg-brand-tint/30 p-3 text-xs">
                <p className="font-semibold text-foreground">Send this request to inspection companies in {state || "the property's state"}?</p>
                <p className="mt-1 text-muted-foreground">Only Loqal-verified, licensed companies see it. You'll see the company, fee and proposed date once one accepts. Only your first name and client number are shared.</p>
                <div className="mt-2 flex gap-2"><Button size="sm" disabled={busy} onClick={() => send(false)}>{busy ? "Sending…" : "Confirm and send"}</Button><Button size="sm" variant="outline" onClick={() => setConfirmAgreed(false)}>Cancel</Button></div>
              </div>
            ) : <Button size="sm" className="mt-3" onClick={() => setConfirmAgreed(true)}>Schedule agreed inspections</Button>}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-foreground">Additional inspections</p>
            <p className="mt-0.5 text-xs text-muted-foreground">For your own peace of mind — not part of the signed agreement.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setExtraOpen(true)}><Plus aria-hidden /> Add inspection</Button>
        </div>
        {extras.length ? <div className="mt-3 space-y-2">{extras.map((r) => <RequestRow key={r.id} r={r} onDone={refresh} />)}</div> : null}
      </div>

      <Dialog open={extraOpen} onOpenChange={setExtraOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Request an additional inspection</DialogTitle>
            <DialogDescription>Choose inspections you'd like on top of what your purchase agreement covers.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs leading-5 text-foreground">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-warning" aria-hidden /> Not included in your signed purchase agreement</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              <li>Results are for your information only. You can't use them to ask the seller for repairs or credits, or to cancel the purchase under the inspection contingency.</li>
              <li>The fee is yours to pay directly to the inspector and isn't refundable by the seller.</li>
              <li>The seller must still allow access — your agent will coordinate a time.</li>
              <li>Want contractual rights for this inspection? Ask your agent to add it to the agreement through a terms change{deadline ? `, before ${formatDate(deadline)}` : ""}. The seller must accept it.</li>
            </ul>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {extraOptions.map((o) => {
              const on = picked.includes(o); const agreed = agreedTypes.includes(o);
              return (
                <label key={o} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${agreed ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${on ? "border-brand bg-brand-tint/40 text-foreground" : "border-border text-muted-foreground"}`}>
                  <input type="checkbox" disabled={agreed} checked={on} onChange={(e) => setPicked(e.target.checked ? [...picked, o] : picked.filter((x) => x !== o))} className="accent-brand" />
                  {o}{agreed ? " (already agreed)" : ""}
                </label>
              );
            })}
          </div>
          <label className="block text-xs text-muted-foreground">Note for the inspector (optional)
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="E.g. water stain on the basement ceiling" />
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-xs text-foreground">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-brand" />
            I understand this inspection is not part of my purchase agreement and gives me no claim against the seller.
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setExtraOpen(false)}>Cancel</Button>
            <Button size="sm" disabled={busy || !ack || picked.length === 0 || (picked.includes("Other (describe in note)") && !note.trim())} onClick={() => send(true)}>{busy ? "Sending…" : "Send request"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
