/** Partner dashboard "Recent activity": every update on the partner's files, newest first — done work included. */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/lib/notifications";
import { openDeepLink } from "@/lib/deep-link";
import { formatDateTime } from "@/lib/dates";

export function PartnerRecentActivity() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications } = useNotifications(user?.email);
  const [all, setAll] = useState(false);
  const items = [...notifications]
    .filter((n) => !n.id.includes("-rem-"))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const visible = all ? items : items.slice(0, 6);
  if (!user) return null;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        {items.length > 6 ? (
          <button type="button" onClick={() => setAll((v) => !v)} className="text-xs font-semibold text-brand">
            {all ? "Show less" : `Show all ${items.length}`}
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="mt-3 rounded-lg border border-border px-3 py-4 text-center text-xs text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {visible.map((n) => {
            const done = n.completed || n.badge === "Done" || n.severity === "info";
            return (
              <button
                key={n.id}
                type="button"
                disabled={!n.href}
                onClick={() => n.href && openDeepLink(navigate, n.href)}
                className="flex w-full items-start gap-2.5 py-2.5 text-left transition-colors hover:bg-brand-tint/40 disabled:cursor-default"
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${done ? "bg-success/10 text-success" : "bg-brand-tint text-brand"}`}
                >
                  {done ? "✓" : "↻"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground">{n.title}</span>
                    {n.badge ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{n.badge}</span> : null}
                  </span>
                  {n.body ? <span className="mt-0.5 block truncate text-xs text-muted-foreground">{n.body}</span> : null}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatDateTime(n.createdAt)}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
