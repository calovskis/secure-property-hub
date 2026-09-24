/**
 * Client dashboard "Recent Activity & Updates": the newest steps taken on the
 * client's property files — by the client and by their partners (lender,
 * buyer's agent) — pulled from the same trail as Properties in Action.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useClientPropertyActivity, type ActivityTone } from "@/lib/property-activity";
import { openDeepLink } from "@/lib/deep-link";
import { formatDateTime } from "@/lib/dates";

const TONE: Record<ActivityTone, { icon: string; cls: string; label: string }> = {
  pending: { icon: "!", cls: "bg-warning/10 text-warning", label: "Needs you" },
  update: { icon: "↻", cls: "bg-brand-tint text-brand", label: "In progress" },
  done: { icon: "✓", cls: "bg-success/10 text-success", label: "Completed" },
};

export function RecentActivityCard() {
  const files = useClientPropertyActivity();
  const navigate = useNavigate();
  const [all, setAll] = useState(false);

  const items = useMemo(
    () =>
      files
        .flatMap((f) =>
          f.items.map((i) => ({ ...i, property: f.propertyLabel, propertyId: f.propertyId })),
        )
        .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    [files],
  );
  const visible = all ? items : items.slice(0, 6);

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Recent Activity & Updates</h2>
        {items.length > 6 ? (
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {all ? "Show less" : `View all (${items.length}) →`}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-md border border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Updates from you, your lender and your buyer's agent will appear here as your property
          files progress.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((i, idx) => {
            const tone = TONE[i.tone];
            const href = i.action?.href ?? `/property/${i.propertyId}/workspace`;
            return (
              <li key={`${i.at}-${idx}`}>
                <button
                  type="button"
                  onClick={() => openDeepLink(navigate, href)}
                  className="flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-brand-tint/40"
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone.cls}`}
                  >
                    {tone.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-foreground">{i.label}</span>
                    {i.detail ? (
                      <span className="mt-0.5 block line-clamp-2 text-[12px] text-muted-foreground">
                        {i.detail}
                      </span>
                    ) : null}
                    <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {i.property} · {formatDateTime(i.at)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${tone.cls}`}
                  >
                    {i.action && i.tone === "pending" ? i.action.cta : tone.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
