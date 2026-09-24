import { useState } from "react";
import { ArrowRight, Check, CheckCircle2, ChevronDown, FileSignature, FileText, Handshake, Link2, MessageSquareQuote, Pencil, Scale, Upload } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { formatPrice } from "@/data/properties";
import { Download } from "lucide-react";
import { useEntityPlan } from "@/lib/entity-structure";
import { termsSummary, type AgreementTerms } from "@/lib/purchase-agreement";
import { storeAgreementFile, downloadAgreementFile } from "@/lib/agreement-files";
import type { PurchaseRequest } from "@/lib/property-requests";
import { Button } from "@/components/ui/button";

const input = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-brand";

type Row = { label: string; from: string; to: string; customLabel?: string };

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
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
    const items = rows
      .map((row) => ({ label: row.label === "Other term" ? row.customLabel?.trim() ?? "" : row.label, from: row.from, to: row.to.trim() }))
      .filter((row) => row.label && row.to);
    if (!items.length) { toast("Add at least one term the seller amended."); return; }
    const now = new Date().toISOString();
    savePlan({ sellerStatus: "countered", sellerRespondedAt: now, sellerCounterItems: items, sellerCounterNote: note.trim() || undefined, sellerCounterDocs: docs, sellerCounterBuyerDecision: undefined, sellerCounterBuyerAt: undefined, sellerCounterBuyerNote: undefined, sellerAgreedAt: undefined });
    tell(`seller-counter-${leadId}-${now}`, "The seller sent a counter-offer", `${propertyLabel} — the seller amended: ${items.map((i) => i.label).join(", ")}. Review and answer.`);
    setMode("idle"); setRows([]); setNote(""); setDocs([]);
    toast("Counter-offer sent to the buyer");
  }

  function toggleCounterRow(label: string, from: string) {
    const selected = rows.some((row) => row.label === label);
    setRows(selected ? rows.filter((row) => row.label !== label) : [...rows, { label, from, to: "" }]);
  }

  function updateCounterRow(label: string, patch: Partial<Row>) {
    setRows(rows.map((row) => row.label === label ? { ...row, ...patch } : row));
  }

  function openDialog(edit: boolean) {
    setEditing(edit); setConfirming(false);
    setDocName(plan?.agreementDoc ?? ""); setLink(plan?.agreementDocusignUrl ?? "");
    setDialogOpen(true);
  }

  function review() {
    if (!docName) { toast("Upload the purchase agreement first."); return; }
    if (!/^https:\/\/\S+$/i.test(link.trim())) { toast("Add the DocuSign link (https://…)."); return; }
    if (editing && docName === plan?.agreementDoc && link.trim() === plan?.agreementDocusignUrl) { toast("Nothing changed yet."); return; }
    setConfirming(true);
  }

  function sendAgreement() {
    const now = new Date().toISOString();
    const history = plan?.agreementUploadedAt && plan.agreementDoc
      ? [...(plan.agreementHistory ?? []), { doc: plan.agreementDoc, url: plan.agreementDocusignUrl ?? "", sentAt: plan.agreementUploadedAt, by: plan.agreementUploadedBy ?? agentName }]
      : plan?.agreementHistory;
    savePlan({ agreementDoc: docName, agreementUploadedAt: now, agreementUploadedBy: agentName, agreementDocusignUrl: link.trim(), agreementHistory: history });
    tell(`agreement-ready-${leadId}-${now}`, editing ? "Your purchase agreement was updated" : "Sign your purchase agreement with DocuSign", `${propertyLabel} at ${formatPrice(purchase.offerPrice)} — open the DocuSign link to review and sign electronically.`);
    toast(editing ? "Updated agreement sent" : "Agreement and DocuSign link sent", { description: `${buyerName} can sign now.` });
    setDialogOpen(false); setConfirming(false);
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
        <Button size="sm" variant="outline" onClick={() => { setMode("counter"); setRows([]); }}><FileSignature />Seller sent a counter-offer</Button>
      </div> : <div className="space-y-2 rounded-md border border-gold/50 bg-gold-tint/20 p-3">
        <div>
          <p className="font-semibold text-foreground">Record the seller's amendments</p>
          <p className="mt-0.5 text-muted-foreground">Choose each term the seller changed, then enter their new proposal beside the original term.</p>
        </div>
        <ul className="divide-y divide-gold/30 overflow-hidden rounded-md border border-gold/40 bg-background">
          {[...rowsNow.map((row) => ({ label: row.label, from: row.value })), { label: "Other term", from: "" }].map((option) => {
            const selected = rows.find((row) => row.label === option.label);
            return <li key={option.label} className={selected ? "bg-gold-tint/25" : undefined}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => toggleCounterRow(option.label, option.from)}
                aria-pressed={Boolean(selected)}
                className="h-auto w-full justify-start rounded-none px-3 py-2.5 text-left hover:bg-gold-tint/30"
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-gold bg-gold text-background" : "border-input bg-background"}`} aria-hidden>
                  {selected ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-foreground">{option.label}</span>
                  {option.from ? <span className="block whitespace-normal text-[11px] font-normal text-muted-foreground">Current: {option.from}</span> : null}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${selected ? "rotate-180" : ""}`} aria-hidden />
              </Button>
              {selected ? <div className="space-y-2 px-3 pb-3 pl-10">
                {option.label === "Other term" ? <input className={input} value={selected.customLabel ?? ""} placeholder="Name the amended term" onChange={(e) => updateCounterRow(option.label, { customLabel: e.target.value })} /> : null}
                <input className={input} value={selected.to} placeholder="Enter the seller's proposed value" onChange={(e) => updateCounterRow(option.label, { to: e.target.value })} />
                {selected.to ? <p className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded bg-muted px-2 py-1 text-muted-foreground line-through">{selected.from || "Original offer"}</span><ArrowRight className="h-3 w-3 text-brand" aria-hidden /><span className="rounded border border-gold/60 bg-background px-2 py-1 font-semibold text-foreground">{selected.to}</span></p> : null}
              </div> : null}
            </li>;
          })}
        </ul>
        <textarea className={input} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Seller's agent comment (optional)" />
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-semibold text-muted-foreground hover:text-foreground"><Upload className="h-3.5 w-3.5" />Attach counter-offer documents<input type="file" multiple accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { setDocs([...docs, ...Array.from(e.target.files ?? []).map((f) => f.name)]); e.target.value = ""; }} /></label>
        {docs.length ? <p className="text-muted-foreground">{docs.join(", ")}</p> : null}
        <div className="flex gap-2"><Button size="sm" onClick={sendCounter}>Send to {buyerName} for review</Button><Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Cancel</Button></div>
      </div>) : null}

      {plan?.sellerAgreedAt ? <>
        <p className="flex items-center gap-1.5 font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" />Terms agreed with the seller · {formatDateTime(plan.sellerAgreedAt)}</p>
        {plan.agreementUploadedAt ? <div className="space-y-2 rounded-md border border-success/40 bg-success/5 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-foreground">Purchase agreement on file</p>
            {!plan.agreementSignedAt ? <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openDialog(true)}><Pencil className="h-3 w-3" />Edit agreement or link</Button> : null}
          </div>
          <p className="flex flex-wrap items-center gap-2 text-foreground"><FileText className="h-3.5 w-3.5 text-brand" />{plan.agreementDoc}<Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => { if (!downloadAgreementFile(leadId)) toast("The uploaded copy is only available on the device it was uploaded from."); }}><Download className="h-3 w-3" />Download copy</Button></p>
          <a href={plan.agreementDocusignUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 break-all font-semibold text-brand hover:underline"><Link2 className="h-3.5 w-3.5 shrink-0" />{plan.agreementDocusignUrl}</a>
          <p className="text-muted-foreground">Sent {formatDateTime(plan.agreementUploadedAt)} by {plan.agreementUploadedBy}{plan.agreementSignedAt ? "" : ` — waiting for ${buyerName} to sign in DocuSign.`}</p>
          {plan.agreementSignedAt ? <p className="text-success">Signed by {plan.agreementSignedBy} on {formatDateTime(plan.agreementSignedAt)}. The mortgage company received the signed copy and the buyer's Loqal number.</p> : null}
          {plan.agreementHistory?.length ? <div className="border-t border-border pt-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Earlier versions</p>
            <ul className="mt-1 space-y-1">{[...plan.agreementHistory].reverse().map((h) => <li key={h.sentAt} className="text-muted-foreground"><span className="line-through">{h.doc}</span> · <a href={h.url} target="_blank" rel="noopener noreferrer" className="break-all hover:underline">{h.url}</a> · sent {formatDateTime(h.sentAt)}</li>)}</ul>
          </div> : null}
        </div> : <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-brand/30 bg-brand-tint/20 p-3">
          <p className="font-semibold text-foreground">Step 2 — agreement for e-signing <span className="font-normal text-muted-foreground">(due {formatDateTime(new Date(new Date(plan.sellerAgreedAt).getTime() + 48 * 3600e3).toISOString())})</span></p>
          <Button size="sm" onClick={() => openDialog(false)}><Upload />Share the agreement</Button>
        </div>}
      </> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit the agreement or link" : "Share the purchase agreement"}</DialogTitle>
            <DialogDescription>{confirming ? `Check everything before it goes to ${buyerName}.` : `Upload the agreement and paste the DocuSign link so ${buyerName} can sign electronically.`}</DialogDescription>
          </DialogHeader>
          {!confirming ? <div className="space-y-3 text-xs">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-3 font-semibold text-muted-foreground hover:text-foreground"><Upload className="h-3.5 w-3.5" />{docName ? `${docName} · replace` : "Upload the purchase agreement"}<input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setDocName(f.name); void storeAgreementFile(leadId, f); } e.target.value = ""; }} /></label>
            <div className="flex items-center gap-2"><Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><input className={input} value={link} onChange={(e) => setLink(e.target.value)} placeholder="DocuSign signing link — https://…" /></div>
            {editing ? <p className="text-muted-foreground">The version already sent stays on file as history.</p> : null}
          </div> : <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-xs">
            <p><span className="text-muted-foreground">Property:</span> <strong>{propertyLabel}</strong> · {formatPrice(purchase.offerPrice)}</p>
            <p className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-brand" />{docName}</p>
            <p className="flex items-center gap-1.5 break-all"><Link2 className="h-3.5 w-3.5 shrink-0 text-brand" />{link.trim()}</p>
            <p className="text-muted-foreground">{buyerName} will be notified to sign in DocuSign.</p>
          </div>}
          <DialogFooter>
            {confirming ? <><Button variant="ghost" onClick={() => setConfirming(false)}>Back</Button><Button onClick={sendAgreement}><Check />Confirm and send</Button></>
              : <><Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={review}>Review before sending</Button></>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
