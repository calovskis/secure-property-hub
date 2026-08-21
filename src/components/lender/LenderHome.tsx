import { useMemo } from "react";
import { useLeads, hasPricedOffer, leadState, type MortgageLead } from "@/lib/leads";
import { useLenderTeam } from "@/lib/lender-team";
import { formatDate, formatDateTime } from "@/lib/dates";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const DAY = 24 * 60 * 60 * 1000;
/** Service-level target: a decision is due 3 business-ish days after intake. */
export const SLA_DAYS = 3;

export function slaDueDate(lead: MortgageLead) {
  return new Date(new Date(lead.submittedAt).getTime() + SLA_DAYS * DAY);
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

export function useLenderStats() {
  const { leads: allLeads } = useLeads();
  const { scopedStates } = useLenderTeam();
  return useMemo(() => {
    // Seats limited to specific states only ever count work located there.
    const leads = scopedStates
      ? allLeads.filter((l) => scopedStates.includes(leadState(l)))
      : allLeads;
    const hiddenByScope = allLeads.length - leads.length;
    const now = new Date();
    const weekEnd = new Date(now.getTime() + 7 * DAY);
    const open = leads.filter((l) => l.status === "new" || l.status === "info_required");
    const closedToday = leads.filter((l) => l.decidedAt && isSameDay(new Date(l.decidedAt), now));
    const requestedToday = leads.filter((l) => isSameDay(new Date(l.submittedAt), now));
    const dueThisWeek = open
      .map((l) => ({ lead: l, due: slaDueDate(l) }))
      .filter((d) => d.due <= weekEnd)
      .sort((a, b) => a.due.getTime() - b.due.getTime());
    const decided = leads.filter((l) => l.decidedAt);
    const avgHours =
      decided.length === 0
        ? 0
        : decided.reduce(
            (sum, l) =>
              sum +
              (new Date(l.decidedAt!).getTime() - new Date(l.submittedAt).getTime()) / 3_600_000,
            0,
          ) / decided.length;
    const qualified = leads.filter((l) => l.status === "qualified");
    const priced = leads.filter(hasPricedOffer);
    const scored = leads.filter((l) => typeof l.creditScore === "number");

    return {
      leads,
      hiddenByScope,
      total: leads.length,
      open,
      inProgress: leads.filter((l) => l.status === "info_required"),
      newCount: leads.filter((l) => l.status === "new").length,
      qualified,
      notQualified: leads.filter((l) => l.status === "not_qualified"),
      priced,
      closedToday,
      requestedToday,
      dueThisWeek,
      overdue: open.filter((l) => slaDueDate(l) < now),
      avgHours,
      approvalRate: decided.length === 0 ? 0 : (qualified.length / decided.length) * 100,
      pipelineValue: open.reduce((s, l) => s + l.propertyPrice, 0),
      approvedVolume: priced.reduce(
        (s, l) => s + l.propertyPrice * (1 - (l.terms?.downPaymentPct ?? 20) / 100),
        0,
      ),
      avgScore:
        scored.length === 0
          ? 0
          : scored.reduce((s, l) => s + (l.creditScore ?? 0), 0) / scored.length,
      openDocRequests: leads.reduce(
        (s, l) => s + l.infoRequests.filter((r) => !r.answeredAt).length,
        0,
      ),
    };
  }, [allLeads, scopedStates]);
}

export function StatCard({
  label,
  value,
  note,
  tone = "brand",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "brand" | "gold" | "success" | "destructive";
}) {
  const toneClass = {
    brand: "text-brand",
    gold: "text-gold",
    success: "text-success",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

export function LenderHome({
  lenderName,
  onOpenRequests,
}: {
  lenderName: string;
  onOpenRequests: (leadId?: string) => void;
}) {
  const s = useLenderStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-[30px]">Home dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lenderName} · Live view of every Loqal pre-approval inquiry routed to your desk.
        </p>
      </div>

      {s.hiddenByScope > 0 ? (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          {s.hiddenByScope} {s.hiddenByScope === 1 ? "request is" : "requests are"} outside your
          licensed state coverage and hidden from this seat. A portal admin can widen your state
          scope in Other → Team.
        </div>
      ) : null}

      {s.newCount > 0 || s.overdue.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gold/40 bg-gold-tint px-4 py-3">
          <span className="text-lg">🔔</span>
          <p className="text-sm font-semibold text-foreground">
            {s.newCount} new {s.newCount === 1 ? "inquiry" : "inquiries"} awaiting first review
            {s.overdue.length > 0 ? ` · ${s.overdue.length} past the ${SLA_DAYS}-day SLA` : ""}.
          </p>
          <button
            type="button"
            onClick={() => onOpenRequests()}
            className="ml-auto rounded-md bg-brand px-4 py-1.5 text-xs font-semibold text-background"
          >
            Open queue
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open requests"
          value={String(s.open.length)}
          note={`${s.newCount} not yet touched`}
          tone="gold"
        />
        <StatCard
          label="In process"
          value={String(s.inProgress.length)}
          note={`${s.openDocRequests} outstanding client requests`}
        />
        <StatCard
          label="Mortgage inquiries (all time)"
          value={String(s.total)}
          note={`${s.requestedToday.length} requested today`}
        />
        <StatCard
          label="Pre-approvals issued"
          value={String(s.closedToday.length)}
          note={`${s.qualified.length} qualified · ${s.notQualified.length} declined overall`}
          tone="success"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pipeline value"
          value={money(s.pipelineValue)}
          note="Purchase price of open files"
        />
        <StatCard
          label="Priced offers issued"
          value={String(s.priced.length)}
          note="Rate, term and costs delivered"
        />
        <StatCard
          label="Avg. response time"
          value={s.avgHours ? `${s.avgHours.toFixed(1)}h` : "—"}
          note="Intake → decision"
        />
        <StatCard
          label="Approval rate"
          value={s.approvalRate ? `${s.approvalRate.toFixed(0)}%` : "—"}
          note="Of all decided files"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Deadlines this week</h2>
            <span className="text-xs text-muted-foreground">{SLA_DAYS}-day decision SLA</span>
          </div>
          {s.dueThisWeek.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nothing due in the next seven days.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {s.dueThisWeek.map(({ lead, due }) => {
                const late = due < new Date();
                return (
                  <li key={lead.id} className="py-1">
                    <button
                      type="button"
                      onClick={() => onOpenRequests(lead.id)}
                      className="flex w-full items-center justify-between gap-4 rounded-md px-2 py-2 text-left hover:bg-brand-tint/40"
                    >
                    <div>
                      <div className="text-sm font-semibold text-foreground">{lead.clientName}</div>
                      <div className="text-xs text-muted-foreground">
                        {lead.propertyLabel} · {money(lead.propertyPrice)}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${
                        late ? "bg-destructive/10 text-destructive" : "bg-brand-tint text-brand"
                      }`}
                    >
                      {late ? "Overdue" : "Due"} {formatDate(due)}
                    </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">Latest activity</h2>
          {s.leads.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No inquiries yet — new client applications appear here instantly.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {s.leads.slice(0, 6).map((l) => (
                <li key={l.id} className="text-sm">
                  <button
                    type="button"
                    onClick={() => onOpenRequests(l.id)}
                    className="w-full rounded-md px-2 py-1.5 text-left hover:bg-brand-tint/40"
                  >
                  <div className="font-semibold text-foreground">{l.clientName}</div>
                  <div className="text-xs text-muted-foreground">
                    {l.status === "new"
                      ? "Submitted a pre-approval request"
                      : l.status === "info_required"
                        ? "Additional information requested"
                        : l.status === "qualified"
                          ? "Qualified" + (l.terms ? " with priced terms" : " — pricing pending")
                          : "Declined"}{" "}
                    · {formatDateTime(l.decidedAt ?? l.submittedAt)}
                  </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
