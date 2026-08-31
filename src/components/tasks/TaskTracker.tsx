/**
 * "All tasks" tracker — one compact card that groups every open action the
 * signed-in user still has on the platform. The groups are derived from the
 * same state-based notifications the header bell shows, so nothing has to be
 * tracked twice: only items that still need action (not completed, and for
 * the right audience) are counted, and each row deep-links to the newest
 * item in that group.
 *
 * Groups differ per audience: clients see documents / pre-approvals /
 * viewings, partners see licences, buyer files and Loqal requests, admins see
 * registrations, agreements and correspondence.
 */
import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useNotifications, type AppNotification } from "@/lib/notifications";
import { openDeepLink } from "@/lib/deep-link";

type GroupId =
  | "documents"
  | "preapproval"
  | "viewings"
  | "licences"
  | "buyerFiles"
  | "loqalRequests"
  | "registrations"
  | "agreements"
  | "correspondence"
  | "other";

type GroupDef = {
  id: GroupId;
  label: string;
  icon: string;
  tone: string;
};

const GROUPS: Record<GroupId, GroupDef> = {
  documents: { id: "documents", label: "Documents & data", icon: "📄", tone: "bg-brand-tint text-brand" },
  preapproval: { id: "preapproval", label: "Mortgage pre-approval", icon: "🏦", tone: "bg-brand-tint text-brand" },
  viewings: { id: "viewings", label: "Viewings & calls", icon: "🗓", tone: "bg-gold-tint text-gold" },
  licences: { id: "licences", label: "Licences & verification", icon: "🪪", tone: "bg-gold-tint text-gold" },
  buyerFiles: { id: "buyerFiles", label: "Buyer files", icon: "🗂", tone: "bg-brand-tint text-brand" },
  loqalRequests: { id: "loqalRequests", label: "Requests from Loqal", icon: "📝", tone: "bg-brand-tint text-brand" },
  registrations: { id: "registrations", label: "Partner registrations", icon: "🤝", tone: "bg-brand-tint text-brand" },
  agreements: { id: "agreements", label: "Agreements to countersign", icon: "✍️", tone: "bg-gold-tint text-gold" },
  correspondence: { id: "correspondence", label: "Partner correspondence", icon: "💬", tone: "bg-brand-tint text-brand" },
  other: { id: "other", label: "Other actions", icon: "✅", tone: "bg-muted text-foreground" },
};

/** Map a derived notification id to the task group it belongs to. */
function groupOf(id: string): GroupId {
  const starts = (...p: string[]) => p.some((x) => id.startsWith(x));
  if (starts("doc-", "visa")) return "documents";
  if (starts("draft-", "offer-", "inforeq-", "assigned-")) return "preapproval";
  if (starts("call-", "photos-", "proposal-", "booking-")) return "viewings";
  if (starts("lic-", "kyc-", "sign-")) return "licences";
  if (starts("photoreq-", "decision-")) return "buyerFiles";
  if (starts("areq-", "adminreq-", "req-")) return "loqalRequests";
  if (starts("preq-")) return "registrations";
  if (starts("countersign-")) return "agreements";
  return "other";
}

/** Admin-side ids get their own labels even when they share a prefix. */
function adminGroupOf(id: string): GroupId {
  if (id.startsWith("preq-")) return "registrations";
  if (id.startsWith("countersign-")) return "agreements";
  if (id.startsWith("kyc-")) return "registrations";
  if (id.startsWith("areq-")) return "correspondence";
  return "other";
}

type Row = { def: GroupDef; count: number; href?: string | undefined; urgent: boolean };

export function TaskTracker({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const { notifications } = useNotifications(user?.email);
  const { notifications: adminItems } = useNotifications(isAdmin ? "admins" : undefined);

  const rows = useMemo<Row[]>(() => {
    const open = (list: AppNotification[]) => list.filter((n) => !n.completed);
    const buckets = new Map<GroupId, Row>();

    const add = (n: AppNotification, gid: GroupId) => {
      const def = GROUPS[gid];
      const cur = buckets.get(gid);
      if (cur) {
        cur.count += 1;
        cur.urgent = cur.urgent || n.severity === "critical";
        return;
      }
      buckets.set(gid, {
        def,
        count: 1,
        href: n.href,
        urgent: n.severity === "critical",
      });
    };

    // Newest first already; the first item of a group becomes its link target.
    for (const n of open(notifications)) add(n, groupOf(n.id));
    for (const n of open(adminItems)) add(n, adminGroupOf(n.id));

    return [...buckets.values()].sort((a, b) => b.count - a.count);
  }, [notifications, adminItems]);

  if (!user) return null;

  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-base"
          >
            ☰
          </span>
          <h2 className="text-lg font-semibold text-foreground">All tasks</h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {total}
          </span>
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-4 rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing needs your attention right now.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {rows.map((r) => (
            <button
              key={r.def.id}
              type="button"
              disabled={!r.href}
              onClick={() => r.href && openDeepLink(navigate, r.href)}
              className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-brand-tint/40 disabled:cursor-default"
            >
              <span
                aria-hidden
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base ${r.def.tone}`}
              >
                {r.def.icon}
              </span>
              <span className="flex-1 text-sm font-medium text-foreground">
                {r.def.label}
                {r.urgent ? (
                  <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                    Urgent
                  </span>
                ) : null}
              </span>
              <span className="text-sm font-semibold text-foreground">{r.count}</span>
              <span aria-hidden className="text-xs text-muted-foreground">
                ›
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
