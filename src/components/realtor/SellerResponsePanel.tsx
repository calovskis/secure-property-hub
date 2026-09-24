import { useState } from "react";
import { ArrowRight, CheckCircle2, FileSignature, Handshake, Link2, MessageSquareQuote, Plus, Scale, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { formatPrice } from "@/data/properties";
import { useEntityPlan } from "@/lib/entity-structure";
import { termsSummary, type AgreementTerms } from "@/lib/purchase-agreement";
import type { PurchaseRequest } from "@/lib/property-requests";
import { Button } from "@/components/ui/button";

const input = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-brand";

type Row = { label: string; from: string; to: string };

/** After the buyer confirms: seller's answer → agreement + DocuSign. */
export function SellerResponsePanel({ leadId, propertyId, propertyLabel, purchase, buyerName, buyerEmail, agentName }: {
  leadId: string; propertyId: number; propertyLabel: string; purchase: PurchaseRequest; buyerName: string; buyerEmail?: string | undefined; agentName: string;
}) {
  const { plan, savePlan } = useEntityPlan(leadId);
  const terms = plan?.proposedTerms as AgreementTerms | undefined;
  const rowsNow = terms ? termsSummary(purchase.offerPrice, terms) : [];
  const [mode, setMode] = useState<"idle" | "counter">("idle");
  const [rows, setRows] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [docs, setDocs] = useState<string[]>([]);
  const [docName, setDocName] = useState(plan?.agreementDoc ?? "");
  const [link, setLink] = useState(plan?.agreementDocusignUrl ?? "");
  const href = `/property/${propertyId}/workspace?open=agreement`;
  const tell = (id: string, title: string, body: string, severity: "info" | "warning" = "warning") => {
    if (buyerEmail) notify({ id, to: buyerEmail.toLowerCase(), title, body, href, severity });
  };

  function sellerAccepted() {
    const now = new Date().toISOString();
    savePlan({ sellerStatus: "accepted", sellerRespondedAt: now, sellerAgreedAt: now });
    tell(`seller-accepted-${leadId}-${now}`, "The seller accepted your terms", `${propertyLabel} at ${formatPrice(purchase.offerPrice)}. ${agentName} will share the purchase agreement for e-signing within 48 hours.`, "info");
    toast("Seller acceptance recorded", { description: `${buyerName} was told the agreement follows within 48 hours.` });
  }

  function sendCounter() {
    const items = rows.filter((r) => r.label.trim() && r.to.trim());
    if (!items.length) { toast("Add at least one term the seller amended."); return; }
    const now = new Date().toISOString();
    savePlan({ sellerStatus: "countered", sellerRespondedAt: now, sellerCounterItems: items, sellerCounterNote: note.trim() || undefined, sellerCounterDocs: docs, sellerCounterBuyerDecision: undefined, sellerCounterBuyerAt: undefined, sellerCounterBuyerNote: undefined, sellerAgreedAt: undefined });
    tell(`seller-counter-${leadId}-${now}`, "The seller sent a counter-offer", `${propertyLabel} — the seller amended: ${items.map((i) => i.label).join(", ")}. Review and answer.`);
    setMode("idle"); setRows([]); setNote(""); setDocs([]);
    toast("Counter-offer sent to the buyer");
  }

  function sendAgreement() {
    if (!docName) { toast("Upload the purchase agreement first."); return; }
    if (!/^https:\/\/\S+$/i.test(link.trim())) { toast("Add the DocuSign link (https://…)."); return; }
    const now = new Date().toISOString();
    savePlan({ agreementDoc: docName, agreementUploadedAt: now, agreementUploadedBy: agentName, agreementDocusignUrl: link.trim() });
    tell(`agreement-ready-${leadId}-${now}`, "Sign your purchase agreement with DocuSign", `${propertyLabel} at ${formatPrice(purchase.offerPrice)} — open the DocuSign link to review and sign electronically.`);
    toast("Agreement and DocuSign link sent", { description: `${buyerName} can sign now.` });
  }

  const counter = plan?.sellerStatus === "countered" ? plan.sellerCounterItems ?? [] : [];

  return <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
    <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2"><Scale className="h-3.5 w-3.5 text-brand" aria-hidden /><p className="font-semibold text-foreground">Seller's answer</p></div>
    <div className="space-y-3 p-3">
      {plan?.sellerStatus === "countered" ? <CounterCard items={counter} note={plan.sellerCounterNote} docs={plan.sellerCounterDocs} at={plan.sellerRespondedAt} /> : null}
      {plan?.sellerStatus === "countered" && !plan.sellerCounterBuyerDecision ? <p className="text-muted-foreground">Waiting for {buyerName} to accept or decline the counter-offer.</p> : null}
      {plan?.sellerCounterBuyerDecision === "declined" ? <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-foreground"><strong>{buyerName} declined the counter-offer</strong>{plan.sellerCounterBuyerNote ? ` — ${plan.sellerCounterBuyerNote}` : ""}. Take this back to the seller's agent and record their new answer.</p> : null}

      {!plan?.sellerAgreedAt && (plan?.sellerStatus !== "countered" || plan.sellerCounterBuyerDecision === "declined") ? (mode === "idle" ? <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={sellerAccepted}><Handshake />Seller accepted the terms</Button>
        <Button size="sm" variant="outline" onClick={() => { setMode("counter"); setRows([{ label: rowsNow[0]?.label ?? "", from: rowsNow[0]?.value ?? "", to: "" }]); }}><FileSignature />Seller sent a counter-offer</Button>
      </div> : <div className="space-y-2 rounded-md border border-gold/50 bg-gold-tint/20 p-3">
        <p className="font-semibold text-foreground">Record the seller's amendments</p>
        {rows.map((r, i) => <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select className={input} value={r.label} aria-label="Term" onChange={(e) => { const found = rowsNow.find((x) => x.label === e.target.value); setRows(rows.map((x, j) => j === i ? { ...x, label: e.target.value, from: found?.value ?? "" } : x)); }}>
            {rowsNow.map((x) => <option key={x.label} value={x.label}>{x.label}</option>)}
            <option value="Other term">Other term</option>
          </select>
          <input className={input} value={r.to} placeholder={r.from ? `Now: ${r.from}` : "Seller's value"} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, to: e.target.value } : x))} />
          <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => setRows(rows.filter((_, j) => j !== i))}><X /></Button>
        </div>)}
        <Button size="sm" variant="ghost" onClick={() => setRows([...rows, { label: rowsNow[0]?.label ?? "Other term", from: rowsNow[0]?.value ?? "", to: "" }])}><Plus />Add another amended term</Button>
        <textarea className={input} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Seller's agent comment (optional)" />
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-semibold text-muted-foreground hover:text-foreground"><Upload className="h-3.5 w-3.5" />Attach counter-offer documents<input type="file" multiple accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { setDocs([...docs, ...Array.from(e.target.files ?? []).map((f) => f.name)]); e.target.value = ""; }} /></label>
        {docs.length ? <p className="text-muted-foreground">{docs.join(", ")}</p> : null}
        <div className="flex gap-2"><Button size="sm" onClick={sendCounter}>Send to {buyerName} for review</Button><Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Cancel</Button></div>
      </div>) : null}

      {plan?.sellerAgreedAt ? <>
        <p className="flex items-center gap-1.5 font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" />Terms agreed with the seller · {formatDateTime(plan.sellerAgreedAt)}</p>
        {plan.agreementSignedAt ? <p className="text-success">Signed by {plan.agreementSignedBy} on {formatDateTime(plan.agreementSignedAt)}{plan.agreementDoc ? ` · ${plan.agreementDoc}` : ""}. The mortgage company received the signed copy and the buyer's Loqal number.</p> : <div className="space-y-2 rounded-md border border-brand/30 bg-brand-tint/20 p-3">
          <p className="font-semibold text-foreground">Step 2 — agreement for e-signing <span className="font-normal text-muted-foreground">(due {formatDateTime(new Date(new Date(plan.sellerAgreedAt).getTime() + 48 * 3600e3).toISOString())})</span></p>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 font-semibold text-muted-foreground hover:text-foreground"><Upload className="h-3.5 w-3.5" />{docName ? `${docName} · replace` : "Upload the purchase agreement"}<input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setDocName(f.name); e.target.value = ""; }} /></label>
          <div className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><input className={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="DocuSign signing link — https://…" /></div>
          <Button size="sm" onClick={sendAgreement}>{plan.agreementUploadedAt ? "Update and resend" : "Send for e-signing"}</Button>
          {plan.agreementUploadedAt ? <p className="text-muted-foreground">Sent {formatDateTime(plan.agreementUploadedAt)} — waiting for {buyerName} to sign in DocuSign.</p> : null}
        </div>}
      </> : null}
    </div>
  </div>;
}

export function CounterCard({ items, note, docs, at }: { items: { label: string; from: string; to: string }[]; note?: string | undefined; docs?: string[] | undefined; at?: string | undefined }) {
  return <div className="overflow-hidden rounded-md border-2 border-gold/60 bg-gold-tint/30 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2 bg-gold px-3 py-1.5 text-background"><span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wide"><Scale className="h-3.5 w-3.5" />Seller's counter-offer</span><span className="text-[10px] font-medium">{at ? formatDateTime(at) : ""}</span></div>
    <ul className="divide-y divide-gold/25 px-3 py-1">{items.map((it) => <li key={it.label + it.to} className="py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{it.label}</p><div className="mt-1 flex flex-wrap items-center gap-2">{it.from ? <><span className="rounded bg-muted px-2 py-1 text-muted-foreground line-through">{it.from}</span><ArrowRight className="h-3 w-3 text-brand" /></> : null}<span className="rounded border border-gold/60 bg-background px-2 py-1 font-semibold text-foreground">{it.to}</span></div></li>)}</ul>
    {note ? <p className="flex items-start gap-1.5 px-3 pb-2 italic text-muted-foreground"><MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0" />{note}</p> : null}
    {docs?.length ? <p className="border-t border-gold/30 px-3 py-2 text-muted-foreground"><strong className="text-foreground">Documents:</strong> {docs.join(", ")}</p> : null}
  </div>;
}
