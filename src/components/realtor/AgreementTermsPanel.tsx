import { useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardList, Upload } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { formatPrice } from "@/data/properties";
import { useEntityPlan } from "@/lib/entity-structure";
import { termsSummary, type AgreementTerms } from "@/lib/purchase-agreement";
import type { PurchaseRequest } from "@/lib/property-requests";
import { PurchaseTermsDialog } from "@/components/realtor/PurchaseTermsDialog";

const btnPrimary = "inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background shadow-sm transition hover:bg-brand-soft disabled:opacity-50";
const btnGhost = "rounded-md border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-brand/50 hover:text-foreground";

export function AgreementTermsPanel({ leadId, propertyId, propertyLabel, purchase, buyerName, buyerEmail, agentName }: {
  leadId: string; propertyId: number; propertyLabel: string; purchase: PurchaseRequest; buyerName: string; buyerEmail?: string | undefined; agentName: string;
}) {
  const { plan, savePlan } = useEntityPlan(leadId);
  const saved = plan?.proposedTerms as AgreementTerms | undefined;
  const [open, setOpen] = useState(false);
  const confirmed = Boolean(plan?.termsConfirmedAt);
  const awaitingBuyer = Boolean(plan?.termsProposedAt) && !confirmed && !plan?.termsChangeRequestedAt;
  const changeAsked = Boolean(plan?.termsChangeRequestedAt) && !confirmed;
  const needsAgent = !plan?.termsProposedAt || changeAsked;

  function uploadAgreement(fileName: string) {
    const now = new Date().toISOString();
    savePlan({ agreementDoc: fileName, agreementUploadedAt: now, agreementUploadedBy: agentName });
    if (buyerEmail) notify({ id: `agreement-ready-${leadId}-${now}`, to: buyerEmail.toLowerCase(), title: "Your purchase agreement is ready to sign", body: `${propertyLabel} at ${formatPrice(purchase.offerPrice)} — review the agreement and sign it.`, href: `/property/${propertyId}/workspace?open=agreement`, severity: "warning" });
    toast("Agreement uploaded", { description: `${buyerName} can review and sign it now.` });
  }

  return <div className={`mt-3 rounded-lg border-l-4 p-3 text-xs shadow-sm ${needsAgent ? "border-l-brand border border-border bg-background ring-1 ring-brand/20" : "border-l-border border border-border/60 bg-muted/40"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-foreground">Purchase terms for the seller</span>{needsAgent ? <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase text-background"><AlertCircle />Action needed</span> : confirmed ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success"><CheckCircle2 />Confirmed by {buyerName}</span> : <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Waiting for the buyer</span>}</div>
    <p className="mt-1.5 text-muted-foreground">You prepare the full terms and send them to {buyerName}. Only after the buyer confirms can you present them to the seller.</p>
    {changeAsked ? <p className="mt-2 rounded-md border border-gold/40 bg-gold-tint/40 px-2.5 py-2 text-foreground"><strong>{buyerName} asked for a change</strong>{plan?.termsChangeRequestedAt ? ` (${formatDateTime(plan.termsChangeRequestedAt)})` : ""}: {plan?.termsChangeNote || "no details given"}</p> : null}
    {confirmed ? <><p className="mt-2 font-semibold text-success">Ready for seller presentation</p><p className="mt-1 text-muted-foreground">Confirmed {plan?.termsConfirmedAt ? formatDateTime(plan.termsConfirmedAt) : ""}. If the seller suggests changes, return to the terms and send the revised version to {buyerName} again before agreement.</p><div className="mt-3 rounded-md border border-border bg-background p-3"><p className="font-semibold text-foreground">Purchase agreement</p>{plan?.agreementSignedAt ? <p className="mt-1 text-success">Signed by {plan.agreementSignedBy} on {formatDateTime(plan.agreementSignedAt)}{plan.agreementDoc ? ` · ${plan.agreementDoc}` : ""}. The mortgage company received the signed copy and the buyer's Loqal number.</p> : <><p className="mt-1 text-muted-foreground">{plan?.agreementDoc ? `${plan.agreementDoc} uploaded ${plan.agreementUploadedAt ? formatDateTime(plan.agreementUploadedAt) : ""} — waiting for ${buyerName} to sign.` : `Once the seller agrees, upload the agreement here for ${buyerName} to review and sign.`}</p><label className={`${btnGhost} mt-2 inline-flex cursor-pointer items-center gap-1.5`}><Upload />{plan?.agreementDoc ? "Replace the agreement" : "Upload the purchase agreement"}<input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadAgreement(file.name); e.target.value = ""; }} /></label></>}</div></> : null}
    <div className="mt-3 rounded-md border border-brand/30 bg-brand-tint/20 p-3">{saved ? <ul className="grid gap-x-5 gap-y-1 sm:grid-cols-2">{termsSummary(purchase.offerPrice, saved).slice(0, 6).map((row) => <li key={row.label} className="text-muted-foreground"><span className="font-semibold text-foreground">{row.label}:</span> {row.value}</li>)}</ul> : <p className="text-muted-foreground">Build the proposed offer in four short sections. Your draft is saved as you go.</p>}<button type="button" onClick={() => setOpen(true)} className={`${btnPrimary} mt-3`}><ClipboardList />{needsAgent ? (changeAsked ? "Revise purchase terms" : plan?.draftTerms ? "Continue purchase terms" : "Prepare purchase terms") : confirmed ? "View purchase terms" : "Review sent terms"}</button></div>
    {awaitingBuyer ? <p className="mt-2 text-muted-foreground">Sent {plan?.termsProposedAt ? formatDateTime(plan.termsProposedAt) : ""} — waiting for {buyerName} to confirm before anything goes to the seller.</p> : null}
    <PurchaseTermsDialog open={open} onOpenChange={setOpen} leadId={leadId} propertyLabel={propertyLabel} purchase={purchase} buyerName={buyerName} buyerEmail={buyerEmail} agentName={agentName} />
  </div>;
}
