/**
 * "Properties in action" tab of the property search: every property the
 * signed-in client already has an active process on (pre-approval inquiry,
 * lender correspondence, agent visits, photos, decisions), shown from the
 * client's perspective.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { openDeepLink } from "@/lib/deep-link";
import { formatPrice } from "@/data/properties";
import { formatDateTime } from "@/lib/dates";
import type { ActivityTone, PropertyActivity } from "@/lib/property-activity";

const TONE_STYLE: Record<ActivityTone, string> = {
  pending: "border-gold/40 bg-gold-tint text-gold",
  update: "border-brand/30 bg-brand-tint text-brand",
  done: "border-border bg-muted/40 text-muted-foreground",
};

const TONE_DOT: Record<ActivityTone, string> = {
  pending: "bg-gold",
  update: "bg-brand",
  done: "bg-border",
};

export function PropertiesInAction({ items }: { items: PropertyActivity[] }) {
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-10 py-16 text-center">
        <div className="mb-4 text-5xl" aria-hidden="true">
          📂
        </div>
        <div className="mb-2 text-xl font-semibold text-foreground">No properties in action yet</div>
        <div className="text-sm text-muted-foreground">
          As soon as you submit a mortgage pre-approval, request a visit or exchange messages about
          a property, it will appear here with everything that is ongoing.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((entry) => (
        <div
          key={entry.leadId}
          className="overflow-hidden rounded-lg border border-brand/30 bg-card shadow-sm"
        >
          <div className="flex flex-col gap-3 border-b border-border bg-brand-tint/50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="rounded border border-brand/30 bg-brand/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand">
                  In action
                </span>
                {entry.awaitingClient > 0 ? (
                  <span className="rounded border border-gold/40 bg-gold-tint px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
                    {entry.awaitingClient} awaiting your answer
                  </span>
                ) : null}
              </div>
              <div className="text-base font-semibold text-foreground">{entry.propertyLabel}</div>
              <div className="text-sm text-muted-foreground">
                {formatPrice(entry.propertyPrice)}
                {entry.property ? ` · ${entry.property.type}` : ""}
              </div>
            </div>
            <Link
              to="/property/$propertyId"
              params={{ propertyId: String(entry.propertyId) }}
              className="self-start rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Open property
            </Link>
          </div>

          <div className="p-5">
            <div className="mb-4 rounded-md border border-border bg-muted/30 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Where it stands
              </div>
              <div className="text-sm font-semibold text-foreground">{entry.headline}</div>
              {entry.action ? (
                <button
                  type="button"
                  onClick={() => openDeepLink(navigate, entry.action!.href)}
                  className="mt-2 rounded-md bg-gold px-3 py-2 text-xs font-semibold text-background transition-colors hover:opacity-90"
                >
                  {entry.action.cta} →
                </button>
              ) : null}
            </div>

            <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              What is ongoing
            </div>
            <ol className="space-y-3">
              {entry.items.map((item, idx) => (
                <li key={`${entry.leadId}-${idx}`} className="flex gap-3">
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[item.tone]}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.label}</span>
                      {item.tone === "pending" && item.action ? (
                        <button
                          type="button"
                          onClick={() => openDeepLink(navigate, item.action!.href)}
                          title={item.action.cta}
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase underline-offset-2 transition-colors hover:underline ${TONE_STYLE[item.tone]}`}
                        >
                          Action needed →
                        </button>
                      ) : (
                        <span
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${TONE_STYLE[item.tone]}`}
                        >
                          {item.tone === "pending"
                            ? "Action needed"
                            : item.tone === "update"
                              ? "In progress"
                              : "Done"}
                        </span>
                      )}
                    </div>
                    {item.detail ? (
                      <div className="text-sm text-muted-foreground">{item.detail}</div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">{formatDateTime(item.at)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ))}
    </div>
  );
}
