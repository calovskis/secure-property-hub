/**
 * The buyer's agent proposes the purchase terms.
 *
 * Once the price is decided, the agent — not the buyer — chooses the terms
 * (deposit, closing date, payment, protections, commission) and sends them to
 * the buyer for confirmation. Only after the buyer confirms does the agent put
 * the terms to the seller. If the buyer asks for a change, the terms come back
 * here for the agent to adjust and send again.
 */
import { useState } from "react";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { formatPrice } from "@/data/properties";
import { DateInput } from "@/components/form/DateInput";
import { useEntityPlan } from "@/lib/entity-structure";
import {
  defaultTerms,
  termsSummary,
  type AgreementTerms,
  type PaymentMode,
} from "@/lib/purchase-agreement";
import type { PurchaseRequest } from "@/lib/property-requests";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background shadow-sm transition hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-brand/50 hover:text-foreground";
const label =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export function AgreementTermsPanel({
  leadId,
  propertyId,
  propertyLabel,
  purchase,
  buyerName,
  buyerEmail,
  agentName,
}: {
  leadId: string;
  propertyId: number;
  propertyLabel: string;
  purchase: PurchaseRequest;
  buyerName: string;
  buyerEmail?: string | undefined;
  agentName: string;
}) {
  const { plan, savePlan } = useEntityPlan(leadId);
  const saved = plan?.proposedTerms as AgreementTerms | undefined;
  const [terms, setTerms] = useState<AgreementTerms>(() => saved ?? defaultTerms(true));
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);

  const confirmed = Boolean(plan?.termsConfirmedAt);
  const awaitingBuyer = Boolean(plan?.termsProposedAt) && !confirmed && !plan?.termsChangeRequestedAt;
  const changeAsked = Boolean(plan?.termsChangeRequestedAt) && !confirmed;
  const needsAgent = !plan?.termsProposedAt || changeAsked;
  const showForm = needsAgent || editing;

  function patch(p: Partial<AgreementTerms>) {
    setTerms((cur) => ({ ...cur, ...p }));
  }

  function propose() {
    const now = new Date().toISOString();
    savePlan({
      proposedTerms: terms,
      termsProposedAt: now,
      termsProposedBy: agentName,
      termsRound: (plan?.termsRound ?? 0) + 1,
      ...(note.trim() ? { termsNote: note.trim() } : { termsNote: undefined }),
      termsChangeRequestedAt: undefined,
      termsChangeNote: undefined,
    });
    if (buyerEmail) {
      notify({
        id: `terms-proposed-${leadId}-${(plan?.termsRound ?? 0) + 1}`,
        to: buyerEmail.toLowerCase(),
        title: "Your agent proposed the purchase terms — your confirmation is needed",
        body: `${propertyLabel} at ${formatPrice(purchase.offerPrice)}. Review the terms and confirm them so they can be put to the seller.`,
        href: `/property/${propertyId}?open=agreement`,
        severity: "warning",
      });
    }
    setNote("");
    setEditing(false);
    toast("Terms sent to the buyer for confirmation");
  }

  return (
    <div
      className={`mt-3 rounded-lg border-l-4 p-3 text-xs shadow-sm ${
        needsAgent
          ? "border-l-brand border border-border bg-background ring-1 ring-brand/20"
          : "border-l-border border border-border/60 bg-muted/40"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-foreground">Purchase terms for the seller</span>
        {needsAgent ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-background">
            <AlertCircle className="h-3 w-3" aria-hidden />
            Action needed
          </span>
        ) : confirmed ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Confirmed by {buyerName}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Waiting for the buyer
          </span>
        )}
      </div>

      <p className="mt-1.5 text-muted-foreground">
        You choose the terms and send them to {buyerName} to confirm. Once confirmed, you put them to
        the seller, who can accept or come back with their own suggestions.
      </p>

      {changeAsked ? (
        <p className="mt-2 rounded-md border border-gold/40 bg-gold-tint/40 px-2.5 py-2 text-foreground">
          <strong>{buyerName} asked for a change</strong>
          {plan?.termsChangeRequestedAt ? ` (${formatDateTime(plan.termsChangeRequestedAt)})` : ""}:{" "}
          {plan?.termsChangeNote || "no details given"}
        </p>
      ) : null}

      {confirmed ? (
        <p className="mt-2 text-success">
          Confirmed {formatDateTime(plan!.termsConfirmedAt!)} — these terms can now be presented to
          the seller.
        </p>
      ) : null}

      {!showForm ? (
        <>
          <ul className="mt-2 space-y-1">
            {saved
              ? termsSummary(purchase.offerPrice, saved).map((r) => (
                  <li key={r.label} className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{r.label}:</span> {r.value}
                  </li>
                ))
              : null}
          </ul>
          {plan?.termsNote ? (
            <p className="mt-2 italic text-muted-foreground">Your note: {plan.termsNote}</p>
          ) : null}
          {!confirmed ? (
            <button type="button" onClick={() => setEditing(true)} className={`${btnGhost} mt-3`}>
              Adjust and send again
            </button>
          ) : null}
        </>
      ) : (
        <div className="mt-3 space-y-3 rounded-md border border-brand/30 bg-brand-tint/30 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={label}>Deposit (earnest money)</span>
              <div className="flex gap-2">
                {[5, 10, 15].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patch({ depositPct: p })}
                    className={terms.depositPct === p ? btnPrimary : btnGhost}
                  >
                    {p}%
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {formatPrice((purchase.offerPrice * terms.depositPct) / 100)} held in escrow within{" "}
                {terms.depositDays} business days.
              </p>
            </div>
            <div>
              <span className={label}>Target closing date</span>
              <DateInput
                value={terms.closingDate}
                onChange={(iso) => patch({ closingDate: iso })}
                className={inputClass}
              />
            </div>
            <div>
              <span className={label}>How the purchase is paid</span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["financed", "Mortgage"],
                    ["cash", "All cash"],
                    ["seller_finance", "Seller financing"],
                  ] as [PaymentMode, string][]
                ).map(([mode, text]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => patch({ paymentMode: mode })}
                    className={terms.paymentMode === mode ? btnPrimary : btnGhost}
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={label}>Your commission (paid by the seller)</span>
              <input
                type="number"
                step="0.5"
                min="0"
                max="6"
                value={terms.commissionPct}
                onChange={(e) => patch({ commissionPct: Number(e.target.value) })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="rounded-md border border-border bg-background p-3">
            <span className={label}>Protections in the offer</span>
            <div className="space-y-2">
              {(
                [
                  ["inspection", "Inspection protection", "Repairs or walk away after inspection."],
                  ["appraisal", "Appraisal protection", "Cover if the valuation comes in low."],
                  ["financing", "Financing protection", "Cover if the mortgage does not come through."],
                  ["assignable", "Right to transfer the purchase", "Can be moved to the buyer's company."],
                ] as [keyof AgreementTerms, string, string][]
              ).map(([key, title, hint]) => (
                <label key={key} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(terms[key])}
                    onChange={(e) => patch({ [key]: e.target.checked } as never)}
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="text-foreground">{title}</strong> — {hint}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className={label}>Included with the property</span>
              <input
                value={terms.includedItems}
                onChange={(e) => patch({ includedItems: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <span className={label}>Excluded from the sale</span>
              <input
                value={terms.excludedItems}
                onChange={(e) => patch({ excludedItems: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="A note for the buyer on why you recommend these terms (optional)"
            className={inputClass}
          />

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={propose} className={btnPrimary}>
              <Send className="h-3.5 w-3.5" aria-hidden />
              Send the terms to {buyerName} for confirmation
            </button>
            {editing && !needsAgent ? (
              <button type="button" onClick={() => setEditing(false)} className={btnGhost}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      )}

      {awaitingBuyer ? (
        <p className="mt-2 text-muted-foreground">
          Sent {formatDateTime(plan!.termsProposedAt!)} — waiting for {buyerName} to confirm before
          anything goes to the seller.
        </p>
      ) : null}
    </div>
  );
}
