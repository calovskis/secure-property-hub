import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Landmark, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/form/DateInput";
import { formatPrice } from "@/data/properties";
import { notify } from "@/lib/notifications";
import { useEntityPlan } from "@/lib/entity-structure";
import { completeTerms, HOME_WARRANTY_LABEL, POSSESSION_LABEL, termsSummary, type AgreementTerms, type HomeWarrantyMode, type PaymentMode, type PossessionMode } from "@/lib/purchase-agreement";
import type { PurchaseRequest } from "@/lib/property-requests";

const STEPS = [
  { id: 1, title: "Offer basics", icon: Landmark },
  { id: 2, title: "Protections", icon: ShieldCheck },
  { id: 3, title: "Deadlines & costs", icon: ClipboardCheck },
  { id: 4, title: "Review & send", icon: Check },
] as const;
const fieldClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";
const labelClass = "mb-1.5 block text-xs font-semibold text-foreground";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block rounded-md border border-border bg-background p-3"><span className={labelClass}>{label}</span>{children}</label>;
}

export function PurchaseTermsDialog({ open, onOpenChange, leadId, propertyLabel, purchase, buyerName, buyerEmail, agentName }: {
  open: boolean; onOpenChange: (open: boolean) => void; leadId: string; propertyLabel: string; purchase: PurchaseRequest; buyerName: string; buyerEmail?: string | undefined; agentName: string;
}) {
  const { plan, savePlan } = useEntityPlan(leadId);
  const [terms, setTerms] = useState(() => completeTerms((plan?.draftTerms ?? plan?.proposedTerms) as Partial<AgreementTerms> | undefined));
  const [step, setStep] = useState(plan?.termsDraftStep ?? 1);
  const [note, setNote] = useState(plan?.termsNote ?? "");
  const [reviewed, setReviewed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTerms(completeTerms((plan?.draftTerms ?? plan?.proposedTerms) as Partial<AgreementTerms> | undefined));
    setStep(Math.min(4, Math.max(1, plan?.termsDraftStep ?? 1)));
    setNote(plan?.termsNote ?? "");
    setReviewed(false);
  }, [open]);

  const selectedProtections = useMemo(() => [terms.inspection, terms.appraisal, terms.financing, terms.titleReview, terms.surveyReview, terms.dueDiligenceReview].filter(Boolean).length, [terms]);
  function patch(next: Partial<AgreementTerms>) {
    setTerms((current) => { const updated = { ...current, ...next }; savePlan({ draftTerms: updated }); return updated; });
  }
  function goTo(next: number) {
    const bounded = Math.min(4, Math.max(1, next)); setStep(bounded); savePlan({ draftTerms: terms, termsDraftStep: bounded, termsNote: note.trim() || undefined });
  }
  function sendToBuyer() {
    if (!reviewed) return;
    if (!terms.closingDate || !terms.agreementExpiresAt) { toast("Add the closing date and offer expiration before sending."); return; }
    if (terms.agreementExpiresAt > terms.closingDate) { toast("The offer must expire before the target closing date."); return; }
    const now = new Date().toISOString();
    savePlan({ draftTerms: terms, proposedTerms: terms, termsProposedAt: now, termsProposedBy: agentName, termsRound: (plan?.termsRound ?? 0) + 1, termsNote: note.trim() || undefined, termsChangeRequestedAt: undefined, termsChangeNote: undefined, termsConfirmedAt: undefined, termsConfirmedBy: undefined, termsDraftStep: 4 });
    if (buyerEmail) notify({ id: `terms-proposed-${leadId}-${(plan?.termsRound ?? 0) + 1}`, to: buyerEmail.toLowerCase(), title: "Your agent proposed the purchase terms — your confirmation is needed", body: `${propertyLabel} at ${formatPrice(purchase.offerPrice)}. Review the complete terms before they are presented to the seller.`, href: `/property/${purchase.propertyId}/workspace?open=agreement`, severity: "warning" });
    toast("Terms sent to the buyer", { description: `${buyerName} must confirm them before they go to the seller.` }); onOpenChange(false);
  }

  const checks: [keyof AgreementTerms, string, string][] = [
    ["inspection", "Inspection contingency", "Inspect, request repairs or credits, or withdraw by the deadline."],
    ["appraisal", "Appraisal contingency", "Protection if the appraised value is below the purchase price."],
    ["financing", "Financing / mortgage contingency", "The purchase depends on obtaining the agreed financing."],
    ["titleReview", "Title and lien review", "Object to title defects, liens, or unacceptable encumbrances."],
    ["surveyReview", "Survey / boundary review", "Request a new or updated survey when needed."],
    ["dueDiligenceReview", "Due diligence / HOA review", "Review association documents, permits, zoning, leases, and records."],
    ["assignable", "Right to transfer the purchase", "Allow transfer to the buyer's company or another approved buyer."],
  ];
  const deadlines: [keyof AgreementTerms, string][] = [["inspectionDeadline", "Inspection period ends"], ["appraisalDeadline", "Appraisal deadline"], ["mortgageSubmissionDeadline", "Mortgage submission deadline"], ["finalLoanApprovalDeadline", "Final loan approval deadline"], ["titleObjectionDeadline", "Title objection deadline"], ["agreementExpiresAt", "Offer expiration"]];

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex max-h-[92vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
    <DialogHeader className="border-b border-border px-5 py-4 pr-12"><DialogTitle>Purchase terms for {buyerName}</DialogTitle><DialogDescription>{propertyLabel} · Buyer offer {formatPrice(purchase.offerPrice)} · Draft saves automatically</DialogDescription></DialogHeader>
    <ol className="grid grid-cols-2 border-b border-border bg-muted/30 sm:grid-cols-4">{STEPS.map(({ id, title, icon: Icon }) => <li key={id}><Button type="button" variant="ghost" onClick={() => goTo(id)} className={`flex h-14 w-full items-center justify-start gap-2 rounded-none border-r border-border px-3 text-left text-xs font-semibold last:border-r-0 ${step === id ? "bg-brand-tint text-brand hover:bg-brand-tint" : id < step ? "text-success" : "text-muted-foreground"}`}><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${step === id ? "border-brand bg-brand text-background" : id < step ? "border-success bg-success/10" : "border-border bg-background"}`}>{id < step ? <Check /> : <Icon />}</span><span>{id}. {title}</span></Button></li>)}</ol>
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
      {step === 1 ? <div className="space-y-4"><div><h3 className="text-base font-semibold text-foreground">Offer basics</h3><p className="mt-1 text-sm text-muted-foreground">Set the deposit, payment, closing and handover terms.</p></div><div className="grid gap-3 md:grid-cols-2">
        <Field label="Earnest money deposit"><div className="flex flex-wrap gap-2">{[5, 10, 15].map((amount) => <Button key={amount} type="button" size="sm" variant={terms.depositPct === amount ? "default" : "outline"} onClick={() => patch({ depositPct: amount })}>{amount}%</Button>)}</div><p className="mt-2 text-xs text-muted-foreground">{formatPrice((purchase.offerPrice * terms.depositPct) / 100)} held in escrow</p></Field>
        <Field label="Deposit due (business days)"><input type="number" min="1" value={terms.depositDays} onChange={(e) => patch({ depositDays: Number(e.target.value) })} className={fieldClass} /></Field>
        <Field label="How the purchase is paid"><select value={terms.paymentMode} onChange={(e) => patch({ paymentMode: e.target.value as PaymentMode })} className={fieldClass}><option value="financed">Mortgage</option><option value="cash">All cash</option><option value="seller_finance">Seller financing</option></select></Field>
        <Field label="Target closing date"><DateInput value={terms.closingDate} onChange={(value) => patch({ closingDate: value })} className={fieldClass} /></Field>
        <Field label="Possession / key handover"><select value={terms.possession} onChange={(e) => patch({ possession: e.target.value as PossessionMode })} className={fieldClass}>{Object.entries(POSSESSION_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Attorney review (business days)"><input type="number" min="0" value={terms.attorneyReviewDays} onChange={(e) => patch({ attorneyReviewDays: Number(e.target.value) })} className={fieldClass} /></Field>
      </div></div> : null}
      {step === 2 ? <div className="space-y-4"><div><h3 className="text-base font-semibold text-foreground">Contingencies and protections</h3><p className="mt-1 text-sm text-muted-foreground">Choose the safeguards that should be carried into the offer.</p></div><div className="grid gap-2 md:grid-cols-2">{checks.map(([key, title, detail]) => <label key={key} className="flex cursor-pointer gap-3 rounded-md border border-border bg-background p-3"><input type="checkbox" checked={Boolean(terms[key])} onChange={(e) => patch({ [key]: e.target.checked })} className="mt-1 accent-brand" /><span><span className="block text-sm font-semibold text-foreground">{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{detail}</span></span></label>)}</div><div className="grid gap-3 md:grid-cols-2"><Field label="Inspection period (days)"><input type="number" min="0" value={terms.inspectionDays} onChange={(e) => patch({ inspectionDays: Number(e.target.value) })} className={fieldClass} /></Field><Field label="Financing period (days)"><input type="number" min="0" value={terms.financingDays} onChange={(e) => patch({ financingDays: Number(e.target.value) })} className={fieldClass} /></Field></div></div> : null}
      {step === 3 ? <div className="space-y-5"><div><h3 className="text-base font-semibold text-foreground">Deadlines and costs</h3><p className="mt-1 text-sm text-muted-foreground">Record the dates and financial details the buyer should review.</p></div><section><h4 className="mb-2 text-sm font-semibold text-foreground">Important deadlines</h4><div className="grid gap-3 md:grid-cols-2">{deadlines.map(([key, label]) => <Field key={key} label={label}><DateInput value={String(terms[key])} onChange={(value) => patch({ [key]: value })} className={fieldClass} /></Field>)}</div></section><section><h4 className="mb-2 text-sm font-semibold text-foreground">Property and costs</h4><div className="grid gap-3 md:grid-cols-2">
        <Field label="Included with the property"><input value={terms.includedItems} onChange={(e) => patch({ includedItems: e.target.value })} className={fieldClass} /></Field><Field label="Excluded from the sale"><input value={terms.excludedItems} onChange={(e) => patch({ excludedItems: e.target.value })} className={fieldClass} /></Field>
        <Field label="Seller concessions / credits"><input value={terms.sellerConcessions} onChange={(e) => patch({ sellerConcessions: e.target.value })} placeholder="Amount, terms, or none" className={fieldClass} /></Field><Field label="Home warranty"><select value={terms.homeWarranty} onChange={(e) => patch({ homeWarranty: e.target.value as HomeWarrantyMode })} className={fieldClass}>{Object.entries(HOME_WARRANTY_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="Closing costs allocation"><input value={terms.closingCostsAllocation} onChange={(e) => patch({ closingCostsAllocation: e.target.value })} className={fieldClass} /></Field><Field label="Buyer's agent commission (%)"><input type="number" min="0" max="6" step="0.5" value={terms.commissionPct} onChange={(e) => patch({ commissionPct: Number(e.target.value) })} className={fieldClass} /></Field>
        <div className="md:col-span-2"><Field label="Prorations and adjustments"><input value={terms.prorationsNote} onChange={(e) => patch({ prorationsNote: e.target.value })} className={fieldClass} /></Field></div><div className="md:col-span-2"><Field label="Special terms and disclosures"><textarea rows={3} value={terms.specialTerms} onChange={(e) => patch({ specialTerms: e.target.value })} placeholder="Repairs, credits, lease details, personal property, sale conditions, or other negotiated terms" className={fieldClass} /></Field></div>
      </div></section></div> : null}
      {step === 4 ? <div className="space-y-4"><div><h3 className="text-base font-semibold text-foreground">Review before sending</h3><p className="mt-1 text-sm text-muted-foreground">This is exactly what {buyerName} will review and confirm before anything goes to the seller.</p></div><div className="grid gap-x-6 rounded-md border border-border bg-background p-4 md:grid-cols-2">{termsSummary(purchase.offerPrice, terms).map((row) => <div key={row.label} className="border-b border-border/60 py-2.5"><div className="text-[11px] font-semibold uppercase text-muted-foreground">{row.label}</div><div className="mt-1 text-sm text-foreground">{row.value}</div></div>)}</div><label className="block"><span className={labelClass}>Note to {buyerName} (optional)</span><textarea rows={3} value={note} onChange={(e) => { setNote(e.target.value); savePlan({ termsNote: e.target.value || undefined }); }} className={fieldClass} placeholder="Explain why you recommend these terms." /></label><div className="rounded-md border border-brand/30 bg-brand-tint/30 p-3 text-sm text-foreground"><strong>{selectedProtections} protections selected.</strong> The buyer may confirm these terms or request changes. Only confirmed terms can be presented to the seller.</div><label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-1 accent-brand" /><span className="text-sm font-medium text-foreground">I reviewed these terms and they are ready to send to {buyerName}.</span></label></div> : null}
    </div>
    <div className="flex flex-col-reverse gap-2 border-t border-border bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><Button type="button" variant="outline" disabled={step === 1} onClick={() => goTo(step - 1)}><ArrowLeft />Back</Button><div className="flex items-center justify-end gap-2"><span className="mr-2 hidden text-xs text-success sm:inline">Draft saved</span>{step < 4 ? <Button type="button" onClick={() => goTo(step + 1)}>Continue<ArrowRight /></Button> : <Button type="button" disabled={!reviewed} onClick={sendToBuyer}><Check />Send to buyer for confirmation</Button>}</div></div>
  </DialogContent></Dialog>;
}
