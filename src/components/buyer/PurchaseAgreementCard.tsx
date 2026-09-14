/**
 * The buyer's step after the agent confirms the price and takes it to the
 * seller: signing the purchase agreement, and deciding how the property will be
 * held — directly or through a US company/entity (the usual route for a foreign
 * national). Includes the corporate-structure guide and the transparent Loqal
 * set-up fees.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { formatPrice } from "@/data/properties";
import { StateCombobox } from "@/components/form/StateCombobox";
import {
  CORPORATE_STRUCTURE_GUIDE,
  ENTITY_PATH_LABEL,
  LOQAL_SETUP_FEE_USD,
  RELATED_SERVICES_MAX_USD,
  SETUP_COST_LINES,
  useEntityPlan,
  type EntityPath,
} from "@/lib/entity-structure";
import type { PurchaseRequest } from "@/lib/property-requests";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

export function PurchaseAgreementCard({
  leadId,
  purchase,
  usPerson,
  agentName,
  agentEmail,
  clientLabel,
}: {
  leadId: string;
  purchase: PurchaseRequest;
  usPerson: boolean;
  agentName: string;
  agentEmail?: string | undefined;
  /** Privacy-safe label of the buyer used in partner/admin notifications. */
  clientLabel: string;
}) {
  const { plan, savePlan } = useEntityPlan(leadId);
  const [guideOpen, setGuideOpen] = useState(false);
  const [entityName, setEntityName] = useState(plan?.entityName ?? "");
  const [entityState, setEntityState] = useState(plan?.entityState ?? "");
  const [entityEin, setEntityEin] = useState(plan?.entityEin ?? "");

  const path = plan?.path;
  const decided = Boolean(path);

  function tellLoqal(title: string, body: string) {
    notify({
      id: `entity-${leadId}-${title}`,
      to: "admins",
      title,
      body,
      href: `/admin?tab=cases&focus=${leadId}`,
      severity: "info",
    });
  }

  function choosePath(next: EntityPath, extra?: Record<string, string>) {
    savePlan({ path: next, ...(extra ?? {}) });
    if (next === "loqal_setup") {
      tellLoqal(
        "Client asked Loqal to set up the holding company",
        `${clientLabel} — ${purchase.propertyLabel}. Managerial Set-up accepted; choose the structure for the property location and client profile.`,
      );
    }
    if (next === "own_setup") {
      tellLoqal(
        "Client is opening their own holding company",
        `${clientLabel} — ${purchase.propertyLabel}. They will send the company details when ready.`,
      );
    }
    if (next === "existing_entity") {
      tellLoqal(
        "Client will purchase through their existing US entity",
        `${clientLabel} — ${purchase.propertyLabel}. ${extra?.entityName ?? "Entity"} (${
          extra?.entityState ?? "state not given"
        }).`,
      );
    }
    toast("Saved", { description: "Your Loqal team has your ownership choice." });
  }

  function signAgreement() {
    savePlan({ agreementSignedAt: new Date().toISOString() });
    if (agentEmail) {
      notify({
        id: `agreement-signed-${leadId}`,
        to: agentEmail.toLowerCase(),
        title: "Your buyer signed the purchase agreement",
        body: `${purchase.propertyLabel} — ${formatPrice(purchase.offerPrice)} agreed with ${clientLabel}.`,
        href: `/partner?tab=buyers&focus=${leadId}`,
        severity: "warning",
      });
    }
    tellLoqal(
      "Purchase agreement signed by the buyer",
      `${clientLabel} — ${purchase.propertyLabel} at ${formatPrice(purchase.offerPrice)}.`,
    );
    toast("Purchase agreement signed", { description: `${agentName} has been notified.` });
  }

  return (
    <section className="mt-4 rounded-lg border border-success/40 bg-success/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          ✅ Your price is agreed — purchase agreement
        </h4>
        <span className="rounded-full bg-success/15 px-3 py-1 text-[11px] font-semibold text-success">
          {formatPrice(purchase.offerPrice)} going to the seller
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {agentName} confirmed {formatPrice(purchase.offerPrice)} for {purchase.propertyLabel} and is
        presenting it to the seller
        {purchase.respondedAt ? ` (${formatDateTime(purchase.respondedAt)})` : ""}.
        {purchase.agentNote ? ` ${agentName}: ${purchase.agentNote}` : ""}
      </p>

      {/* ---------------------------------------------------------- ownership */}
      <div className="mt-4 rounded-lg border border-border bg-background p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          How will the property be held?
        </div>
        <p className="mt-1.5 text-sm text-muted-foreground">
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
          <div className="mt-3 rounded-md border border-brand/40 bg-brand-tint/40 p-3 text-sm">
            <p className="font-semibold text-foreground">{ENTITY_PATH_LABEL[path!]}</p>
            {plan?.entityName ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {plan.entityName}
                {plan.entityState ? ` · ${plan.entityState}` : ""}
                {plan.entityEin ? ` · EIN ${plan.entityEin}` : ""}
              </p>
            ) : null}
            {path === "own_setup" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Send us the company name, state and EIN as soon as the company is registered and we
                will attach it to this purchase.
              </p>
            ) : null}
            {path === "loqal_setup" ? (
              <p className="mt-1 text-xs text-muted-foreground">
                We will choose the best set-up based on the property location and your profile, then
                come back to you with the plan and the exact costs.
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => savePlan({ path: undefined })}
              className="mt-2 text-xs font-semibold text-brand hover:underline"
            >
              Change this choice
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {/* Q1 — do you have a US entity? */}
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

            {/* Q2 — buy through it? */}
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

            {/* No entity, or not using the existing one */}
            {plan?.hasEntity === false || (plan?.hasEntity === true && plan.useExisting === false) ? (
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
                      Send us the company details when they are ready and we continue the purchase
                      in the company's name.
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

                {/* Transparent fees */}
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
                    <strong>${LOQAL_SETUP_FEE_USD}</strong>, plus all related services to open the
                    company (company formation, registered agent, EIN, bank account opening) —{" "}
                    <strong>up to ${RELATED_SERVICES_MAX_USD} in total</strong>, charged
                    transparently at cost. We will choose the best set-up based on the property
                    location and your profile.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------- signing */}
      <div className="mt-4 rounded-lg border border-border bg-background p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Purchase agreement with the seller
        </div>
        {plan?.agreementSignedAt ? (
          <p className="mt-1.5 text-sm font-semibold text-success">
            Signed {formatDateTime(plan.agreementSignedAt)} — {agentName} and your Loqal team are
            taking it from here.
          </p>
        ) : (
          <>
            <p className="mt-1.5 text-sm text-muted-foreground">
              The agreement is signed at {formatPrice(purchase.offerPrice)} and remains conditioned
              upon satisfactory inspection results and the appraisal value. If you are buying through
              a company, the agreement is prepared in the company's name.
            </p>
            <button
              type="button"
              disabled={!decided}
              onClick={signAgreement}
              className={`${btnPrimary} mt-3`}
            >
              Sign purchase agreement
            </button>
            {!decided ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Tell us first how the property will be held — the agreement is drawn up in that name.
              </p>
            ) : null}
          </>
        )}
      </div>

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
    </section>
  );
}
