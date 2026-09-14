/**
 * The agent's side of the buyer's requests on one property file: the request to
 * proceed with the purchase (where the agent gives a price opinion) and the
 * request to change the property.
 *
 * Visual hierarchy: items that need the agent's action right now get a strong
 * brand accent (left rail, tinted surface, "Action needed" pill, solid
 * buttons); everything else is deliberately muted so the active work stands
 * out at a glance.
 */
import { useState } from "react";
import { AlertCircle, CheckCircle2, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { formatPrice } from "@/data/properties";
import {
  LOCATION_LABEL,
  PRICE_LABEL,
  PURCHASE_STATUS_LABEL,
  useFileRequests,
} from "@/lib/property-requests";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background shadow-sm transition hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border bg-background px-4 py-2 text-xs font-semibold text-muted-foreground hover:border-brand/50 hover:text-foreground";

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return active ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-background">
      <AlertCircle className="h-3 w-3" aria-hidden />
      Action needed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {label}
    </span>
  );
}

export function BuyerRequestsPanel({
  leadId,
  propertyId,
  propertyLabel,
  buyerName,
  buyerEmail,
}: {
  leadId: string;
  propertyId: number;
  propertyLabel: string;
  /** First name + internal number — agents never see buyers' family names. */
  buyerName: string;
  buyerEmail?: string | undefined;
}) {
  const { purchases, changes, supportPrice, suggestHigherPrice, acknowledgeChange } =
    useFileRequests(leadId);
  const [note, setNote] = useState("");
  const [suggested, setSuggested] = useState("");
  const [changeNote, setChangeNote] = useState("");

  const purchase = purchases[0];
  const change = changes[0];
  if (!purchase && !change) return null;

  const purchaseActive =
    !!purchase && (purchase.status === "pending" || purchase.status === "buyer_raised");
  const changeActive = !!change && change.status === "pending";
  const activeCount = (purchaseActive ? 1 : 0) + (changeActive ? 1 : 0);

  function tellBuyer(title: string, body: string) {
    if (!buyerEmail) return;
    notify({
      id: `filereq-agent-${leadId}-${Date.now()}`,
      to: buyerEmail.toLowerCase(),
      title,
      body,
      href: `/property/${propertyId}?open=chat`,
      severity: "info",
    });
  }

  return (
    <section
      className={`overflow-hidden rounded-xl border p-4 ${
        activeCount
          ? "border-brand/50 bg-brand-tint/40"
          : "border-border bg-muted/30"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          Requests from {buyerName} on this property
        </h3>
        {activeCount ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-background">
            <AlertCircle className="h-3 w-3" aria-hidden />
            {activeCount} waiting on you
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
            All handled
          </span>
        )}
      </div>

      {purchase ? (
        <div
          className={`mt-3 rounded-lg border-l-4 p-3 text-xs shadow-sm ${
            purchaseActive
              ? "border-l-brand border border-border bg-background ring-1 ring-brand/20"
              : "border-l-border border border-border/60 bg-muted/40 opacity-90"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`font-semibold ${
                purchaseActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Request to proceed with purchase
            </span>
            <div className="flex items-center gap-2">
              <StatusPill
                active={purchaseActive}
                label={PURCHASE_STATUS_LABEL[purchase.status]}
              />
              <span className="text-[10px] text-muted-foreground">
                {formatDateTime(purchase.createdAt)}
              </span>
            </div>
          </div>

          <p className="mt-1.5 text-foreground">
            Buyer offers{" "}
            <strong
              className={
                purchaseActive
                  ? "rounded bg-gold-tint px-1.5 py-0.5 text-sm text-foreground"
                  : ""
              }
            >
              {formatPrice(purchase.offerPrice)}
            </strong>
            {purchase.mode === "lower"
              ? ` — below the listing price of ${formatPrice(purchase.listingPrice)}`
              : " — the listing price"}
            .
          </p>
          {purchase.buyerNote ? (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 italic text-muted-foreground">
              <MessageSquareQuote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              {buyerName}: {purchase.buyerNote}
            </p>
          ) : null}
          {!purchaseActive ? (
            <p className="mt-1.5 text-muted-foreground">
              Status: {PURCHASE_STATUS_LABEL[purchase.status]}
            </p>
          ) : null}

          {purchaseActive ? (
            <div className="mt-3 space-y-3 rounded-md border border-brand/30 bg-brand-tint/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                Your price opinion
              </p>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Your price opinion for the buyer — required if you suggest a higher price"
                className={inputClass}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    supportPrice(purchase.id, note.trim() || undefined);
                    tellBuyer(
                      "Your price is confirmed and goes to the seller",
                      `${propertyLabel} — ${formatPrice(purchase.offerPrice)} is decided and will be presented to the seller. Next step: sign the purchase agreement and tell us how the property will be held.${
                        note.trim() ? ` ${note.trim()}` : ""
                      }`,
                    );
                    setNote("");
                    toast("Price opinion confirmed — the buyer has been informed.");
                  }}
                  className={btnPrimary}
                >
                  Confirm this price and take it to the seller
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
                <input
                  inputMode="numeric"
                  value={suggested}
                  onChange={(e) => setSuggested(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Price you recommend instead"
                  className={`${inputClass} max-w-[220px]`}
                />
                <button
                  type="button"
                  disabled={!suggested || !note.trim()}
                  onClick={() => {
                    const price = Math.round(Number(suggested) || 0);
                    if (!price) return;
                    suggestHigherPrice(purchase.id, price, note.trim() || undefined);
                    tellBuyer(
                      "Your agent suggests a higher price",
                      `${propertyLabel} — ${formatPrice(price)} gives a realistic chance with the seller.${
                        note.trim() ? ` ${note.trim()}` : ""
                      }`,
                    );
                    setNote("");
                    setSuggested("");
                    toast("Suggestion sent to the buyer.");
                  }}
                  className={btnGhost}
                >
                  Suggest a higher price
                </button>
                <span className="text-[10px] text-muted-foreground">
                  Add the reason above — the buyer sees why you recommend this price.
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {change ? (
        <div
          className={`mt-3 rounded-lg border-l-4 p-3 text-xs shadow-sm ${
            changeActive
              ? "border-l-brand border border-border bg-background ring-1 ring-brand/20"
              : "border-l-border border border-border/60 bg-muted/40 opacity-90"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`font-semibold ${
                changeActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {change.kind === "buyer_picked"
                ? "Buyer chose another property"
                : "Buyer asks for other property options"}
            </span>
            <div className="flex items-center gap-2">
              <StatusPill active={changeActive} label="Confirmed" />
              <span className="text-[10px] text-muted-foreground">
                {formatDateTime(change.createdAt)}
              </span>
            </div>
          </div>
          <p className="mt-1.5 text-muted-foreground">
            <span className="font-medium text-foreground">Reason:</span> {change.reason}
          </p>
          {change.pickedPropertyLabel ? (
            <p className="mt-1 text-foreground">Wants: {change.pickedPropertyLabel}</p>
          ) : null}
          {change.criteria.length || change.customCriteria ? (
            <p className="mt-1 text-muted-foreground">
              Criteria: {change.criteria.join(", ")}
              {change.customCriteria
                ? `${change.criteria.length ? ", " : ""}${change.customCriteria}`
                : ""}
            </p>
          ) : null}
          {change.location ? (
            <p className="mt-1 text-muted-foreground">
              Location: {LOCATION_LABEL[change.location]}
              {change.locationNote ? ` — ${change.locationNote}` : ""}
            </p>
          ) : null}
          {change.price ? (
            <p className="mt-1 text-muted-foreground">Price: {PRICE_LABEL[change.price]}</p>
          ) : null}

          {changeActive ? (
            <div className="mt-3 space-y-2 rounded-md border border-brand/30 bg-brand-tint/30 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                Your response
              </p>
              <textarea
                rows={2}
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="What you will do next (optional)"
                className={inputClass}
              />
              <button
                type="button"
                onClick={() => {
                  acknowledgeChange(change.id, changeNote.trim() || undefined);
                  tellBuyer(
                    "Your agent is working on your property change",
                    changeNote.trim() || `${propertyLabel} — options are being prepared for you.`,
                  );
                  setChangeNote("");
                  toast("The buyer has been informed.");
                }}
                className={btnPrimary}
              >
                Confirm and inform the buyer
              </button>
            </div>
          ) : (
            <p className="mt-1.5 inline-flex items-center gap-1 font-semibold text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Confirmed with the buyer.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
