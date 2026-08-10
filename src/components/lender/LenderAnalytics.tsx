import { useLenderStats, StatCard } from "@/components/lender/LenderHome";
import { LEAD_STATUS_LABEL, type LeadStatus } from "@/lib/leads";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const ORDER: LeadStatus[] = ["new", "info_required", "qualified", "not_qualified"];

export function LenderAnalytics() {
  const s = useLenderStats();
  const counts = ORDER.map((status) => ({
    status,
    count: s.leads.filter((l) => l.status === status).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));

  const priced = s.priced;
  const avgRate =
    priced.length === 0
      ? 0
      : priced.reduce((sum, l) => sum + (l.terms?.ratePct ?? 0), 0) / priced.length;
  const avgDown =
    priced.length === 0
      ? 0
      : priced.reduce((sum, l) => sum + (l.terms?.downPaymentPct ?? 0), 0) / priced.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-[30px]">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Conversion, pricing and service-level performance across your Loqal pipeline.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Approved volume"
          value={money(s.approvedVolume)}
          note="Loan amount on priced offers"
          tone="success"
        />
        <StatCard
          label="Avg. soft credit score"
          value={s.avgScore ? s.avgScore.toFixed(0) : "—"}
          note="Across scored applicants"
        />
        <StatCard
          label="Avg. quoted rate"
          value={avgRate ? `${avgRate.toFixed(2)}%` : "—"}
          note={avgDown ? `Avg. down payment ${avgDown.toFixed(0)}%` : "No pricing issued yet"}
        />
        <StatCard
          label="Avg. turnaround"
          value={s.avgHours ? `${s.avgHours.toFixed(1)}h` : "—"}
          note="Intake to decision"
          tone="gold"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">Pipeline by status</h2>
          <div className="mt-4 space-y-3">
            {counts.map(({ status, count }) => (
              <div key={status}>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{LEAD_STATUS_LABEL[status]}</span>
                  <strong className="text-foreground">{count}</strong>
                </div>
                <div className="mt-1 h-2 rounded-full bg-brand-tint">
                  <div
                    className="h-2 rounded-full bg-brand"
                    style={{ width: `${(count / max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">Funnel</h2>
          <div className="mt-4 divide-y divide-border text-sm">
            {[
              ["Inquiries received", s.total],
              ["Files reviewed", s.total - s.newCount],
              ["Qualified", s.qualified.length],
              ["Priced offers issued", s.priced.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">{label}</span>
                <strong className="text-foreground">{value}</strong>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Approval rate {s.approvalRate ? `${s.approvalRate.toFixed(0)}%` : "—"} · Overdue files{" "}
            {s.overdue.length}
          </p>
        </div>
      </section>
    </div>
  );
}
