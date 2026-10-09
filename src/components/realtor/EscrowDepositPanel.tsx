/**
 * Realtor side, after the buyer signs: share escrow details for the earnest
 * money deposit, then review the buyer's payment confirmation.
 */
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Download, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DateInput } from "@/components/form/DateInput";
import { useEntityPlan, type EscrowDetails } from "@/lib/entity-structure";
import { notify } from "@/lib/notifications";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatPrice } from "@/data/properties";
import { completeTerms, depositAmount, type AgreementTerms } from "@/lib/purchase-agreement";
import { downloadDepositProof } from "@/lib/agreement-files";

const input = "w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-brand";

export function EscrowDepositPanel({ leadId, propertyId, propertyLabel, offerPrice, buyerName, buyerEmail, agentName }: {
  leadId: string; propertyId: number; propertyLabel: string; offerPrice: number; buyerName: string; buyerEmail?: string | undefined; agentName: string;
}) {
  const { plan, savePlan } = useEntityPlan(leadId);
  const terms = plan?.proposedTerms as AgreementTerms | undefined;
  const suggested = terms ? formatPrice(depositAmount(offerPrice, completeTerms(terms, terms.paymentMode === "financed"))) : "";
  const blank = { holder: "", holderContact: "", bankName: "", accountName: "", routingNumber: "", accountNumber: "", reference: "", amount: suggested, dueBy: "", notes: "" };
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [f, setF] = useState(blank);
  const e = plan?.escrowDetails;
  if (!plan?.agreementSignedAt) return null;

  const set = (k: keyof typeof blank) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const ready = f.holder && f.bankName && f.accountName && f.routingNumber && f.accountNumber && f.amount;

  function send() {
    const now = new Date().toISOString();
    const details: EscrowDetails = { ...f, sharedAt: now, sharedBy: agentName };
    savePlan({ escrowDetails: details });
    if (buyerEmail)
      notify({
        id: `escrow-details-${leadId}-${now}`,
        to: buyerEmail.toLowerCase(),
        title: e ? "Escrow payment details were updated" : "Pay your earnest money deposit",
        body: `${propertyLabel} — ${f.amount} to ${f.holder}${f.dueBy ? ` by ${formatDate(f.dueBy)}` : ""}. Open the instructions and upload your payment confirmation.`,
        href: `/property/${propertyId}/workspace?open=agreement`,
        severity: "warning",
      });
    toast("Escrow details sent", { description: `${buyerName} can pay the deposit now.` });
    setOpen(false); setConfirming(false);
  }

  function confirmReceived() {
    const now = new Date().toISOString();
    savePlan({ depositConfirmedAt: now, depositConfirmedBy: agentName });
    if (buyerEmail)
      notify({
        id: `deposit-confirmed-${leadId}`,
        to: buyerEmail.toLowerCase(),
        title: "Escrow received your earnest money deposit",
        body: `${propertyLabel} — ${agentName} confirmed escrow received the funds.`,
        href: `/property/${propertyId}/workspace?open=agreement`,
        severity: "info",
      });
    toast("Deposit confirmed");
  }

  const field = (label: string, k: keyof typeof blank, ph = "") => (
    <label className="block space-y-1"><span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
      <input value={f[k]} onChange={(ev) => set(k)(ev.target.value)} placeholder={ph} className={input} /></label>
  );

  return (
    <div className="space-y-2 rounded-md border border-brand/30 bg-brand-tint/20 p-3">
      <p className="flex items-center gap-1.5 font-semibold text-foreground"><Landmark className="h-3.5 w-3.5 text-brand" />Earnest money deposit</p>
      {!e ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground">{buyerName} signed — share the escrow account so they can pay the deposit{suggested ? ` (${suggested})` : ""}.</p>
          <Button size="sm" onClick={() => { setF(blank); setOpen(true); }}><Landmark />Share escrow details</Button>
        </div>
      ) : (
        <>
          <p className="text-muted-foreground">{e.amount} to {e.holder} · {e.bankName} · acct …{e.accountNumber.slice(-4)}{e.dueBy ? ` · due ${formatDate(e.dueBy)}` : ""}. Shared {formatDateTime(e.sharedAt)}.</p>
          {plan.depositConfirmedAt ? (
            <p className="flex items-center gap-1.5 font-semibold text-success"><CheckCircle2 className="h-3.5 w-3.5" />Escrow received the deposit · {formatDateTime(plan.depositConfirmedAt)}</p>
          ) : plan.depositProofUploadedAt ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">{buyerName} uploaded {plan.depositProofName} · {formatDateTime(plan.depositProofUploadedAt)}</span>
              <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" onClick={() => { void downloadDepositProof(leadId, plan.depositProofName).then((ok) => { if (!ok) toast.error("The payment confirmation could not be found."); }); }}><Download className="h-3 w-3" />Download</Button>
              <Button size="sm" className="h-7 px-2 text-xs" onClick={confirmReceived}><CheckCircle2 className="h-3 w-3" />Escrow received the funds</Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground">Waiting for {buyerName} to pay and upload the payment confirmation.</p>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setF({ ...blank, ...e, holderContact: e.holderContact ?? "", reference: e.reference ?? "", dueBy: e.dueBy ?? "", notes: e.notes ?? "" }); setOpen(true); }}>Edit details</Button>
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirming(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{confirming ? "Confirm the escrow details" : "Escrow account for the deposit"}</DialogTitle>
            <DialogDescription>{confirming ? `Please double-check — ${buyerName} will wire funds to this account.` : "Shared with the buyer together with payment instructions."}</DialogDescription>
          </DialogHeader>
          {confirming ? (
            <dl className="space-y-1 text-xs">
              {([["Amount", f.amount], ["Pay by", f.dueBy ? formatDate(f.dueBy) : ""], ["Escrow holder", f.holder], ["Contact", f.holderContact], ["Bank", f.bankName], ["Account name", f.accountName], ["Routing (ABA)", f.routingNumber], ["Account number", f.accountNumber], ["Reference", f.reference], ["Note", f.notes]] as const).filter(([, v]) => v).map(([l, v]) => (
                <div key={l} className="flex justify-between gap-3 border-b border-border py-1"><dt className="text-muted-foreground">{l}</dt><dd className="text-right font-semibold text-foreground break-all">{v}</dd></div>
              ))}
            </dl>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {field("Deposit amount *", "amount", "$10,000")}
              <label className="block space-y-1"><span className="text-[11px] font-semibold text-muted-foreground">Pay by</span><DateInput value={f.dueBy} onChange={set("dueBy")} /></label>
              {field("Escrow holder (title / escrow company) *", "holder")}
              {field("Escrow contact (name, phone)", "holderContact")}
              {field("Bank name *", "bankName")}
              {field("Account name *", "accountName")}
              {field("Routing number (ABA) *", "routingNumber")}
              {field("Account number *", "accountNumber")}
              <div className="sm:col-span-2">{field("Payment reference", "reference", "e.g. escrow / file number")}</div>
              <label className="block space-y-1 sm:col-span-2"><span className="text-[11px] font-semibold text-muted-foreground">Note for the buyer</span>
                <textarea rows={2} value={f.notes} onChange={(ev) => set("notes")(ev.target.value)} className={input} /></label>
            </div>
          )}
          <DialogFooter>
            {confirming ? (
              <><Button variant="outline" onClick={() => setConfirming(false)}>Back</Button><Button onClick={send}>Confirm and send</Button></>
            ) : (
              <Button disabled={!ready} onClick={() => setConfirming(true)}>Review</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
