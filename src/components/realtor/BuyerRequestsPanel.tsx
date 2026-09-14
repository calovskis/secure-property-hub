/**
 * The agent's side of the buyer's requests on one property file: the request to
 * proceed with the purchase (where the agent gives a price opinion) and the
 * request to change the property.
 */
import { useState } from "react";
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
  "rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-brand-tint";

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
    <section className="rounded-lg border border-gold/40 bg-gold-tint/30 p-4">
      <h3 className="text-sm font-semibold text-foreground">
        Requests from {buyerName} on this property
      </h3>

      {purchase ? (
        <div className="mt-3 rounded-lg border border-border bg-background p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground">Request to proceed with purchase</span>
            <span className="text-[10px] text-muted-foreground">
              {formatDateTime(purchase.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-foreground">
            Buyer offers <strong>{formatPrice(purchase.offerPrice)}</strong>
            {purchase.mode === "lower"
              ? ` — below the listing price of ${formatPrice(purchase.listingPrice)}`
              : " — the listing price"}
            .
          </p>
          {purchase.buyerNote ? (
            <p className="mt-1 text-muted-foreground">{buyerName}: {purchase.buyerNote}</p>
          ) : null}
          <p className="mt-1 text-muted-foreground">
            Status: {PURCHASE_STATUS_LABEL[purchase.status]}
          </p>

          {purchase.status === "pending" || purchase.status === "buyer_raised" ? (
            <div className="mt-2 space-y-2">
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
                      "Your agent supports your price",
                      `${propertyLabel} — ${formatPrice(purchase.offerPrice)} will be presented to the seller.${
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
              <div className="flex flex-wrap items-center gap-2">
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
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {change ? (
        <div className="mt-3 rounded-lg border border-border bg-background p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold text-foreground">
              {change.kind === "buyer_picked"
                ? "Buyer chose another property"
                : "Buyer asks for other property options"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {formatDateTime(change.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-muted-foreground">Reason: {change.reason}</p>
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

          {change.status === "pending" ? (
            <div className="mt-2 space-y-2">
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
            <p className="mt-1 font-semibold text-success">Confirmed with the buyer.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
