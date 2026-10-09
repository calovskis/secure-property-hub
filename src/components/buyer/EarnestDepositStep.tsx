/**
 * Buyer side, after signing: earnest money deposit instructions from the
 * buyer's agent and upload of the payment confirmation.
 */
import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Landmark, Upload } from "lucide-react";
import { useEntityPlan } from "@/lib/entity-structure";
import { notify } from "@/lib/notifications";
import { formatDate, formatDateTime } from "@/lib/dates";
import { storeDepositProof } from "@/lib/agreement-files";

export function EarnestDepositStep({ leadId, agentName, agentEmail, clientLabel, propertyLabel }: {
  leadId: string; agentName: string; agentEmail?: string | undefined; clientLabel: string; propertyLabel: string;
}) {
  const { plan, savePlan } = useEntityPlan(leadId);
  const [busy, setBusy] = useState(false);
  const e = plan?.escrowDetails;

  async function upload(file: File) {
    setBusy(true);
    try {
      await storeDepositProof(leadId, file);
      const now = new Date().toISOString();
      savePlan({ depositProofName: file.name, depositProofUploadedAt: now });
      if (agentEmail)
        notify({
          id: `deposit-proof-${leadId}-${now}`,
          to: agentEmail.toLowerCase(),
          title: "Your buyer paid the earnest money deposit",
          body: `${propertyLabel} — ${clientLabel} uploaded the payment confirmation. Please confirm with escrow that the funds arrived.`,
          href: `/partner?tab=buyers&focus=${leadId}`,
          severity: "warning",
        });
      toast("Payment confirmation uploaded", { description: `${agentName} will confirm with escrow that the funds arrived.` });
    } catch {
      toast.error("The upload didn't go through. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (plan?.depositConfirmedAt)
    return (
      <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-xs">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-success" />Earnest money deposit received by escrow</p>
        <p className="mt-1 text-muted-foreground">Confirmed by {plan.depositConfirmedBy} on {formatDateTime(plan.depositConfirmedAt)}.</p>
      </div>
    );

  if (!e)
    return (
      <div className="rounded-lg border border-brand/30 bg-brand-tint/20 p-4 text-xs">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Clock className="h-4 w-4 text-brand" />Next — your earnest money deposit</p>
        <p className="mt-1 text-muted-foreground">
          {agentName} will share the escrow account details here shortly. You'll be notified as soon as the payment instructions are ready.
        </p>
      </div>
    );

  const row = (label: string, value?: string) =>
    value ? <div className="flex justify-between gap-3 border-b border-border py-1.5 last:border-0"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-semibold text-foreground break-all">{value}</dd></div> : null;

  return (
    <div className="space-y-3 rounded-lg border-2 border-brand/50 bg-brand-tint/20 p-4 text-xs">
      <div>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Landmark className="h-4 w-4 text-brand" />Pay your earnest money deposit</p>
        <p className="mt-1 text-muted-foreground">
          Wire the deposit to the escrow account below, then upload your bank's payment confirmation. The deposit is held by escrow and credited toward your purchase at closing.
        </p>
      </div>
      <dl className="rounded-md border border-border bg-background px-3 py-1">
        {row("Amount", e.amount)}
        {row("Pay by", e.dueBy ? formatDate(e.dueBy) : undefined)}
        {row("Escrow holder", e.holder)}
        {row("Escrow contact", e.holderContact)}
        {row("Bank", e.bankName)}
        {row("Account name", e.accountName)}
        {row("Routing (ABA)", e.routingNumber)}
        {row("Account number", e.accountNumber)}
        {row("Payment reference", e.reference)}
      </dl>
      {e.notes ? <p className="rounded-md border border-border bg-background p-2 text-muted-foreground"><span className="font-semibold text-foreground">Note from {agentName}: </span>{e.notes}</p> : null}
      <p className="flex gap-2 rounded-md border border-gold/50 bg-gold-tint/30 p-2 text-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
        <span>Before wiring, call the escrow holder on a number you've verified independently to confirm these details. Wiring instructions never change by email — if you receive changed instructions, don't send money and contact {agentName} or Loqal right away.</span>
      </p>
      <p className="text-[11px] text-muted-foreground">Shared by {e.sharedBy} on {formatDateTime(e.sharedAt)}.</p>
      {plan?.depositProofUploadedAt ? (
        <p className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/10 p-2 font-semibold text-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          {plan.depositProofName} uploaded {formatDateTime(plan.depositProofUploadedAt)} — {agentName} is confirming receipt with escrow.
        </p>
      ) : null}
      <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold ${plan?.depositProofUploadedAt ? "border border-border text-muted-foreground hover:bg-brand-tint" : "bg-brand text-background hover:bg-brand-soft"} ${busy ? "pointer-events-none opacity-50" : ""}`}>
        <Upload className="h-4 w-4" />
        {busy ? "Uploading…" : plan?.depositProofUploadedAt ? "Replace payment confirmation" : "Upload payment confirmation"}
        <input type="file" accept=".pdf,image/*" className="sr-only" onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ""; if (f) void upload(f); }} />
      </label>
    </div>
  );
}
