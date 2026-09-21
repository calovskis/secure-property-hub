/**
 * "Recent activity on Loqal" — everything users did across the platform, next
 * to the Loqal team's own open tasks on the admin dashboard. Tasks are what
 * Loqal has to do; this card is what everybody else has been doing.
 */
import { useState } from "react";
import { useActivity } from "@/lib/activity";
import { formatDateTime } from "@/lib/dates";

const MAX_VISIBLE = 6;

/** "3 hours ago" style age, matching the open-tasks card. */
function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const mins = Math.floor(ms / 60_000);
  return mins >= 1 ? `${mins} min ago` : "just now";
}

export function AdminActivityCard({ className = "" }: { className?: string }) {
  const entries = useActivity();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? entries.slice(0, 40) : entries.slice(0, MAX_VISIBLE);
  const hidden = Math.max(Math.min(entries.length, 40) - visible.length, 0);

  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Recent activity on Loqal</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {entries.length}
          </span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-3 rounded-lg border border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No activity yet — registrations, requests, decisions and signatures appear here.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {visible.map((e) => (
            <div key={e.id} className="flex items-start gap-2.5 py-2.5">
              <span
                aria-hidden
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs"
              >
                👤
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-foreground">
                  <strong className="font-semibold">{e.actor}</strong> {e.action}
                </div>
                {e.details ? (
                  <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
                    {e.details}
                  </div>
                ) : null}
                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {ago(e.at)} · {formatDateTime(e.at)}
                </div>
              </div>
            </div>
          ))}
          {hidden > 0 || showAll ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full py-2 text-left text-xs font-semibold text-brand hover:underline"
            >
              {showAll ? "Show less" : `Show ${hidden} more`}
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
