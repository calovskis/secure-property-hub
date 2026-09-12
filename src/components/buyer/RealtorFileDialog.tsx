/**
 * The buyer's view of one property file with their Loqal buyer's agent:
 * where the file stands, the conversation (with file uploads), the request to
 * proceed with the purchase (listing price or a lower offer) and the request to
 * change the property.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { allProperties, formatPrice } from "@/data/properties";
import type { MortgageLead } from "@/lib/leads";
import { FileChatPanel } from "@/components/messaging/FileChatPanel";
import {
  CHANGE_CRITERIA,
  LOCATION_LABEL,
  PRICE_LABEL,
  PURCHASE_STATUS_LABEL,
  useFileRequests,
  type LocationPreference,
  type PricePreference,
} from "@/lib/property-requests";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

type Tab = "status" | "chat" | "purchase" | "change";

export function RealtorFileDialog({
  lead,
  agentName,
  agentEmail,
  myName,
  open,
  onOpenChange,
  initialTab = "status",
}: {
  lead: MortgageLead;
  agentName: string;
  agentEmail?: string | undefined;
  myName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const {
    purchases,
    changes,
    requestPurchase,
    raiseOffer,
    requestChange,
  } = useFileRequests(lead.id);

  /* purchase form */
  const [priceMode, setPriceMode] = useState<"listing" | "lower">("listing");
  const [offer, setOffer] = useState(String(lead.propertyPrice));
  const [purchaseNote, setPurchaseNote] = useState("");

  /* change form */
  const [changeKind, setChangeKind] = useState<"agent_proposes" | "buyer_picked">(
    "agent_proposes",
  );
  const [reason, setReason] = useState("");
  const [criteria, setCriteria] = useState<string[]>([]);
  const [customCriteria, setCustomCriteria] = useState("");
  const [location, setLocation] = useState<LocationPreference>("same_area");
  const [locationNote, setLocationNote] = useState("");
  const [price, setPrice] = useState<PricePreference>("same_range");
  const [pickedId, setPickedId] = useState("");

  const openPurchase = purchases.find(
    (p) => p.status !== "withdrawn" && p.status !== "price_supported",
  );
  const lastPurchase = purchases[0];
  const lastChange = changes[0];
  const otherProperties = useMemo(
    () => allProperties.filter((p) => p.id !== lead.propertyId),
    [lead.propertyId],
  );

  function alertAgent(title: string, body: string) {
    if (!agentEmail) return;
    notify({
      id: `filereq-${lead.id}-${Date.now()}`,
      to: agentEmail.toLowerCase(),
      title,
      body,
      href: `/partner?tab=buyers&focus=${lead.id}`,
      severity: "warning",
    });
  }

  function submitPurchase() {
    const offerPrice =
      priceMode === "listing" ? lead.propertyPrice : Math.round(Number(offer) || 0);
    if (priceMode === "lower" && (!offerPrice || offerPrice >= lead.propertyPrice)) {
      toast("Enter a price lower than the listing price.");
      return;
    }
    requestPurchase({
      leadId: lead.id,
      propertyId: lead.propertyId,
      propertyLabel: lead.propertyLabel,
      listingPrice: lead.propertyPrice,
      offerPrice,
      mode: priceMode,
      ...(purchaseNote.trim() ? { buyerNote: purchaseNote.trim() } : {}),
    });
    alertAgent(
      "Your buyer wants to proceed with the purchase",
      `${lead.propertyLabel} — ${
        priceMode === "listing"
          ? `at the listing price ${formatPrice(lead.propertyPrice)}`
          : `offering ${formatPrice(offerPrice)} instead of ${formatPrice(lead.propertyPrice)} — your price opinion is needed`
      }`,
    );
    setPurchaseNote("");
    toast("Request sent", { description: `${agentName} has been notified.` });
    setTab("status");
  }

  function submitChange() {
    if (!reason.trim()) {
      toast("Please tell your agent why this property did not work.");
      return;
    }
    if (changeKind === "buyer_picked" && !pickedId) {
      toast("Pick the property you would like to look at instead.");
      return;
    }
    const picked = otherProperties.find((p) => String(p.id) === pickedId);
    requestChange({
      leadId: lead.id,
      propertyId: lead.propertyId,
      propertyLabel: lead.propertyLabel,
      kind: changeKind,
      reason: reason.trim(),
      criteria: changeKind === "agent_proposes" ? criteria : [],
      ...(changeKind === "agent_proposes" && customCriteria.trim()
        ? { customCriteria: customCriteria.trim() }
        : {}),
      ...(changeKind === "agent_proposes" ? { location, price } : {}),
      ...(changeKind === "agent_proposes" && locationNote.trim()
        ? { locationNote: locationNote.trim() }
        : {}),
      ...(picked
        ? {
            pickedPropertyId: picked.id,
            pickedPropertyLabel: `${picked.address}, ${picked.location}`,
          }
        : {}),
    });
    alertAgent(
      changeKind === "buyer_picked"
        ? "Your buyer chose another property"
        : "Your buyer asks for other property options",
      picked
        ? `${picked.address}, ${picked.location} — reason for leaving ${lead.propertyLabel}: ${reason.trim()}`
        : `${lead.propertyLabel} — ${reason.trim()}`,
    );
    setReason("");
    setCriteria([]);
    setCustomCriteria("");
    setLocationNote("");
    setPickedId("");
    toast("Sent to your agent", { description: `${agentName} has been notified.` });
    setTab("status");
  }

  const tabs: [Tab, string][] = [
    ["status", "Status"],
    ["chat", "Message the agent"],
    ["purchase", "Proceed with purchase"],
    ["change", "Change the property"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your property file with {agentName}</DialogTitle>
          <DialogDescription>
            {lead.propertyLabel} · listed at {formatPrice(lead.propertyPrice)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                tab === id
                  ? "border-brand bg-brand-tint text-brand"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "status" ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-background p-4 text-sm">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Where the purchase stands
              </div>
              {lastPurchase ? (
                <div className="mt-2 space-y-1 text-foreground">
                  <p className="font-semibold">{PURCHASE_STATUS_LABEL[lastPurchase.status]}</p>
                  <p className="text-xs text-muted-foreground">
                    Your offer: {formatPrice(lastPurchase.offerPrice)}
                    {lastPurchase.mode === "lower"
                      ? ` (listing ${formatPrice(lastPurchase.listingPrice)})`
                      : " — the listing price"}{" "}
                    · sent {formatDateTime(lastPurchase.createdAt)}
                  </p>
                  {lastPurchase.agentNote ? (
                    <p className="text-xs text-muted-foreground">
                      {agentName}: {lastPurchase.agentNote}
                    </p>
                  ) : null}
                  {lastPurchase.status === "price_pushback" &&
                  lastPurchase.agentSuggestedPrice ? (
                    <div className="mt-2 rounded-md border border-gold/40 bg-gold-tint/40 p-3">
                      <p className="text-xs text-foreground">
                        {agentName} recommends keeping the price a little higher —{" "}
                        <strong>{formatPrice(lastPurchase.agentSuggestedPrice)}</strong> — to have a
                        realistic chance with the seller.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          raiseOffer(lastPurchase.id, lastPurchase.agentSuggestedPrice!);
                          alertAgent(
                            "Your buyer accepted your suggested price",
                            `${lead.propertyLabel} — new offer ${formatPrice(
                              lastPurchase.agentSuggestedPrice!,
                            )}`,
                          );
                          toast("Your agent has been notified.");
                        }}
                        className={`${btnPrimary} mt-2`}
                      >
                        Offer {formatPrice(lastPurchase.agentSuggestedPrice)} instead
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  No purchase request yet. When you are ready, ask your agent to proceed — at the
                  listing price or with a lower offer.
                </p>
              )}
            </div>

            {lastChange ? (
              <div className="rounded-lg border border-border bg-background p-4 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Property change request
                </div>
                <p className="mt-1 text-foreground">
                  {lastChange.kind === "buyer_picked"
                    ? `You chose ${lastChange.pickedPropertyLabel}`
                    : "Your agent is looking for other options on your criteria"}{" "}
                  ·{" "}
                  {lastChange.status === "acknowledged"
                    ? "your agent is on it"
                    : "waiting for your agent"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Reason: {lastChange.reason}</p>
                {lastChange.criteria.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Criteria: {lastChange.criteria.join(", ")}
                    {lastChange.customCriteria ? `, ${lastChange.customCriteria}` : ""}
                  </p>
                ) : null}
                {lastChange.agentNote ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {agentName}: {lastChange.agentNote}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "chat" ? (
          <FileChatPanel
            leadId={lead.id}
            side="client"
            myName={myName}
            otherName={agentName}
            otherEmail={agentEmail}
            propertyId={lead.propertyId}
            propertyLabel={lead.propertyLabel}
          />
        ) : null}

        {tab === "purchase" ? (
          <div className="space-y-3">
            {openPurchase ? (
              <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                You already have a request with {agentName} —{" "}
                {PURCHASE_STATUS_LABEL[openPurchase.status].toLowerCase()}. Check the Status tab.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Tell {agentName} you want to move ahead with{" "}
                  <strong className="text-foreground">{lead.propertyLabel}</strong>. Choose the price
                  you want to offer — your agent gives their price opinion before anything goes to the
                  seller.
                </p>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    checked={priceMode === "listing"}
                    onChange={() => setPriceMode("listing")}
                    className="mt-1"
                  />
                  <span>
                    Agree to the listing price —{" "}
                    <strong>{formatPrice(lead.propertyPrice)}</strong>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    checked={priceMode === "lower"}
                    onChange={() => setPriceMode("lower")}
                    className="mt-1"
                  />
                  <span>Offer a lower price</span>
                </label>
                {priceMode === "lower" ? (
                  <input
                    inputMode="numeric"
                    value={offer}
                    onChange={(e) => setOffer(e.target.value.replace(/[^\d]/g, ""))}
                    placeholder="Your offer in USD"
                    className={inputClass}
                  />
                ) : null}
                <textarea
                  rows={3}
                  value={purchaseNote}
                  onChange={(e) => setPurchaseNote(e.target.value)}
                  placeholder="Anything your agent should know (optional)"
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={submitPurchase} className={btnPrimary}>
                    Send the request to proceed
                  </button>
                  <button type="button" onClick={() => setTab("status")} className={btnGhost}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}

        {tab === "change" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              If this property is not the one, your agent can look for similar options — or you can
              name a property you found yourself.
            </p>
            <div className="space-y-1.5">
              {(
                [
                  ["agent_proposes", "Ask my agent to propose similar properties"],
                  ["buyer_picked", "I have chosen another property myself"],
                ] as ["agent_proposes" | "buyer_picked", string][]
              ).map(([id, label]) => (
                <label key={id} className="flex items-start gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    checked={changeKind === id}
                    onChange={() => setChangeKind(id)}
                    className="mt-1"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Why did this property not work for you?
              </div>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="For example: the living room is too small and it needs a new roof."
                className={`${inputClass} mt-1.5`}
              />
            </div>

            {changeKind === "agent_proposes" ? (
              <>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    What should be different?
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {CHANGE_CRITERIA.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setCriteria((cur) =>
                            cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c],
                          )
                        }
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          criteria.includes(c)
                            ? "bg-brand text-background"
                            : "border border-border text-muted-foreground hover:bg-brand-tint"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <input
                    value={customCriteria}
                    onChange={(e) => setCustomCriteria(e.target.value)}
                    placeholder="Anything else that matters to you (optional)"
                    className={`${inputClass} mt-2`}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Location
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {(Object.keys(LOCATION_LABEL) as LocationPreference[]).map((id) => (
                        <label
                          key={id}
                          className="flex items-start gap-2 text-xs text-foreground"
                        >
                          <input
                            type="radio"
                            checked={location === id}
                            onChange={() => setLocation(id)}
                            className="mt-0.5"
                          />
                          <span>{LOCATION_LABEL[id]}</span>
                        </label>
                      ))}
                    </div>
                    <input
                      value={locationNote}
                      onChange={(e) => setLocationNote(e.target.value)}
                      placeholder="Preferred areas (optional)"
                      className={`${inputClass} mt-2`}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Price
                    </div>
                    <div className="mt-1.5 space-y-1">
                      {(Object.keys(PRICE_LABEL) as PricePreference[]).map((id) => (
                        <label
                          key={id}
                          className="flex items-start gap-2 text-xs text-foreground"
                        >
                          <input
                            type="radio"
                            checked={price === id}
                            onChange={() => setPrice(id)}
                            className="mt-0.5"
                          />
                          <span>{PRICE_LABEL[id]}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  The property you would like instead
                </div>
                <select
                  value={pickedId}
                  onChange={(e) => setPickedId(e.target.value)}
                  className={`${inputClass} mt-1.5`}
                >
                  <option value="">Select a property…</option>
                  {otherProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.address}, {p.location} — {formatPrice(p.price)}
                    </option>
                  ))}
                </select>
                <Link
                  to="/marketplace"
                  className="mt-2 inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint"
                >
                  Search properties on the marketplace ↗
                </Link>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={submitChange} className={btnPrimary}>
                Send to my agent
              </button>
              <button type="button" onClick={() => setTab("status")} className={btnGhost}>
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
