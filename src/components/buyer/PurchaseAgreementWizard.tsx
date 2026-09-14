/**
 * Purchase agreement signing window — the same stepped, resumable flow the
 * mortgage application uses, opened once the buyer's agent confirms the price.
 *
 *  Step 1 — the company: does the buyer already hold a US entity, will they buy
 *           through it, open one themselves, or should Loqal set the structure
 *           up (which raises a task and notification in the Loqal admin portal).
 *  Step 2 — the agreement: the state-neutral template filled with what Loqal
 *           already knows (buyer, property, price, agent) plus the choices the
 *           buyer makes here; draft on screen and downloadable in Word.
 *  Step 3 — final confirmation and e-signature, then the note that the
 *           agreement goes to the seller, who may revert with a lower price or
 *           adjusted terms.
 *
 * Every answer is saved as it is given, so the window always reopens where the
 * buyer left off.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileText, PenLine, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/form/DateInput";
import { StateCombobox } from "@/components/form/StateCombobox";
import { fullName, useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { formatPrice, getProperty } from "@/data/properties";
import { US_STATES, US_STATE_CODES } from "@/data/us-states";
import { COUNTRIES } from "@/data/countries";
import {
  CORPORATE_STRUCTURE_GUIDE,
  ENTITY_PATH_LABEL,
  LOQAL_SETUP_FEE_USD,
  RELATED_SERVICES_MAX_USD,
  SETUP_COST_LINES,
  useEntityPlan,
  type EntityPath,
} from "@/lib/entity-structure";
import {
  buildAgreement,
  choiceSummary,
  defaultChoices,
  downloadAgreementWord,
  type AgreementChoices,
  type AgreementFacts,
} from "@/lib/purchase-agreement";
import type { PurchaseRequest } from "@/lib/property-requests";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";
const label =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

const STEPS = [
  { id: 1, title: "The company", hint: "How the property is held" },
  { id: 2, title: "The agreement", hint: "Draft & your choices" },
  { id: 3, title: "Sign", hint: "Confirm & e-sign" },
] as const;

/** "New York, NY" → { city, state code, state name }. */
function splitLocation(location: string) {
  const [city = "", code = ""] = location.split(",").map((s) => s.trim());
  const index = US_STATE_CODES.indexOf(code as (typeof US_STATE_CODES)[number]);
  return {
    city,
    stateCode: code,
    stateName: index >= 0 ? (US_STATES[index] as string) : code || "the property state",
  };
}

function countryName(code?: string) {
  if (!code) return "";
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}

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

  const [step, setStep] = useState(1);
  const [guideOpen, setGuideOpen] = useState(false);
  const [entityName, setEntityName] = useState(plan?.entityName ?? "");
  const [entityState, setEntityState] = useState(plan?.entityState ?? "");
  const [entityEin, setEntityEin] = useState(plan?.entityEin ?? "");
  const [signature, setSignature] = useState(plan?.agreementSignedBy ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const property = getProperty(purchase.propertyId);
  const financed = purchase.mode === "listing" || true; // mortgage files are financed by default
  const [choices, setChoices] = useState<AgreementChoices>(
    () =>
      (plan?.agreementChoices as AgreementChoices | undefined) ??
      defaultChoices(purchase.offerPrice, financed),
  );

  const path = plan?.path;
  const decided = Boolean(path);
  const signed = Boolean(plan?.agreementSignedAt);

  /* Resume where the buyer left off. */
  useEffect(() => {
    if (!open) return;
    if (signed) {
      setStep(3);
      return;
    }
    setStep(Math.min(3, Math.max(1, plan?.wizardStep ?? (decided ? 2 : 1))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function goTo(next: number) {
    setStep(next);
    setError(null);
    if (!signed && next > (plan?.wizardStep ?? 1)) savePlan({ wizardStep: next });
  }

  function patchChoices(patch: Partial<AgreementChoices>) {
    const next = { ...choices, ...patch };
    setChoices(next);
    savePlan({ agreementChoices: next });
  }

  /* ------------------------------------------------------------- the buyer */
  const holdingCompany =
    path === "existing_entity" ? (plan?.entityName ?? "").trim() : (plan?.entityName ?? "").trim();
  const buyingThroughCompany = path === "existing_entity" || path === "own_setup" || path === "loqal_setup";
  const companyKnown = Boolean(holdingCompany);
  /** The name that goes on the deed: the company when there is one. */
  const buyerLegalName = companyKnown ? holdingCompany : fullName(user ?? ({} as never));
  const buyerNameReady = !buyingThroughCompany || companyKnown;

  const facts = useMemo<AgreementFacts>(() => {
    const loc = splitLocation(property?.location ?? "");
    const home = user?.mortgageProfile?.addresses?.[0];
    const buyerAddress = home?.street
      ? [home.street, home.city, home.state, home.zip, countryName(home.country)]
          .filter(Boolean)
          .join(", ")
      : "address on file with Loqal";
    return {
      buyerLegalName,
      buyerAddress,
      buyerJurisdiction: companyKnown
        ? plan?.entityState || "the State of registration"
        : countryName(user?.mortgageProfile?.countryOfResidence) ||
          (usPerson ? "United States" : "country of residence on file"),
      buyerIsEntity: companyKnown,
      buyerIsForeign: !usPerson,
      sellerLegalName: "Seller of record (as confirmed by the listing broker)",
      sellerAddress: "address to be inserted from the listing records",
      propertyStreet: property?.address ?? purchase.propertyLabel,
      propertyCity: loc.city,
      propertyCounty: `${loc.city} County`,
      propertyState: loc.stateCode,
      propertyStateName: loc.stateName,
      propertyZip: "as per the title records",
      purchasePrice: purchase.offerPrice,
      buyerBrokerName: agentName,
      buyerBrokerFirm: "Loqal Realtor Partner",
      buyerBrokerLicence: "",
      listingBrokerName: "Listing broker of record",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerLegalName, companyKnown, plan?.entityState, property, purchase, agentName, usPerson, user]);

  const draft = useMemo(
    () => buildAgreement(facts, choices, plan?.agreementSignedAt),
    [facts, choices, plan?.agreementSignedAt],
  );

  /* ------------------------------------------------------- notifications */
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

  function sign() {
    const expected = buyerLegalName.trim().toLowerCase();
    if (signature.trim().toLowerCase() !== expected) {
      setError(`Type the buyer name exactly as it appears on the agreement: ${buyerLegalName}.`);
      return;
    }
    if (!confirmed) {
      setError("Please confirm you have read the agreement and agree to be bound by it.");
      return;
    }
    const now = new Date().toISOString();
    savePlan({
      agreementSignedAt: now,
      agreementSignedBy: signature.trim(),
      agreementChoices: choices,
      wizardStep: 3,
    });
    if (agentEmail) {
      notify({
        id: `agreement-signed-${leadId}`,
        to: agentEmail.toLowerCase(),
        title: "Your buyer signed the purchase agreement",
        body: `${purchase.propertyLabel} — ${formatPrice(purchase.offerPrice)} agreed with ${clientLabel}. Present it to the seller.`,
        href: `/partner?tab=buyers&focus=${leadId}`,
        severity: "warning",
      });
    }
    tellLoqal(
      `agreement-signed-admin-${leadId}`,
      "Purchase agreement signed by the buyer",
      `${clientLabel} — ${purchase.propertyLabel} at ${formatPrice(purchase.offerPrice)}. Going to the seller for acceptance.`,
    );
    setError(null);
    toast("Purchase agreement signed", { description: `${agentName} has been notified.` });
  }

  /* ------------------------------------------------------------------ UI */
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Purchase agreement</DialogTitle>
          <DialogDescription>
            {agentName} confirmed {formatPrice(purchase.offerPrice)} for {purchase.propertyLabel}.
            Three steps: how the property is held, the agreement itself, and your signature.
          </DialogDescription>
        </DialogHeader>

        {/* stepper */}
        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((s) => {
            const reachable = s.id === 1 || (s.id === 2 && decided) || (s.id === 3 && decided);
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
                      : reachable
                        ? "border-border text-muted-foreground hover:bg-brand-tint/40"
                        : "border-border text-muted-foreground/50"
                  }`}
                >
                  <span className="block">
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
                      Add the company name, state and EIN as soon as it is registered — the
                      agreement is then drawn up in that name.
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
                        savePlan({
                          entityName: entityName.trim(),
                          entityState,
                          entityEin: entityEin.trim(),
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
                    location and your profile, then come back with the plan and the exact costs.
                    You can continue with the agreement in the meantime.
                  </p>
                ) : null}
                {!signed ? (
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
                        the company (company formation, registered agent, EIN, bank account
                        opening) — <strong>up to ${RELATED_SERVICES_MAX_USD} in total</strong>,
                        charged transparently at cost. We will choose the best set-up based on the
                        property location and your profile.
                      </p>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {decided ? (
              <div className="flex justify-end">
                <button type="button" onClick={() => goTo(2)} className={btnPrimary}>
                  Continue to the agreement
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* --------------------------------------------- STEP 2 agreement */}
        {step === 2 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FileText className="h-4 w-4 text-brand" aria-hidden />
              Your purchase agreement
            </div>

            {!buyerNameReady ? (
              <p className="rounded-md border border-gold/40 bg-gold-tint/30 p-3 text-xs text-foreground">
                The agreement is drawn up in the name of the company that will hold the property. As
                soon as the company details are on file, the draft below is completed with that name
                and you can sign it. Until then you can review the terms and choose your options.
              </p>
            ) : null}

            {/* choices */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className={label}>Deposit (earnest money)</span>
                <div className="flex gap-2">
                  {[5, 10, 15].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => patchChoices({ depositPct: p })}
                      className={choices.depositPct === p ? btnPrimary : btnGhost}
                    >
                      {p}%
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {formatPrice((purchase.offerPrice * choices.depositPct) / 100)} held in escrow.
                </p>
              </div>
              <div>
                <span className={label}>Target closing date</span>
                <DateInput
                  value={choices.closingDate}
                  onChange={(iso) => patchChoices({ closingDate: iso })}
                  className={inputClass}
                />
              </div>
              <div>
                <span className={label}>Paying with</span>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["financed", "Mortgage"],
                      ["cash", "All cash"],
                      ["seller_finance", "Seller financing"],
                    ] as const
                  ).map(([mode, text]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => patchChoices({ paymentMode: mode })}
                      className={choices.paymentMode === mode ? btnPrimary : btnGhost}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className={label}>Buyer's agent commission (paid by the seller)</span>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="6"
                  value={choices.commissionPct}
                  onChange={(e) => patchChoices({ commissionPct: Number(e.target.value) })}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="rounded-md border border-border p-3">
              <span className={label}>Protections you want to keep</span>
              <div className="space-y-2">
                {(
                  [
                    [
                      "inspection",
                      "Inspection contingency",
                      "You can walk away or ask for repairs if the inspection finds material defects.",
                    ],
                    [
                      "appraisal",
                      "Appraisal contingency",
                      "You are protected if the property appraises below the agreed price.",
                    ],
                    [
                      "financing",
                      "Financing contingency",
                      "You can withdraw if your mortgage commitment does not come through.",
                    ],
                    [
                      "assignable",
                      "Right to assign the agreement",
                      "Lets you transfer the purchase to another buyer or to your company later.",
                    ],
                  ] as const
                ).map(([key, title, hint]) => (
                  <label key={key} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(choices[key])}
                      onChange={(e) => patchChoices({ [key]: e.target.checked } as never)}
                      className="mt-0.5"
                    />
                    <span>
                      <strong className="text-foreground">{title}</strong> — {hint}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* summary */}
            <ul className="flex flex-wrap gap-1.5">
              {choiceSummary(facts, choices).map((s) => (
                <li
                  key={s}
                  className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand"
                >
                  {s}
                </li>
              ))}
            </ul>

            {/* draft */}
            <div className="rounded-lg border border-border bg-background">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Draft agreement
                </span>
                <button
                  type="button"
                  onClick={() => downloadAgreementWord(facts, choices, plan?.agreementSignedAt)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download in Word
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto p-4 text-xs leading-relaxed text-muted-foreground">
                <p className="text-center text-sm font-bold text-foreground">{draft.heading}</p>
                {draft.preamble.map((p) => (
                  <p key={p} className="mt-2">
                    {p}
                  </p>
                ))}
                {draft.sections.map((s) => (
                  <div key={s.n} className="mt-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
                      {s.n}. {s.title}
                    </p>
                    {s.body.map((b) => (
                      <p key={b} className="mt-1">
                        {b}
                      </p>
                    ))}
                  </div>
                ))}
                <div className="mt-3">
                  {draft.execution.map((e) => (
                    <p key={e} className="mt-1 text-foreground">
                      {e}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <button type="button" onClick={() => goTo(1)} className={btnGhost}>
                Back
              </button>
              <button
                type="button"
                disabled={!buyerNameReady}
                onClick={() => goTo(3)}
                className={btnPrimary}
              >
                Continue to signing
              </button>
            </div>
          </div>
        ) : null}

        {/* --------------------------------------------------- STEP 3 sign */}
        {step === 3 ? (
          <div className="space-y-4">
            {signed ? (
              <>
                <div className="rounded-lg border border-success/30 bg-success/10 p-6 text-center">
                  <div className="text-3xl">✅</div>
                  <div className="mt-2 text-base font-semibold text-foreground">
                    Purchase agreement signed
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Signed by {plan?.agreementSignedBy} on{" "}
                    {formatDateTime(plan!.agreementSignedAt!)}.
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">What happens next</p>
                  <p className="mt-1">
                    {agentName} now presents the signed agreement to the seller for acceptance of
                    the price and the terms. The seller may accept as it stands, come back with a
                    lower price proposal, or ask to adjust terms such as the closing date, the
                    deposit or the contingencies. Anything they propose comes back to you here for
                    your decision before it becomes binding.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => downloadAgreementWord(facts, choices, plan?.agreementSignedAt)}
                  className={`${btnGhost} inline-flex items-center gap-1.5`}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Download the signed agreement
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <PenLine className="h-4 w-4 text-brand" aria-hidden />
                  Final confirmation and signature
                </div>
                <ul className="space-y-1.5 rounded-lg border border-border bg-background p-4 text-xs text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Buyer:</strong> {buyerLegalName}
                    {companyKnown ? " (holding company)" : ""}
                  </li>
                  <li>
                    <strong className="text-foreground">Property:</strong> {purchase.propertyLabel}
                  </li>
                  <li>
                    <strong className="text-foreground">Price:</strong>{" "}
                    {formatPrice(purchase.offerPrice)}
                  </li>
                  {choiceSummary(facts, choices)
                    .slice(1)
                    .map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                </ul>

                <label className="block">
                  <span className={label}>Type the buyer name as your electronic signature</span>
                  <input
                    value={signature}
                    onChange={(e) => {
                      setSignature(e.target.value);
                      setError(null);
                    }}
                    placeholder={buyerLegalName}
                    className={inputClass}
                  />
                </label>
                <label className="flex items-start gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(e) => setConfirmed(e.target.checked)}
                    className="mt-0.5"
                  />
                  I have read the agreement in full, the details above are correct, and I agree that
                  my typed name is my legally binding electronic signature under applicable
                  electronic signature law.
                </label>
                {error ? (
                  <p className="text-xs font-semibold text-destructive">{error}</p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">
                  After signing, the agreement goes to the seller. They may accept, propose a lower
                  price, or ask to adjust terms — you will be asked before anything changes.
                </p>
                <div className="flex flex-wrap justify-between gap-2">
                  <button type="button" onClick={() => goTo(2)} className={btnGhost}>
                    Back to the draft
                  </button>
                  <button type="button" onClick={sign} className={btnPrimary}>
                    Sign the purchase agreement
                  </button>
                </div>
              </>
            )}
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
