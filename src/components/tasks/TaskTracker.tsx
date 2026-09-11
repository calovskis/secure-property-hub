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
import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useNotifications, type AppNotification } from "@/lib/notifications";
import { openDeepLink } from "@/lib/deep-link";
import { useLeads } from "@/lib/leads";

type GroupId =
  | "documents"
  | "preapproval"
  | "viewings"
  | "buyerAgent"
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
  buyerAgent: { id: "buyerAgent", label: "Your buyer's agent", icon: "🤝", tone: "bg-gold-tint text-gold" },
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
  if (starts("agentsetup-")) return "buyerAgent";
  if (starts("proposal-", "booking-", "altslots-")) return "viewings";
  if (starts("lic-", "kyc-", "sign-", "pdoc-licences", "pdoc-identity")) return "licences";
  if (starts("lenderinq-")) return "buyerFiles";
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

/**
 * Only items the user still has to act on belong in the tracker. Purely
 * informational alerts (something was assigned, photos arrived, a call is
 * confirmed, a document was received) and repeat reminders of a task already
 * listed are filtered out, so the count matches real open work.
 */
function isActionable(n: AppNotification): boolean {
  if (n.completed) return false;
  const id = n.id;
  if (id.includes("-rem-")) return false; // reminder of a task already counted
  if (id.endsWith("-done")) return false;
  const informational = [
    "assigned-",
    "photos-",
    "call-",
    "active-",
    "areq-booked-",
    "areq-answered-",
    "decision-",
  ];
  if (informational.some((p) => id.startsWith(p))) return false;
  return true;
}

const MAX_VISIBLE = 4;

type Row = { def: GroupDef; count: number; href?: string | undefined; urgent: boolean };

export function TaskTracker({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const { notifications } = useNotifications(user?.email);
  const { notifications: adminItems } = useNotifications(isAdmin ? "admins" : undefined);
  const { leads } = useLeads();

  const rows = useMemo<Row[]>(() => {
    const email = user?.email.toLowerCase() ?? "";
    const myLeads = leads.filter(
      (lead) => lead.clientEmail.toLowerCase() === email && lead.status !== "annulled",
    );
    const hasSubmittedMortgage = Boolean(user?.mortgageProfile?.submittedAt) || myLeads.length > 0;

    const isStillOpen = (notification: AppNotification) => {
      if (!isActionable(notification)) return false;

      // Browser notifications can outlive the state that created them. The
      // saved mortgage profile / submitted lead is authoritative, so an old
      // questionnaire draft can never reappear as an open dashboard task.
      if (notification.id.startsWith("draft-") && hasSubmittedMortgage) return false;

      const leadForNotification = myLeads.find((lead) =>
        notification.id.includes(lead.id),
      );
      if (!leadForNotification) return true;
      if (notification.id.startsWith("offer-") && leadForNotification.clientDecision) return false;
      if (
        notification.id.startsWith("agentsetup-") &&
        leadForNotification.buyerAgent?.representation
      ) return false;
      if (notification.id.startsWith("inforeq-")) {
        const request = leadForNotification.infoRequests.find((item) =>
          notification.id.includes(item.id),
        );
        if (request?.answeredAt) return false;
      }
      return true;
    };

    const open = (list: AppNotification[]) => list.filter(isStillOpen);
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
  }, [notifications, adminItems, leads, user?.email, user?.mortgageProfile?.submittedAt]);

  const [showAll, setShowAll] = useState(false);

  if (!user) return null;

  const visible = showAll ? rows : rows.slice(0, MAX_VISIBLE);
  const hidden = rows.length - visible.length;
  const total = rows.reduce((s, r) => s + r.count, 0);

  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Open tasks</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {total}
          </span>
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-3 rounded-lg border border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No open tasks.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {visible.map((r) => (
            <button
              key={r.def.id}
              type="button"
              disabled={!r.href}
              onClick={() => r.href && openDeepLink(navigate, r.href)}
              className="flex w-full items-center gap-2.5 py-2 text-left transition-colors hover:bg-brand-tint/40 disabled:cursor-default"
            >
              <span
                aria-hidden
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${r.def.tone}`}
              >
                {r.def.icon}
              </span>
              <span className="flex-1 text-[13px] font-medium text-foreground">
                {r.def.label}
                {r.urgent ? (
                  <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                    Urgent
                  </span>
                ) : null}
              </span>
              <span className="text-[13px] font-semibold text-foreground">{r.count}</span>
              <span aria-hidden className="text-xs text-muted-foreground">
                ›
              </span>
            </button>
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
