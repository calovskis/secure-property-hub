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
import { useActiveLeads } from "@/lib/leads";
import { usePartnerRequests } from "@/lib/partner-requests";
import { useDeletions } from "@/lib/deletions";
import { pendingVerifications } from "@/lib/licence-verification";
import { formatDate, formatDateTime } from "@/lib/dates";

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
  | "companySetup"
  | "other";

type GroupDef = {
  id: GroupId;
  label: string;
  icon: string;
  tone: string;
};

const GROUPS: Record<GroupId, GroupDef> = {
  documents: {
    id: "documents",
    label: "Documents & data",
    icon: "📄",
    tone: "bg-brand-tint text-brand",
  },
  preapproval: {
    id: "preapproval",
    label: "Mortgage pre-approval",
    icon: "🏦",
    tone: "bg-brand-tint text-brand",
  },
  buyerAgent: {
    id: "buyerAgent",
    label: "Your buyer's agent",
    icon: "🤝",
    tone: "bg-gold-tint text-gold",
  },
  viewings: {
    id: "viewings",
    label: "Viewings & calls",
    icon: "🗓",
    tone: "bg-gold-tint text-gold",
  },
  licences: {
    id: "licences",
    label: "Licences & verification",
    icon: "🪪",
    tone: "bg-gold-tint text-gold",
  },
  buyerFiles: {
    id: "buyerFiles",
    label: "Buyer files",
    icon: "🗂",
    tone: "bg-brand-tint text-brand",
  },
  loqalRequests: {
    id: "loqalRequests",
    label: "Requests from Loqal",
    icon: "📝",
    tone: "bg-brand-tint text-brand",
  },
  registrations: {
    id: "registrations",
    label: "Partner registrations",
    icon: "🤝",
    tone: "bg-brand-tint text-brand",
  },
  agreements: {
    id: "agreements",
    label: "Agreements to countersign",
    icon: "✍️",
    tone: "bg-gold-tint text-gold",
  },
  correspondence: {
    id: "correspondence",
    label: "Partner correspondence",
    icon: "💬",
    tone: "bg-brand-tint text-brand",
  },
  companySetup: {
    id: "companySetup",
    label: "Company set-ups & agreements",
    icon: "🏢",
    tone: "bg-gold-tint text-gold",
  },
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
  if (starts("lenderinq-", "hardcheck-")) return "buyerFiles";
  if (starts("photoreq-", "decision-")) return "buyerFiles";
  if (starts("buyerprice-", "buyerchange-", "filereq-", "filechat-", "pricedecided-"))
    return "buyerFiles";
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
  if (id.startsWith("licverif-")) return "licences";
  if (id.startsWith("areq-")) return "correspondence";
  if (id.startsWith("entitysetup-")) return "companySetup";
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
    "entityown-",
    "entityexisting-",
    "agreement-signed-",
  ];
  if (informational.some((p) => id.startsWith(p))) return false;
  // A hard check already reconfirmed is only a record, not open work.
  if (id.startsWith("hardcheck-") && n.badge === "Done") return false;
  return true;
}

const MAX_VISIBLE = 6;

type Task = {
  def: GroupDef;
  notification: AppNotification;
};

/** "3 days ago" style age so it is obvious how long a task has been waiting. */
function waitingFor(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `waiting ${days} day${days === 1 ? "" : "s"}`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours >= 1) return `waiting ${hours} hour${hours === 1 ? "" : "s"}`;
  return "new";
}

export function TaskTracker({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const { notifications } = useNotifications(user?.email);
  const { notifications: adminItems } = useNotifications(isAdmin ? "admins" : undefined);
  const { leads } = useActiveLeads();
  const { requests } = usePartnerRequests();
  const { deleted } = useDeletions();

  /**
   * Loqal-side tasks read straight off the live records instead of waiting for
   * a notification to exist: partner registrations to approve, agreements to
   * countersign, KYB questionnaires to review and every state licence a partner
   * submitted that nobody verified yet.
   */
  const staffTasks = useMemo<Task[]>(() => {
    if (!isAdmin) return [];
    const gone = new Set(deleted.map((d) => d.email.trim().toLowerCase()));
    const list: Task[] = [];
    const add = (
      id: string,
      gid: GroupId,
      title: string,
      body: string,
      href: string,
      createdAt: string,
      severity: AppNotification["severity"] = "warning",
    ) =>
      list.push({
        def: GROUPS[gid],
        notification: { id, to: "admins", title, body, href, severity, createdAt },
      });

    for (const r of requests) {
      if (r.status === "declined" || gone.has(r.email.trim().toLowerCase())) continue;
      const who = r.companyName || `${r.firstName} ${r.lastName}`.trim();

      if (r.status === "pending")
        add(
          `preq-${r.id}`,
          "registrations",
          `Approve the ${r.kind === "partner" ? "partner" : "corporate"} registration — ${who}`,
          "Review the registration details and approve or decline it.",
          `/admin-partner-requests?focus=${r.id}`,
          r.submittedAt,
        );

      if (r.status === "approved" && r.agreementSignedAt && !r.agreementCountersignedAt)
        add(
          `countersign-${r.id}`,
          "agreements",
          `Countersign the partnership agreement — ${who}`,
          `Signed by the partner on ${formatDateTime(r.agreementSignedAt)}.`,
          `/admin-partner-requests?focus=${r.id}&open=profile`,
          r.agreementSignedAt,
        );

      if (r.kyc)
        add(
          `kyc-${r.id}`,
          "registrations",
          `Review the KYB questionnaire — ${who}`,
          "Director and shareholder information is ready for review.",
          `/admin-partner-requests?focus=${r.id}&open=profile`,
          r.kyc.submittedAt,
          "info",
        );

      /* One task per partner, however many states they submitted — the
         verification pop-up handles them all in one go. */
      const pendingLic = pendingVerifications(r);
      if (pendingLic.length === 1) {
        const l = pendingLic[0]!;
        add(
          `licverif-${r.id}-${l.state}`,
          "licences",
          `Verify the ${l.state} licence — ${who}`,
          `${l.number || "Licence"}${l.validUntil ? ` · valid till ${formatDate(l.validUntil)}` : ""} · ${
            l.doc ? "copy uploaded" : "no copy attached yet"
          }. Verify it to clear ${who} for cases in ${l.state}.`,
          `/admin-people/${r.kind}-${r.id}`,
          l.pendingSince ?? l.uploadedAt ?? r.submittedAt,
        );
      } else if (pendingLic.length > 1) {
        const oldest = pendingLic
          .map((l) => l.pendingSince ?? l.uploadedAt ?? r.submittedAt)
          .sort()[0]!;
        add(
          `licverif-${r.id}-all`,
          "licences",
          `Verify ${pendingLic.length} state licences — ${who}`,
          `${pendingLic
            .slice(0, 6)
            .map((l) => l.state)
            .join(", ")}${pendingLic.length > 6 ? ` and ${pendingLic.length - 6} more` : ""} — ${
            pendingLic.filter((l) => l.doc).length
          } with a copy on file. Verify them to clear ${who} for cases in those states.`,
          `/admin-people/${r.kind}-${r.id}`,
          oldest,
        );
      }

      for (const a of r.adminRequests ?? [])
        if (a.kind === "info" && a.answeredAt)
          add(
            `areq-answered-${a.id}`,
            "correspondence",
            `Read the answer from ${who}`,
            "The partner answered an information request from Loqal.",
            `/admin-partner-requests?focus=${r.id}&open=correspondence&item=${a.id}`,
            a.answeredAt,
            "info",
          );
    }
    return list;
  }, [isAdmin, requests, deleted]);


  const tasks = useMemo<Task[]>(() => {
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

      const leadForNotification = myLeads.find((lead) => notification.id.includes(lead.id));
      if (!leadForNotification) return true;
      if (notification.id.startsWith("offer-") && leadForNotification.clientDecision) return false;
      if (
        notification.id.startsWith("agentsetup-") &&
        leadForNotification.buyerAgent?.representation
      )
        return false;
      if (notification.id.startsWith("inforeq-")) {
        const request = leadForNotification.infoRequests.find((item) =>
          notification.id.includes(item.id),
        );
        if (request?.answeredAt) return false;
      }
      return true;
    };

    const list: Task[] = [];
    const seen = new Set<string>();
    const push = (n: AppNotification, gid: GroupId) => {
      if (seen.has(n.id)) return;
      seen.add(n.id);
      list.push({ def: GROUPS[gid], notification: n });
    };

    /* Loqal staff see only work that is theirs to do — approve a partner
       registration, countersign an agreement, verify a licence, answer a
       partner's request, set up a company structure. Everything a user did on
       their own side is activity, not a task, and lives in the activity card
       next to this one. */
    if (isAdmin) {
      for (const t of staffTasks)
        if (!seen.has(t.notification.id)) {
          seen.add(t.notification.id);
          list.push(t);
        }
      const adminTaskPrefixes = [
        "preq-",
        "countersign-",
        "kyc-",
        "licverif-",
        "areq-",
        "entitysetup-",
        "deletion-",
      ];
      for (const n of adminItems.filter(isStillOpen))
        /* Licence, registration, countersignature and KYB work is derived from
           the live records above, so stored copies must not double-count. */
        if (
          adminTaskPrefixes.some((p) => n.id.startsWith(p)) &&
          !["licverif-", "preq-", "countersign-", "kyc-", "areq-answered-"].some((p) =>
            n.id.startsWith(p),
          )
        )
          push(n, adminGroupOf(n.id));
    } else {
      for (const n of notifications.filter(isStillOpen)) push(n, groupOf(n.id));
      for (const n of adminItems.filter(isStillOpen)) push(n, adminGroupOf(n.id));
    }


    // Urgent first, then oldest waiting first — the longest-open task is the
    // one that needs attention.
    const weight = (n: AppNotification) =>
      n.severity === "critical" ? 0 : n.severity === "warning" ? 1 : 2;
    return list.sort(
      (a, b) =>
        weight(a.notification) - weight(b.notification) ||
        new Date(a.notification.createdAt).getTime() - new Date(b.notification.createdAt).getTime(),
    );
  }, [
    notifications,
    adminItems,
    staffTasks,
    isAdmin,
    leads,
    user?.email,
    user?.mortgageProfile?.submittedAt,
  ]);

  const [showAll, setShowAll] = useState(false);

  if (!user) return null;

  const visible = showAll ? tasks : tasks.slice(0, MAX_VISIBLE);
  const hidden = tasks.length - visible.length;

  return (
    <section className={`rounded-xl border border-border bg-card p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Open tasks</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {tasks.length}
          </span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p className="mt-3 rounded-lg border border-border px-3 py-4 text-center text-xs text-muted-foreground">
          No open tasks.
        </p>
      ) : (
        <div className="mt-2 divide-y divide-border">
          {visible.map(({ def, notification: n }) => (
            <button
              key={n.id}
              type="button"
              disabled={!n.href}
              onClick={() => n.href && openDeepLink(navigate, n.href)}
              className="flex w-full items-start gap-2.5 py-2.5 text-left transition-colors hover:bg-brand-tint/40 disabled:cursor-default"
            >
              <span
                aria-hidden
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${def.tone}`}
              >
                {def.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-foreground">{n.title}</span>
                  {n.severity === "critical" ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                      Urgent
                    </span>
                  ) : null}
                  {n.badge ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {n.badge}
                    </span>
                  ) : null}
                </span>
                {n.body ? (
                  <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                    {n.body}
                  </span>
                ) : null}
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {def.label} · {waitingFor(n.createdAt)}
                </span>
              </span>
              <span aria-hidden className="mt-1 text-xs text-muted-foreground">
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

