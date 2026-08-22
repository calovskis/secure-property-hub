import { useMemo, useState } from "react";
import {
  isOpenRequest,
  useLeads,
  type MortgageLead,
} from "@/lib/leads";
import { useLenderTeam, type LenderMember } from "@/lib/lender-team";
import { StatCard } from "@/components/lender/LenderHome";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

type PeriodId = "today" | "3days" | "week" | "month" | "year";

const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "3days", label: "Last 3 days" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
];

/** [start, end) window for the current period, and the equivalent previous window. */
function periodRange(period: PeriodId, now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  let start: Date;
  let prevStart: Date;
  let prevEnd: Date;

  if (period === "today") {
    start = startOfToday;
    prevEnd = start;
    prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === "3days") {
    start = new Date(startOfToday.getTime() - 2 * 24 * 60 * 60 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 3 * 24 * 60 * 60 * 1000);
  } else if (period === "week") {
    start = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);
    prevEnd = start;
    prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEnd = start;
  } else {
    start = new Date(now.getFullYear(), 0, 1);
    prevStart = new Date(now.getFullYear() - 1, 0, 1);
    prevEnd = start;
  }

  return { start, end, prevStart, prevEnd };
}

function inRange(iso: string, start: Date, end: Date) {
  const t = new Date(iso).getTime();
  return t >= start.getTime() && t < end.getTime();
}

/** Earliest lender response: decision or first info request, whichever came first. */
export function firstResponseAt(lead: MortgageLead): string | undefined {
  const candidates = [lead.decidedAt, lead.infoRequests[0]?.requestedAt].filter(
    (v): v is string => Boolean(v),
  );
  if (candidates.length === 0) return undefined;
  return candidates.sort()[0];
}

export function responseHours(lead: MortgageLead): number | undefined {
  const at = firstResponseAt(lead);
  if (!at) return undefined;
  return (new Date(at).getTime() - new Date(lead.submittedAt).getTime()) / 3_600_000;
}

function avgResponseHours(leads: MortgageLead[]) {
  const timed = leads.map(responseHours).filter((h): h is number => typeof h === "number");
  if (timed.length === 0) return undefined;
  return timed.reduce((s, h) => s + h, 0) / timed.length;
}

export function memberStats(leads: MortgageLead[], memberId: string | null) {
  const mine = leads.filter((l) => (memberId ? l.assignedToId === memberId : !l.assignedToId));
  const qualified = mine.filter((l) => l.status === "qualified");
  const notQualified = mine.filter((l) => l.status === "not_qualified");
  const infoRequested = mine.filter((l) => l.status === "info_required");
  const inProcess = mine.filter((l) => l.status === "new" || l.status === "info_required");
  const cancelled = mine.filter((l) => l.clientDecision === "declined");
  const preApprovals = qualified.filter((l) => Boolean(l.terms));
  return {
    inquiries: mine.length,
    qualified: qualified.length,
    notQualified: notQualified.length,
    infoRequested: infoRequested.length,
    inProcess: inProcess.length,
    cancelled: cancelled.length,
    preApprovals: preApprovals.length,
    avgResponse: avgResponseHours(mine),
  };
}

function deltaText(current: number, previous: number) {
  if (!previous) return "";
  const diff = current - previous;
  const pct = (Math.abs(diff) / previous) * 100;
  if (diff === 0) return " · flat";
  return ` · ${diff > 0 ? "+" : "-"}${pct.toFixed(0)}%`;
}

export function LenderAnalytics() {
  const { leads: allLeads } = useLeads();
  const { members, active, scopedStates } = useLenderTeam();
  const [period, setPeriod] = useState<PeriodId>("month");
  const [compare, setCompare] = useState(true);

  const leads = useMemo(
    () =>
      scopedStates
        ? allLeads.filter((l) => {
            const m = l.propertyLabel.match(/\b([A-Z]{2})\b\s*$/);
            return scopedStates.includes(m?.[1] ?? "—");
          })
        : allLeads,
    [allLeads, scopedStates],
  );

  const { start, end, prevStart, prevEnd } = useMemo(() => periodRange(period), [period]);

  const current = useMemo(
    () => leads.filter((l) => inRange(l.submittedAt, start, end)),
    [leads, start, end],
  );
  const previous = useMemo(
    () => leads.filter((l) => inRange(l.submittedAt, prevStart, prevEnd)),
    [leads, prevStart, prevEnd],
  );

  const teamOf = (pool: MortgageLead[]) => {
    const qualified = pool.filter((l) => l.status === "qualified");
    const notQualified = pool.filter((l) => l.status === "not_qualified");
    const cancelled = pool.filter((l) => l.clientDecision === "declined");
    const infoReturned = pool.filter((l) => l.infoRequests.length > 0);
    const inProcess = pool.filter((l) => l.status === "new" || l.status === "info_required");
    return {
      total: pool.length,
      qualified: qualified.length,
      notQualified: notQualified.length,
      cancelled: cancelled.length,
      infoReturned: infoReturned.length,
      inProcess: inProcess.length,
      avgResponse: avgResponseHours(pool),
    };
  };

  const curTeam = teamOf(current);
  const prevTeam = teamOf(previous);

  // Per-employee rows, including "Unassigned" when applicable.
  const rows = useMemo(() => {
    const list: { id: string | null; name: string; role?: string; isYou: boolean }[] = members.map(
      (m: LenderMember) => ({ id: m.id, name: m.name, role: m.role, isYou: active?.id === m.id }),
    );
    if (current.some((l) => !l.assignedToId)) {
      list.push({ id: null, name: "Unassigned", isYou: false });
    }
    return list.map((r) => ({ ...r, stats: memberStats(current, r.id) }));
  }, [members, current, active]);

  const withResponses = rows.filter((r) => typeof r.stats.avgResponse === "number");
  const companyAvg = avgResponseHours(current);
  const companyBest =
    withResponses.length === 0
      ? undefined
      : Math.min(...withResponses.map((r) => r.stats.avgResponse!));

  const youRow = rows.find((r) => r.isYou);

  // Extra metric: acceptance rate of priced offers issued in the period.
  const priced = current.filter((l) => l.status === "qualified" && l.terms);
  const decidedByClient = priced.filter((l) => l.clientDecision);
  const acceptanceRate =
    decidedByClient.length === 0
      ? undefined
      : (decidedByClient.filter((l) => l.clientDecision === "accepted").length /
          decidedByClient.length) *
        100;
  const prevPriced = previous.filter((l) => l.status === "qualified" && l.terms);
  const prevDecidedByClient = prevPriced.filter((l) => l.clientDecision);
  const prevAcceptanceRate =
    prevDecidedByClient.length === 0
      ? undefined
      : (prevDecidedByClient.filter((l) => l.clientDecision === "accepted").length /
          prevDecidedByClient.length) *
        100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-[30px]">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Team and per-employee performance across your Loqal pipeline.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                period === p.id
                  ? "bg-brand text-background"
                  : "border border-border text-muted-foreground hover:bg-brand-tint"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />
          Compare vs previous period
        </label>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total inquiries"
          value={String(curTeam.total)}
          note={compare ? `vs ${prevTeam.total} prior${deltaText(curTeam.total, prevTeam.total)}` : "Submitted in period"}
          tone="brand"
        />
        <StatCard
          label="Qualified"
          value={String(curTeam.qualified)}
          note={compare ? `vs ${prevTeam.qualified} prior` : "Approved with a decision"}
          tone="success"
        />
        <StatCard
          label="Disqualified"
          value={String(curTeam.notQualified)}
          note={compare ? `vs ${prevTeam.notQualified} prior` : "Not qualified"}
          tone="destructive"
        />
        <StatCard
          label="Cancelled by client"
          value={String(curTeam.cancelled)}
          note={compare ? `vs ${prevTeam.cancelled} prior` : "Declined priced offer"}
          tone="gold"
        />
        <StatCard
          label="Info requested"
          value={String(curTeam.infoReturned)}
          note={compare ? `vs ${prevTeam.infoReturned} prior` : "Returned with additional-info requests"}
        />
        <StatCard
          label="In process"
          value={String(curTeam.inProcess)}
          note={compare ? `vs ${prevTeam.inProcess} prior` : "New or awaiting client info"}
          tone="gold"
        />
        <StatCard
          label="Avg. response time"
          value={curTeam.avgResponse ? `${curTeam.avgResponse.toFixed(1)}h` : "—"}
          note={
            compare && prevTeam.avgResponse
              ? `vs ${prevTeam.avgResponse.toFixed(1)}h prior`
              : "Intake to first response"
          }
        />
        <StatCard
          label="Priced-offer acceptance"
          value={acceptanceRate !== undefined ? `${acceptanceRate.toFixed(0)}%` : "—"}
          note={
            compare && prevAcceptanceRate !== undefined
              ? `vs ${prevAcceptanceRate.toFixed(0)}% prior`
              : "Accepted terms among decided offers"
          }
          tone="success"
        />
      </section>

      {youRow ? (
        <section className="rounded-lg border border-gold/40 bg-gold-tint/30 p-6">
          <h2 className="text-base font-semibold text-foreground">How you compare</h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your avg. response
              </div>
              <div className="mt-1 text-2xl font-bold text-gold">
                {youRow.stats.avgResponse ? `${youRow.stats.avgResponse.toFixed(1)}h` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Company average
              </div>
              <div className="mt-1 text-2xl font-bold text-foreground">
                {companyAvg ? `${companyAvg.toFixed(1)}h` : "—"}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Company best
              </div>
              <div className="mt-1 text-2xl font-bold text-success">
                {companyBest ? `${companyBest.toFixed(1)}h` : "—"}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-base font-semibold text-foreground">Per-employee performance</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Scoped to the selected period · company avg response{" "}
            {companyAvg ? `${companyAvg.toFixed(1)}h` : "—"} · company best{" "}
            {companyBest ? `${companyBest.toFixed(1)}h` : "—"}
          </p>
        </div>
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5">Employee</th>
              <th className="px-4 py-2.5">Inquiries</th>
              <th className="px-4 py-2.5">In process</th>
              <th className="px-4 py-2.5">Info requested</th>
              <th className="px-4 py-2.5">Qualified</th>
              <th className="px-4 py-2.5">Disqualified</th>
              <th className="px-4 py-2.5">Pre-approvals</th>
              <th className="px-4 py-2.5">Avg. response</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id ?? "unassigned"} className={r.isYou ? "bg-gold-tint/30" : undefined}>
                <td className="px-4 py-2.5 font-semibold text-foreground">
                  {r.name}
                  {r.isYou ? <span className="ml-1.5 text-[11px] font-semibold text-gold">You</span> : null}
                </td>
                <td className="px-4 py-2.5 text-foreground">{r.stats.inquiries}</td>
                <td className="px-4 py-2.5 text-foreground">{r.stats.inProcess}</td>
                <td className="px-4 py-2.5 text-foreground">{r.stats.infoRequested}</td>
                <td className="px-4 py-2.5 text-success">{r.stats.qualified}</td>
                <td className="px-4 py-2.5 text-destructive">{r.stats.notQualified}</td>
                <td className="px-4 py-2.5 text-foreground">{r.stats.preApprovals}</td>
                <td className="px-4 py-2.5 text-foreground">
                  {r.stats.avgResponse ? `${r.stats.avgResponse.toFixed(1)}h` : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No team members configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
