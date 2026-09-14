/**
 * "Your price is confirmed" update on the client dashboard.
 *
 * As soon as the buyer's agent confirms the offered price and takes it to the
 * seller, the buyer sees the confirmation here — with the agent's opinion if
 * one was written — and the direct next step: sign the purchase agreement and
 * tell us how the property will be held. It disappears once signed.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useLeads } from "@/lib/leads";
import { usePartnerRequests } from "@/lib/partner-requests";
import { currentPartner } from "@/lib/partner-assignments";
import { usePropertyRequests } from "@/lib/property-requests";
import { useEntityPlans } from "@/lib/entity-structure";
import { formatPrice } from "@/data/properties";
import { formatDateTime } from "@/lib/dates";
import { partnerDisplayForClient } from "@/lib/user-id";

export function PriceConfirmedCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { leads } = useLeads();
  const { requests } = usePartnerRequests();
  const { purchases } = usePropertyRequests();
  const { plans } = useEntityPlans();

  const email = user?.email.toLowerCase() ?? "";

  const rows = useMemo(() => {
    const mine = leads.filter(
      (l) => l.clientEmail.toLowerCase() === email && l.status !== "annulled",
    );
    const byId = new Map(mine.map((l) => [l.id, l]));
    return purchases
      .filter((p) => byId.has(p.leadId) && p.status === "price_supported")
      .filter((p) => !plans.find((pl) => pl.leadId === p.leadId)?.agreementSignedAt)
      .sort((a, b) => (b.respondedAt ?? b.createdAt).localeCompare(a.respondedAt ?? a.createdAt))
      .map((p) => {
        const lead = byId.get(p.leadId)!;
        const partner = currentPartner(lead, "realtor", requests);
        const agent = partner
          ? partnerDisplayForClient(
              `${partner.firstName} ${partner.lastName}`.trim(),
              partner.email,
            )
          : "your buyer's agent";
        return { purchase: p, lead, agent };
      });
  }, [purchases, leads, requests, plans, email]);

  if (!user || user.role !== "client") return null;
  if (!rows.length) return null;

  return (
    <section
      className={`rounded-xl border border-success/40 bg-success/5 ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">
          Your purchase price is confirmed
        </h3>
      </div>

      <ul className="mt-3 space-y-3">
        {rows.map(({ purchase, lead, agent }) => (
          <li
            key={purchase.id}
            className="rounded-lg border border-border bg-background p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{lead.propertyLabel}</span>
              <span className="rounded bg-gold-tint px-2 py-0.5 text-sm font-semibold text-foreground">
                {formatPrice(purchase.offerPrice)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {agent} confirmed this price
              {purchase.respondedAt ? ` on ${formatDateTime(purchase.respondedAt)}` : ""} and is
              presenting it to the seller.
            </p>
            {purchase.agentNote ? (
              <p className="mt-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-xs italic text-muted-foreground">
                {agent}: {purchase.agentNote}
              </p>
            ) : null}
            <p className="mt-2 text-xs text-foreground">
              Next step: sign the purchase agreement and tell us how the property will be held.
            </p>
            <Link
              to="/property/$propertyId"
              params={{ propertyId: String(lead.propertyId) }}
              search={{ open: "agreement" } as never}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-xs font-semibold text-background hover:bg-brand-soft"
            >
              Continue to the purchase agreement
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
