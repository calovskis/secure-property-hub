/**
 * Purchase terms window for the buyer, opened once the buyer's agent confirms
 * the price.
 *
 *  Step 1 — the company: does the buyer already hold a US entity, will they buy
 *           through it, open one themselves, or should Loqal set the structure
 *           up (which raises a task and notification in the Loqal admin portal).
 *  Step 2 — the terms the buyer's agent proposes: the buyer confirms them so the
 *           agent can put them to the seller, or asks the agent to change
 *           something first.
 *
 * Loqal does not draft the agreement text here. Once the terms are agreed with
 * the seller, the buyer's agent uploads the actual agreement for review and
 * signing.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Building2, ClipboardCheck, Phone, ExternalLink, Clock } from "lucide-react";
import { TermsChangeRequest, type TermsChange } from "@/components/buyer/TermsChangeRequest";
import { CallScheduler } from "@/components/buyer/CallScheduler";
import { useBuyerProcess } from "@/lib/buyer-process";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StateCombobox } from "@/components/form/StateCombobox";
import { fullName, useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { formatPrice } from "@/data/properties";
import {
  CORPORATE_STRUCTURE_GUIDE,
  ENTITY_PATH_LABEL,
  LOQAL_SETUP_FEE_USD,
  RELATED_SERVICES_MAX_USD,
  SETUP_COST_LINES,
  useEntityPlan,
  type EntityPath,
} from "@/lib/entity-structure";
import { useEntityIntent } from "@/lib/entity-onboarding";
import { termsSummary, type AgreementTerms } from "@/lib/purchase-agreement";
import { CLOSING_STEPS } from "@/lib/closing-steps";
import { CounterCard } from "@/components/realtor/SellerResponsePanel";
import type { EntityPlan } from "@/lib/entity-structure";
import type { PurchaseRequest } from "@/lib/property-requests";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

const STEPS = [
  { id: 1, title: "The company", hint: "How the property is held" },
  { id: 2, title: "The terms", hint: "Confirm your agent's terms" },
] as const;

export function PurchaseAgreementWizard({
  open,
  onOpenChange,
  leadId,
  purchase,
  usPerson,
  agentName,
  agentEmail,
  clientLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string;
  purchase: PurchaseRequest;
  usPerson: boolean;
  agentName: string;
  agentEmail?: string | undefined;
  /** Privacy-safe label of the buyer used in partner/admin notifications. */
  clientLabel: string;
}) {
  const { user } = useAuth();
  const { plan, savePlan } = useEntityPlan(leadId);
  const { saveIntent } = useEntityIntent(user?.email);

  const [step, setStep] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [entityName, setEntityName] = useState(plan?.entityName ?? "");
  const [entityState, setEntityState] = useState(plan?.entityState ?? "");
  const [entityEin, setEntityEin] = useState(plan?.entityEin ?? "");
  const [askingChange, setAskingChange] = useState(false);
  const [askingCall, setAskingCall] = useState(false);
  const [callSlot, setCallSlot] = useState<string | null>(null);
  const [callMeetUrl, setCallMeetUrl] = useState<string | null>(null);
  const { bookCall } = useBuyerProcess();
  const [counterNote, setCounterNote] = useState("");

  const path = plan?.path;
  const decided = Boolean(path);
  const terms = plan?.proposedTerms as AgreementTerms | undefined;
  const proposed = Boolean(plan?.termsProposedAt && terms);
  const confirmed = Boolean(plan?.termsConfirmedAt);
  const changeAsked = Boolean(plan?.termsChangeRequestedAt) && !confirmed;
  /** The agent's terms are on the file — the buyer stays on the terms step. */
  const termsStarted = Boolean(plan?.termsProposedAt) || confirmed;

  /* Resume where the buyer left off. With terms in discussion the window always
     opens on the terms themselves, never back on the company step. */
  useEffect(() => {
    if (!open) return;
    setStep(
      termsStarted
        ? 2
        : Math.min(2, Math.max(1, plan?.wizardStep ?? (decided ? 2 : 1))),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function goTo(next: number) {
    setStep(next);
    if (next > (plan?.wizardStep ?? 1)) savePlan({ wizardStep: next });
  }

  function tellLoqal(id: string, title: string, body: string) {
    notify({
      id,
      to: "admins",
      title,
      body,
      href: `/admin?tab=cases&focus=${leadId}`,
      severity: "warning",
    });
  }

  function choosePath(
    next: EntityPath,
    extra?: { entityName?: string; entityState?: string; entityEin?: string },
  ) {
    const now = new Date().toISOString();
    savePlan({
      path: next,
      ...(extra ?? {}),
      wizardStep: 2,
      ...(next === "loqal_setup" ? { loqalSetupRequestedAt: now } : {}),
    });
    if (next === "existing_entity" && extra?.entityName) {
      saveIntent({
        hasEntity: true,
        entityName: extra.entityName,
        entityState: extra.entityState,
        entityEin: extra.entityEin,
        entityProvidedAt: now,
      });
    } else if (next === "loqal_setup") {
      saveIntent({ hasEntity: false, supportRequestedAt: now, termsAcceptedAt: now });
    }
    if (next === "loqal_setup") {
      tellLoqal(
        `entitysetup-${leadId}`,
        "Company set-up to be handled by Loqal",
        `${clientLabel} — ${purchase.propertyLabel} at ${formatPrice(
          purchase.offerPrice,
        )}. Managerial Set-up accepted; choose and open the holding structure for the property location and client profile.`,
      );
    }
    if (next === "own_setup") {
      tellLoqal(
        `entityown-${leadId}`,
        "Client is opening their own holding company",
        `${clientLabel} — ${purchase.propertyLabel}. They will send the company details when ready.`,
      );
    }
    if (next === "existing_entity") {
      tellLoqal(
        `entityexisting-${leadId}`,
        "Client will purchase through their existing US entity",
        `${clientLabel} — ${purchase.propertyLabel}. ${extra?.entityName ?? "Entity"} (${
          extra?.entityState || "state not given"
        }).`,
      );
    }
    toast("Saved", { description: "Your Loqal team has your ownership choice." });
    setStep(2);
  }

  function confirmTerms() {
    const now = new Date().toISOString();
    const signer = fullName(user ?? ({} as never));
    savePlan({
      termsConfirmedAt: now,
      termsConfirmedBy: signer,
      termsChangeRequestedAt: undefined,
      termsChangeNote: undefined,
      termsChangeItems: undefined,
      wizardStep: 2,
    });
    if (agentEmail) {
      notify({
        id: `terms-confirmed-${leadId}-${plan?.termsRound ?? 1}`,
        to: agentEmail.toLowerCase(),
        title: "Your buyer confirmed the purchase terms",
        body: `${purchase.propertyLabel} — ${formatPrice(purchase.offerPrice)} with ${clientLabel}. You can now put these terms to the seller.`,
        href: `/partner?tab=buyers&focus=${leadId}`,
        severity: "warning",
      });
    }
    tellLoqal(
      `terms-confirmed-admin-${leadId}`,
      "Buyer confirmed the purchase terms",
      `${clientLabel} — ${purchase.propertyLabel} at ${formatPrice(purchase.offerPrice)}. Going to the seller.`,
    );
    toast("Terms confirmed", { description: `${agentName} will put them to the seller.` });
  }

  /** Buyer accepts or declines the seller's counter-offer. */
  function answerCounter(decision: "accepted" | "declined") {
    if (decision === "declined" && !counterNote.trim()) {
      toast("Tell your agent why, so they can go back to the seller.");
      return;
    }
    const now = new Date().toISOString();
    savePlan({
      sellerCounterBuyerDecision: decision,
      sellerCounterBuyerAt: now,
      sellerCounterBuyerNote: counterNote.trim() || undefined,
      ...(decision === "accepted" ? { sellerAgreedAt: now } : {}),
    });
    if (agentEmail) {
      notify({
        id: `counter-${decision}-${leadId}-${now}`,
        to: agentEmail.toLowerCase(),
        title: decision === "accepted" ? "Your buyer accepted the seller's counter-offer" : "Your buyer declined the seller's counter-offer",
        body: `${purchase.propertyLabel} — ${clientLabel}${counterNote.trim() ? `: ${counterNote.trim()}` : ""}${decision === "accepted" ? ". Upload the agreement and DocuSign link within 48 hours." : ""}`,
        href: `/partner?tab=buyers&focus=${leadId}`,
        severity: "warning",
      });
    }
    setCounterNote("");
    toast(decision === "accepted" ? "Counter-offer accepted" : "Sent to your agent", {
      description: decision === "accepted" ? "The agreement follows within 48 hours." : `${agentName} will go back to the seller.`,
    });
  }

  /** Buyer confirms they signed in DocuSign. */
  function markDocusignSigned() {
    const now = new Date().toISOString();
    const typed = user ? fullName(user) : clientLabel;
    savePlan({ agreementSignedAt: now, agreementSignedBy: typed });
    if (agentEmail) {
      notify({
        id: `agreement-signed-agent-${leadId}`,
        to: agentEmail.toLowerCase(),
        title: "Your buyer signed the purchase agreement",
        body: `${purchase.propertyLabel} — ${formatPrice(purchase.offerPrice)} with ${clientLabel}.`,
        href: `/partner?tab=buyers&focus=${leadId}`,
        severity: "info",
      });
    }
    tellLoqal(
      `agreement-signed-admin-${leadId}`,
      "Purchase agreement signed",
      `${clientLabel} — ${purchase.propertyLabel} at ${formatPrice(purchase.offerPrice)}. The mortgage company has the signed copy for the loan submission.`,
    );
    toast("Agreement signed", {
      description: "Your mortgage company has been notified and receives the signed copy.",
    });
  }

  function askChange(changes: TermsChange[], extra: string) {
    const lines = changes.map((c) => (c.from ? `${c.label}: ${c.from} → ${c.to}` : `${c.label}: ${c.to}`));
    if (extra) lines.push(`Note: ${extra}`);
    const text = lines.join("; ");
    if (!text) {
      toast("Tell your agent what should be different.");
      return;
    }
    const now = new Date().toISOString();
    savePlan({
      termsChangeRequestedAt: now,
      termsChangeItems: changes.length ? changes : undefined,
      termsChangeNote: changes.length ? (extra || undefined) : text || undefined,
    });
    if (agentEmail) {
      notify({
        id: `terms-change-${leadId}-${now}`,
        to: agentEmail.toLowerCase(),
        title: "Your buyer asked to change the proposed terms",
        body: `${purchase.propertyLabel} — ${clientLabel}: ${text}`,
        href: `/partner?tab=buyers&focus=${leadId}`,
        severity: "warning",
      });
    }
    setAskingChange(false);
    toast("Sent to your agent", { description: `${agentName} will adjust the terms.` });
  }

  function onCallBooked(startAt: string, meeting?: { eventId?: string; meetUrl?: string | null; htmlLink?: string | null }) {
    bookCall({
      leadId,
      clientName: user ? fullName(user) : clientLabel,
      ...(user?.email ? { clientEmail: user.email } : {}),
      propertyLabel: purchase.propertyLabel,
      kind: "intro_call",
      startAt,
      ...(meeting?.eventId ? { googleEventId: meeting.eventId } : {}),
      ...(meeting?.meetUrl ? { meetUrl: meeting.meetUrl } : {}),
      ...(meeting?.htmlLink ? { calendarLink: meeting.htmlLink } : {}),
    });
    setCallSlot(startAt);
    setCallMeetUrl(meeting?.meetUrl ?? null);
    if (agentEmail) {
      notify({
        id: `terms-call-${leadId}-${startAt}`,
        to: agentEmail.toLowerCase(),
        title: "Your buyer booked a call about the terms",
        body: `${purchase.propertyLabel} — ${clientLabel} · ${formatDateTime(startAt)}`,
        href: `/partner?tab=buyers&focus=${leadId}`,
        severity: "info",
      });
    }
    toast("Call booked", { description: `${agentName} · ${formatDateTime(startAt)}` });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Purchase terms</DialogTitle>
          <DialogDescription>
            {agentName} confirmed {formatPrice(purchase.offerPrice)} for {purchase.propertyLabel}.
            Two steps: how the property is held, and your confirmation of the terms your agent will
            put to the seller.
          </DialogDescription>
        </DialogHeader>

        {/* stepper */}
        <ol className="grid grid-cols-2 gap-2">
          {STEPS.map((s) => {
            /* Once the terms are in discussion the buyer stays there — the
               company choice is settled and shown as done, not reopened. */
            const reachable = s.id === 1 ? !termsStarted : decided;
            const done = s.id === 1 ? decided && termsStarted : confirmed;
            const active = s.id === step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  disabled={!reachable}
                  onClick={() => goTo(s.id)}
                  className={`w-full rounded-md border px-3 py-2 text-left text-[11px] font-semibold transition-colors ${
                    active
                      ? "border-brand bg-brand-tint text-brand"
                      : done
                        ? "border-success/40 bg-success/5 text-success"
                        : reachable
                          ? "border-border text-muted-foreground hover:bg-brand-tint/40"
                          : "border-border text-muted-foreground/50"
                  }`}
                >
                  <span className="block">
                    {done && !active ? "✓ " : ""}
                    {s.id}. {s.title}
                  </span>
                  <span className="block font-normal opacity-80">{s.hint}</span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* ------------------------------------------------ STEP 1 company */}
        {step === 1 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-brand" aria-hidden />
              How will the property be held?
            </div>
            <p className="text-sm text-muted-foreground">
              {usPerson
                ? "Investment purchases are usually completed through a company/entity that holds the property rather than in a personal name."
                : "A foreign national purchase is typically done through a US company/entity that holds the purchase and the property, rather than owning it in a personal name."}{" "}
              <button
                type="button"
                onClick={() => {
                  setGuideOpen(true);
                  if (!plan?.guideSeenAt) savePlan({ guideSeenAt: new Date().toISOString() });
                }}
                className="font-semibold text-brand underline-offset-2 hover:underline"
              >
                Why a corporate structure is better
              </button>
            </p>

            {decided ? (
              <div className="rounded-md border border-brand/40 bg-brand-tint/40 p-3 text-sm">
                <p className="font-semibold text-foreground">{ENTITY_PATH_LABEL[path!]}</p>
                {plan?.entityName ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.entityName}
                    {plan.entityState ? ` · ${plan.entityState}` : ""}
                    {plan.entityEin ? ` · EIN ${plan.entityEin}` : ""}
                  </p>
                ) : null}
                {path === "own_setup" ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Add the company name, state and EIN as soon as it is registered — the purchase
                      is then completed in that name.
                    </p>
                    <input
                      value={entityName}
                      onChange={(e) => setEntityName(e.target.value)}
                      placeholder="Company name"
                      className={inputClass}
                    />
                    <StateCombobox
                      value={entityState}
                      onChange={setEntityState}
                      placeholder="State of registration"
                    />
                    <input
                      value={entityEin}
                      onChange={(e) => setEntityEin(e.target.value)}
                      placeholder="EIN (optional)"
                      className={inputClass}
                    />
                    <button
                      type="button"
                      disabled={!entityName.trim()}
                      onClick={() => {
                        const now = new Date().toISOString();
                        savePlan({
                          entityName: entityName.trim(),
                          entityState,
                          entityEin: entityEin.trim(),
                        });
                        saveIntent({
                          hasEntity: true,
                          entityName: entityName.trim(),
                          entityState,
                          entityEin: entityEin.trim(),
                          entityProvidedAt: now,
                        });
                        toast("Company details saved");
                      }}
                      className={btnPrimary}
                    >
                      Save company details
                    </button>
                  </div>
                ) : null}
                {path === "loqal_setup" ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Your Loqal team has the task and will choose the best set-up for the property
                    location and your profile, then come back with the plan and the exact costs. You
                    can continue with the terms in the meantime.
                  </p>
                ) : null}
                {!confirmed && !termsStarted ? (
                  <button
                    type="button"
                    onClick={() => savePlan({ path: undefined })}
                    className="mt-2 text-xs font-semibold text-brand hover:underline"
                  >
                    Change this choice
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Do you already have an entity in America?
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => savePlan({ hasEntity: true })}
                      className={plan?.hasEntity === true ? btnPrimary : btnGhost}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => savePlan({ hasEntity: false, useExisting: false })}
                      className={plan?.hasEntity === false ? btnPrimary : btnGhost}
                    >
                      No
                    </button>
                  </div>
                </div>

                {plan?.hasEntity === true ? (
                  <div className="rounded-md border border-border p-3">
                    <div className="text-sm font-semibold text-foreground">
                      Would you like to proceed and buy through this entity?
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => savePlan({ useExisting: true })}
                        className={plan.useExisting === true ? btnPrimary : btnGhost}
                      >
                        Yes
                      </button>
                      <button
                        type="button"
                        onClick={() => savePlan({ useExisting: false })}
                        className={plan.useExisting === false ? btnPrimary : btnGhost}
                      >
                        No
                      </button>
                    </div>

                    {plan.useExisting === true ? (
                      <div className="mt-3 space-y-2">
                        <input
                          value={entityName}
                          onChange={(e) => setEntityName(e.target.value)}
                          placeholder="Company name"
                          className={inputClass}
                        />
                        <StateCombobox
                          value={entityState}
                          onChange={setEntityState}
                          placeholder="State of registration"
                        />
                        <input
                          value={entityEin}
                          onChange={(e) => setEntityEin(e.target.value)}
                          placeholder="EIN (optional)"
                          className={inputClass}
                        />
                        <button
                          type="button"
                          disabled={!entityName.trim()}
                          onClick={() =>
                            choosePath("existing_entity", {
                              entityName: entityName.trim(),
                              entityState,
                              entityEin: entityEin.trim(),
                            })
                          }
                          className={btnPrimary}
                        >
                          Buy through this company
                        </button>
                        <p className="text-[11px] text-muted-foreground">
                          We keep these details on your file for this purchase and for the future.
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {plan?.hasEntity === false ||
                (plan?.hasEntity === true && plan.useExisting === false) ? (
                  <div className="rounded-md border border-border p-3">
                    <div className="text-sm font-semibold text-foreground">
                      How would you like the holding company to be set up?
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => choosePath("own_setup")}
                        className="rounded-lg border border-border p-3 text-left hover:border-brand hover:bg-brand-tint/30"
                      >
                        <div className="text-xs font-semibold text-foreground">
                          I will open the company myself
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Send us the company details when they are ready and we continue the
                          purchase in the company's name.
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          savePlan({ feesAcknowledgedAt: new Date().toISOString() });
                          choosePath("loqal_setup");
                        }}
                        className="rounded-lg border border-brand/50 bg-brand-tint/40 p-3 text-left hover:border-brand"
                      >
                        <div className="text-xs font-semibold text-foreground">
                          Loqal sets up the structure for me
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          We form the company that will hold the property, open the bank account and
                          hand you the finished structure.
                        </p>
                      </button>
                    </div>

                    <div className="mt-3 rounded-md border border-gold/40 bg-gold-tint/30 p-3">
                      <div className="text-xs font-semibold text-foreground">
                        What a Loqal-managed set-up costs
                      </div>
                      <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                        {SETUP_COST_LINES.map((l) => (
                          <li key={l.label}>
                            <strong className="text-foreground">{l.label}</strong> — {l.note}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-[11px] text-foreground">
                        One-time Loqal Managerial Set-up fee of{" "}
                        <strong>${LOQAL_SETUP_FEE_USD}</strong>, plus all related services to open
                        the company (company formation, registered agent, EIN, bank account opening)
                        — <strong>up to ${RELATED_SERVICES_MAX_USD} in total</strong>, charged
                        transparently at cost. We will choose the best set-up based on the property
                        location and your profile.
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {decided ? (
              <div className="flex justify-end">
                <button type="button" onClick={() => goTo(2)} className={btnPrimary}>
                  Continue to the terms
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* --------------------------------------------------- STEP 2 terms */}
        {step === 2 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ClipboardCheck className="h-4 w-4 text-brand" aria-hidden />
              The terms {agentName} will put to the seller
            </div>

            <div className="rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground">What happens with these terms</p>
              <p className="mt-1">
                These are the terms your buyer's agent will now propose to the seller so the purchase
                agreement can be structured. The seller can confirm them, or come back with their own
                suggestions. Once both sides agree on the terms, {agentName} uploads the purchase
                agreement here for your review and signing.
              </p>
            </div>

            {!proposed ? (
              <p className="rounded-md border border-gold/40 bg-gold-tint/30 p-3 text-xs text-foreground">
                {agentName} is preparing the terms for this purchase. As soon as they are sent you
                will be notified and can confirm them here.
              </p>
            ) : (
              <>
                <ul className="space-y-1.5 rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
                  {termsSummary(purchase.offerPrice, terms!).map((r) => (
                    <li key={r.label}>
                      <strong className="text-foreground">{r.label}:</strong> {r.value}
                    </li>
                  ))}
                </ul>
                {plan?.termsChangeResponses?.length && !plan?.termsConfirmedAt ? (
                  <div className="rounded-md border border-gold/50 bg-gold-tint/30 p-3 text-xs">
                    <p className="font-semibold text-foreground">{agentName} answered your change requests</p>
                    <ul className="mt-2 space-y-1.5">
                      {plan.termsChangeResponses.map((r) => (
                        <li key={r.label} className="flex flex-wrap items-baseline gap-2">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${r.decision === "declined" ? "bg-destructive/15 text-destructive" : r.decision === "accepted" ? "bg-success/15 text-success" : "bg-gold text-background"}`}>{r.decision === "accepted" ? "Confirmed" : r.decision === "adjusted" ? "Adjusted" : "Not possible"}</span>
                          <span className="font-semibold text-foreground">{r.label}</span>
                          {r.decision === "declined" && r.reason ? <span className="text-muted-foreground">— {r.reason}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {plan?.termsNote ? (
                  <p className="rounded-md bg-muted/60 px-3 py-2 text-xs italic text-muted-foreground">
                    {agentName}: {plan.termsNote}
                  </p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  Proposed {formatDateTime(plan!.termsProposedAt!)}.
                </p>

                {confirmed ? (
                  <>
                    <div className="rounded-lg border border-success/30 bg-success/10 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
                        Terms confirmed
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Confirmed by {plan?.termsConfirmedBy} on{" "}
                        {formatDateTime(plan!.termsConfirmedAt!)}. {agentName} is putting these terms
                        to the seller. If the seller suggests changes, they come back to you here
                        before anything is agreed — and once the terms are settled, the signed
                        agreement is uploaded for you to review and sign.
                      </p>
                    </div>

                    <SellerStage
                      plan={plan!}
                      leadId={leadId}
                      agentName={agentName}
                      counterNote={counterNote}
                      setCounterNote={setCounterNote}
                      onCounter={answerCounter}
                      onSigned={markDocusignSigned}
                    />
                  </>
                ) : changeAsked ? (
                  <div className="rounded-lg border border-gold/40 bg-gold-tint/30 p-4 text-xs text-foreground">
                    <p className="font-semibold">Your change request is with {agentName}</p>
                    <p className="mt-1 text-muted-foreground">
                      Sent {formatDateTime(plan!.termsChangeRequestedAt!)}: {plan?.termsChangeNote}.
                      You will be notified when the adjusted terms arrive.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={confirmTerms} className={btnPrimary}>
                        Confirm these terms
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAskingChange((v) => !v); setAskingCall(false); }}
                        className={btnGhost}
                      >
                        Ask my agent to change something
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAskingCall((v) => !v); setAskingChange(false); }}
                        className={`${btnGhost} inline-flex items-center gap-1.5`}
                      >
                        <Phone className="h-3.5 w-3.5" aria-hidden /> Ask for a call
                      </button>
                    </div>
                    {askingChange ? (
                      <TermsChangeRequest
                        price={purchase.offerPrice}
                        terms={terms!}
                        propertyId={purchase.propertyId}
                        agentName={agentName}
                        onSend={askChange}
                        onCancel={() => setAskingChange(false)}
                      />
                    ) : null}
                    {askingCall ? (
                      <div className="space-y-2 rounded-lg border border-border bg-background p-4">
                        <p className="text-sm font-semibold text-foreground">Talk the terms through with {agentName}</p>
                        <p className="text-xs text-muted-foreground">Pick a free slot from {agentName}'s calendar.</p>
                        <CallScheduler
                          agentEmail={agentEmail}
                          {...(callSlot ? { booked: callSlot } : {})}
                          {...(callMeetUrl ? { meetUrl: callMeetUrl } : {})}
                          summary={`Loqal — purchase terms call · ${purchase.propertyLabel}`}
                          description={`Call about the proposed purchase terms for ${purchase.propertyLabel}, arranged through Loqal.`}
                          onBook={onCallBooked}
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            )}

            {!termsStarted ? (
              <div className="flex justify-start">
                <button type="button" onClick={() => goTo(1)} className={btnGhost}>
                  Back
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Holding US property through a company</DialogTitle>
              <DialogDescription>
                Why a corporate structure usually beats owning the property directly as a foreign
                national.
              </DialogDescription>
            </DialogHeader>
            <ul className="space-y-3">
              {CORPORATE_STRUCTURE_GUIDE.map((g) => (
                <li key={g.title} className="rounded-lg border border-border bg-background p-3">
                  <div className="text-sm font-semibold text-foreground">{g.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{g.body}</p>
                </li>
              ))}
            </ul>
            <p className="rounded-md border border-gold/40 bg-gold-tint/30 p-3 text-xs text-foreground">
              Loqal charges a one-time Managerial Set-up fee of ${LOQAL_SETUP_FEE_USD} and passes on
              all related services needed to open the company — company formation, registered agent,
              EIN and bank account opening — up to ${RELATED_SERVICES_MAX_USD} in total. The exact
              structure is chosen for the property's location and your profile. This is general
              information, not tax or legal advice.
            </p>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function NextSteps({ current }: { current: number }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4 text-xs">
      <p className="text-sm font-semibold text-foreground">What happens next</p>
      <ol className="mt-2 space-y-2">
        {CLOSING_STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-2.5">
            <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i < current ? "bg-success text-background" : i === current ? "bg-brand text-background" : "bg-muted text-muted-foreground"}`}>{i < current ? "✓" : i + 1}</span>
            <span><strong className="text-foreground">{s.title}</strong><span className="block text-muted-foreground">{s.detail}</span></span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-muted-foreground">A general guide to US practice — exact deadlines follow your signed agreement and your state.</p>
    </div>
  );
}

function SellerStage({ plan, leadId, agentName, counterNote, setCounterNote, onCounter, onSigned }: {
  plan: EntityPlan; leadId: string; agentName: string; counterNote: string; setCounterNote: (v: string) => void;
  onCounter: (d: "accepted" | "declined") => void; onSigned: () => void;
}) {
  if (plan.agreementSignedAt)
    return (
      <>
        <div className="rounded-lg border border-success/30 bg-success/10 p-4">
          <p className="text-sm font-semibold text-foreground">Purchase agreement signed</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Signed by {plan.agreementSignedBy} on {formatDateTime(plan.agreementSignedAt)}
            {plan.agreementDoc ? ` · ${plan.agreementDoc}` : ""}. Your mortgage company has the signed copy and is reconfirming your mortgage terms.
          </p>
        </div>
        <NextSteps current={1} />
      </>
    );
  if (plan.sellerAgreedAt && plan.agreementDocusignUrl)
    return (
      <>
        <div className="space-y-2 rounded-lg border-2 border-brand/50 bg-brand-tint/30 p-4 text-xs">
          <p className="text-sm font-semibold text-foreground">Step 2 — sign your purchase agreement electronically</p>
          <p className="text-muted-foreground">
            {agentName} uploaded {plan.agreementDoc}{plan.agreementUploadedAt ? ` on ${formatDateTime(plan.agreementUploadedAt)}` : ""} and sent it for signing. To move forward, open the link, read the agreement, and sign it electronically. Once you have signed, the seller countersigns.
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={plan.agreementDocusignUrl} target="_blank" rel="noreferrer" className={`${btnPrimary} inline-flex items-center gap-1.5`}><ExternalLink className="h-4 w-4" />Open Link for Signing</a>
            {plan.agreementDoc ? (
              <button
                type="button"
                onClick={() => { if (!downloadAgreementFile(leadId)) toast("The uploaded copy is only available on the device it was uploaded from."); }}
                className={btnGhost}
              >
                Download the agreement copy
              </button>
            ) : null}
            <button type="button" onClick={onSigned} className={btnGhost}>I've signed in DocuSign</button>
          </div>
          {plan.agreementHistory?.length ? (
            <details className="rounded-md border border-border bg-background px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground">Earlier versions on file</summary>
              <ul className="mt-1 space-y-1">
                {[...plan.agreementHistory].reverse().map((h) => (
                  <li key={h.sentAt} className="text-muted-foreground">
                    {h.doc} · sent {formatDateTime(h.sentAt)}
                    {h.url ? <> · <a href={h.url} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">link</a></> : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
        <NextSteps current={0} />
      </>
    );
  if (plan.sellerAgreedAt) {
    const due = new Date(new Date(plan.sellerAgreedAt).getTime() + 48 * 3600e3).toISOString();
    return (
      <>
        <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-xs">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CheckCircle2 className="h-4 w-4 text-success" />Step 1 — the seller agreed to the terms</p>
          <p className="mt-1 text-muted-foreground">{plan.sellerStatus === "countered" ? "You accepted the seller's counter-offer. " : "The seller's agent confirmed your terms. "}The purchase agreement follows within the next 48 hours.</p>
          <p className="mt-2 inline-flex items-center gap-1.5 font-semibold text-foreground"><Clock className="h-3.5 w-3.5" />Expected by {formatDateTime(due)}</p>
        </div>
        <NextSteps current={0} />
      </>
    );
  }
  if (plan.sellerStatus === "countered" && !plan.sellerCounterBuyerDecision)
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">The seller answered — please review their changes</p>
        <CounterCard items={plan.sellerCounterItems ?? []} note={plan.sellerCounterNote} docs={plan.sellerCounterDocs} at={plan.sellerRespondedAt} />
        <textarea value={counterNote} onChange={(e) => setCounterNote(e.target.value)} rows={2} placeholder="Comment for your agent (required if you decline)" className={inputClass} />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onCounter("accepted")} className={btnPrimary}>Accept the counter-offer</button>
          <button type="button" onClick={() => onCounter("declined")} className={btnGhost}>Decline — tell my agent why</button>
        </div>
      </div>
    );
  if (plan.sellerCounterBuyerDecision === "declined")
    return <p className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">You declined the seller's counter-offer. {agentName} is taking your answer back to the seller.</p>;
  return <p className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">{agentName} is presenting your terms to the seller. You'll be notified as soon as the seller answers.</p>;
}
