/**
 * Buyer side, after signing: send the inspections agreed in the purchase
 * terms to Loqal's inspection partners and follow the job to the report.
 */
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ClipboardCheck, Download, Search } from "lucide-react";
import { useEntityPlan } from "@/lib/entity-structure";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getProperty } from "@/data/properties";
import { completeTerms, propertyCategory, stateFromLocation, type AgreementTerms } from "@/lib/purchase-agreement";
import {
  INSPECTION_STATUS_LABEL,
  createInspectionRequest,
  downloadInspectionReport,
  useInspectionRequests,
} from "@/lib/inspections";

export function InspectionOrderStep({ leadId, propertyId, propertyLabel, clientLabel, agentEmail }: {
  leadId: string; propertyId?: number | undefined; propertyLabel: string; clientLabel: string; agentEmail?: string | undefined;
}) {
  const { plan } = useEntityPlan(leadId);
  const { user } = useAuth();
  const { items, ready, refresh } = useInspectionRequests(leadId);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const terms = completeTerms(plan?.proposedTerms as Partial<AgreementTerms> | undefined);
  if (!plan?.agreementSignedAt || !terms.inspection || !terms.inspectionTypes.length) return null;

  const property = getProperty(propertyId ?? -1);
  const state = stateFromLocation(property?.location) ?? "";
  const deadline = new Date(new Date(plan.agreementSignedAt).getTime() + terms.inspectionDeadlineDays * 86400000).toISOString();
  const active = items.find((i) => i.status !== "cancelled");

  async function send() {
    if (!state) { toast.error("We couldn't read the property's state — please contact Loqal support."); return; }
    setBusy(true);
    try {
      await createInspectionRequest({
        leadId, clientEmail: user?.email ?? "", clientLabel, agentEmail, propertyId: propertyId == null ? undefined : String(propertyId), propertyLabel, state,
        propertyCategory: propertyCategory(property?.type), inspectionTypes: terms.inspectionTypes,
        deadlineDays: terms.inspectionDeadlineDays, agreementSignedAt: plan!.agreementSignedAt,
      });
      notify({ id: `inspection-request-${leadId}`, to: "admins", title: "New inspection request", body: `${propertyLabel} (${state}) — ${terms.inspectionTypes.join(", ")}. Inspection period ends ${formatDate(deadline)}.`, href: "/admin", severity: "info" });
      if (agentEmail) notify({ id: `inspection-request-agent-${leadId}`, to: agentEmail.toLowerCase(), title: "Your buyer ordered the inspections", body: `${propertyLabel} — ${clientLabel} sent the inspection request to Loqal's inspection partners.`, href: `/partner?tab=buyers&focus=${leadId}`, severity: "info" });
      toast("Inspection request sent", { description: "Inspection companies covering this area can now accept it." });
      setConfirming(false);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The request didn't go through.");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <ClipboardCheck className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Property inspections</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Your inspection period ends on <b className="text-foreground">{formatDate(deadline)}</b> ({terms.inspectionDeadlineDays} days from signing). Inspect early so there is time to ask for repairs or credits.</p>
        </div>
        {active ? <span className="shrink-0 rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand">{INSPECTION_STATUS_LABEL[active.status]}</span> : null}
      </div>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {terms.inspectionTypes.map((t) => <li key={t} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground">{t}</li>)}
      </ul>

      {!ready ? null : !active ? (
        confirming ? (
          <div className="mt-3 rounded-md border border-brand/30 bg-brand-tint/30 p-3 text-xs">
            <p className="font-semibold text-foreground">Send this request to inspection companies in {state || "the property's state"}?</p>
            <p className="mt-1 text-muted-foreground">Only Loqal-verified, licensed companies see it. You'll see the company, fee and proposed date once one accepts. Your full name isn't shared — only your first name and client number.</p>
            <div className="mt-2 flex gap-2">
              <button type="button" disabled={busy} onClick={send} className="rounded-md bg-brand px-3 py-1.5 font-semibold text-background disabled:opacity-60">{busy ? "Sending…" : "Confirm and send"}</button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-border px-3 py-1.5 text-foreground">Cancel</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="mt-3 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background">Order the inspections</button>
        )
      ) : active.status === "open" ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Search className="h-3.5 w-3.5" aria-hidden /> Sent {formatDateTime(active.createdAt)} — waiting for an inspection company to accept.</p>
      ) : (
        <div className="mt-3 space-y-2 rounded-md border border-success/30 bg-success/5 p-3 text-xs">
          <p className="flex items-center gap-2 font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden /> {active.inspectorCompany}</p>
          {active.inspectorContact ? <p className="text-muted-foreground">{[active.inspectorContact.name, active.inspectorContact.phone, active.inspectorContact.email].filter(Boolean).join(" · ")}</p> : null}
          {active.fee != null ? <p className="text-muted-foreground">Fee: <b className="text-foreground">${active.fee.toLocaleString("en-US")}</b> — paid directly to the inspector.</p> : null}
          <p className="text-muted-foreground">{active.scheduledAt ? <>Scheduled for <b className="text-foreground">{formatDateTime(active.scheduledAt)}</b></> : active.proposedAt ? <>Proposed date: <b className="text-foreground">{formatDateTime(active.proposedAt)}</b></> : null}</p>
          {active.reportFiles.map((r) => (
            <button key={r.path} type="button" onClick={() => downloadInspectionReport(r).catch(() => toast.error("Download failed"))} className="flex items-center gap-1.5 font-semibold text-brand"><Download className="h-3.5 w-3.5" aria-hidden /> {r.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}
