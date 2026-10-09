/** Familiar listing cards with the client's live deal status and next action. */
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Bath, BedDouble, Building2, ChevronDown, Clock3, MapPin, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openDeepLink } from "@/lib/deep-link";
import { formatPrice } from "@/data/properties";
import { formatDateTime } from "@/lib/dates";
import type { ActivityTone, PropertyActivity } from "@/lib/property-activity";

const TONE_DOT: Record<ActivityTone, string> = {
  pending: "bg-warning",
  update: "bg-brand",
  done: "bg-success",
};

export function PropertiesInAction({ items }: { items: PropertyActivity[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="py-16 text-center">
        <Building2 className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden="true" />
        <h2 className="mb-2 text-xl font-semibold text-foreground">No properties in action yet</h2>
        <p className="text-sm text-muted-foreground">Your active property files will appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((entry) => {
        const property = entry.property;
        const latest = entry.items[0];
        const action = entry.action;
        const needsAttention = entry.awaitingClient > 0;
        return (
          <article key={entry.leadId} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
            <Link to="/property/$propertyId/workspace" params={{ propertyId: String(entry.propertyId) }} aria-label={`Open deal workspace for ${entry.propertyLabel}`} className="relative flex h-[220px] items-center justify-center bg-brand-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
              <span className="text-7xl" aria-hidden="true">{property?.icon ?? "🏢"}</span>
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded border border-brand/20 bg-card px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand">
                <span className="size-1.5 rounded-full bg-brand" />In action
              </span>
            </Link>

            <div className="p-5">
              <div className="mb-2 text-2xl font-bold text-brand">{formatPrice(entry.propertyPrice)}</div>
              <h2 className="text-sm font-semibold leading-6 text-foreground">{property?.address ?? entry.propertyLabel}</h2>
              {property?.location ? <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0" />{property.location}</p> : null}
              {property ? <span className="mt-3 inline-block rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand">{property.type}</span> : null}
              {property ? (
                <dl className="mt-4 grid grid-flow-col auto-cols-fr divide-x divide-border border-y border-border py-3">
                  {property.beds > 0 ? <div className="text-center"><dt className="mb-1 flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><BedDouble className="size-3.5" />Beds</dt><dd className="text-sm font-semibold text-foreground">{property.beds}</dd></div> : null}
                  {property.baths > 0 ? <div className="text-center"><dt className="mb-1 flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><Bath className="size-3.5" />Baths</dt><dd className="text-sm font-semibold text-foreground">{property.baths}</dd></div> : null}
                  <div className="text-center"><dt className="mb-1 flex items-center justify-center gap-1 text-[10px] uppercase text-muted-foreground"><Maximize2 className="size-3.5" />{property.type === "Land" ? "Acres" : "Sqft"}</dt><dd className="text-sm font-semibold text-foreground">{property.sqft.toLocaleString()}</dd></div>
                </dl>
              ) : null}
            </div>

            <div className={`border-y border-border px-5 py-4 ${needsAttention ? "bg-warning/10" : "bg-brand-tint/50"}`}>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                <span className={`size-2 shrink-0 rounded-full ${needsAttention ? "bg-warning" : "bg-brand"}`} />
                {needsAttention ? "Needs your attention" : "In progress"}
              </div>
              <p className="text-sm font-semibold leading-6 text-foreground">{entry.headline}</p>
              {action ? <Button variant="link" className="mt-2 h-auto max-w-full justify-start whitespace-normal p-0 text-left text-xs text-brand" onClick={() => openDeepLink(navigate, action.href)}>{action.cta}<ArrowRight /></Button> : null}
            </div>

            <div className="p-5">
              {latest ? <p className="mb-4 flex items-start gap-1.5 text-[11px] leading-5 text-muted-foreground"><Clock3 className="mt-1 size-3 shrink-0" /><span>Updated {formatDateTime(latest.at)}</span></p> : null}
              <Button asChild className="w-full"><Link to="/property/$propertyId/workspace" params={{ propertyId: String(entry.propertyId) }}>Open deal workspace<ArrowRight /></Link></Button>
              <details className="group mt-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">Recent activity<ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary>
                <ol className="mt-4 space-y-4 border-t border-border pt-4">
                  {entry.items.slice(0, 3).map((item, idx) => {
                    const itemAction = item.action;
                    return <li key={`${entry.leadId}-${idx}`} className="flex gap-2.5"><span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${TONE_DOT[item.tone]}`} aria-hidden="true" /><div className="min-w-0"><p className="text-xs font-semibold leading-5 text-foreground">{item.label}</p>{item.detail ? <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}<p className="mt-1 text-[10px] text-muted-foreground">{formatDateTime(item.at)}</p>{itemAction && item.tone === "pending" ? <Button variant="link" className="mt-1 h-auto justify-start whitespace-normal p-0 text-left text-xs" onClick={() => openDeepLink(navigate, itemAction.href)}>{itemAction.cta}<ArrowRight /></Button> : null}</div></li>;
                  })}
                </ol>
              </details>
            </div>
          </article>
        );
      })}
    </div>
  );
}
