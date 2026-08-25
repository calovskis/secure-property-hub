import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";

type TabKey = "overview" | "income" | "expenses" | "cashflow";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "income", label: "Income & Revenue" },
  { key: "expenses", label: "Expenses" },
  { key: "cashflow", label: "Cash Flow" },
];

const revenueTrend = [
  { m: "Jan", v: 16200 },
  { m: "Feb", v: 16800 },
  { m: "Mar", v: 17100 },
  { m: "Apr", v: 17500 },
  { m: "May", v: 18200 },
  { m: "Jun", v: 18600 },
  { m: "Jul", v: 19100 },
  { m: "Aug", v: 19500 },
  { m: "Sep", v: 19800 },
  { m: "Oct", v: 20200 },
  { m: "Nov", v: 20600 },
  { m: "Dec", v: 21000 },
];

const propertyIncome = [
  { name: "Downtown Plaza", detail: "42 units • 95% occupied", amount: "$59,400" },
  { name: "Riverside Apartments", detail: "28 units • 96% occupied", amount: "$32,000" },
  { name: "Maple Tower", detail: "20 units • 95% occupied", amount: "$26,400" },
  { name: "Commerce Plaza", detail: "8 commercial units • 100% occupied", amount: "$28,800" },
  { name: "Oak Street Complex", detail: "15 units • 87% occupied", amount: "$18,600" },
  { name: "Cedar House", detail: "1 unit • 100% occupied", amount: "$21,600" },
];

const additionalRevenue = [
  { name: "Parking Fees", detail: "Monthly parking charges", amount: "$4,200" },
  { name: "Pet Fees", detail: "Pet rent and deposits", amount: "$2,800" },
  { name: "Late Fees", detail: "Rent payment penalties", amount: "$1,200" },
  { name: "Utility Reimbursements", detail: "Tenant billing pass-through", amount: "$5,100" },
];

const expenseRows = [
  { name: "🔧 Maintenance & Repairs", monthly: "$2,150", annual: "$25,800", pct: "12.4%" },
  { name: "💳 Service Subscriptions", monthly: "$2,847", annual: "$34,164", pct: "16.4%" },
  { name: "💡 Utilities & Supplies", monthly: "$1,200", annual: "$14,400", pct: "6.9%" },
  { name: "🛡️ Insurance", monthly: "$950", annual: "$11,400", pct: "5.5%" },
  { name: "🏛️ Property Taxes", monthly: "$1,850", annual: "$22,200", pct: "10.7%" },
  { name: "📱 Software & Systems", monthly: "$450", annual: "$5,400", pct: "2.6%" },
  { name: "👥 Professional Services", monthly: "$650", annual: "$7,800", pct: "3.8%" },
  { name: "📞 Communications", monthly: "$180", annual: "$2,160", pct: "1.0%" },
];

const monthlyCashFlow = [
  { m: "Jan", v: "+$8,120" },
  { m: "Feb", v: "+$8,180" },
  { m: "Mar", v: "+$8,250" },
  { m: "Apr", v: "+$8,320" },
  { m: "May", v: "+$8,400" },
  { m: "Jun", v: "+$8,480" },
  { m: "Jul", v: "+$8,560" },
  { m: "Aug", v: "+$8,620" },
  { m: "Sep", v: "+$8,680" },
  { m: "Oct", v: "+$8,750" },
  { m: "Nov", v: "+$8,820" },
  { m: "Dec", v: "+$8,890" },
];

const quarterlyPerformance = [
  { q: "Q1 2025", v: "+$24,550" },
  { q: "Q2 2025", v: "+$25,200" },
  { q: "Q3 2025", v: "+$25,860" },
  { q: "Q4 2025", v: "+$26,460" },
];

function MetricCard({
  icon,
  trend,
  trendType,
  label,
  value,
  detail,
}: {
  icon: string;
  trend?: string;
  trendType?: "up" | "down";
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-colors hover:border-brand-soft hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="text-[28px]" aria-hidden>
          {icon}
        </div>
        {trend ? (
          <div
            className={`rounded px-2 py-1 text-xs font-semibold ${
              trendType === "down" ? "text-destructive bg-destructive/10" : "text-success bg-success/10"
            }`}
          >
            {trend}
          </div>
        ) : (
          <span />
        )}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-[28px] font-bold text-brand">{value}</div>
      <div className="text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function IncomeItem({ name, detail, amount }: { name: string; detail: string; amount: string }) {
  return (
    <div className="flex flex-col items-start justify-between gap-2 rounded-lg border border-brand/10 bg-brand-tint p-4 sm:flex-row sm:items-center">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-foreground">{name}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <div className="text-xl font-bold text-brand sm:text-right">{amount}</div>
    </div>
  );
}

export const Route = createFileRoute("/financials")({
  component: FinancialsPage,
  head: () => ({
    meta: [
      { title: "LOQAL - My Financials" },
      {
        name: "description",
        content: "Complete financial overview with revenue tracking, expense management, and detailed reporting.",
      },
      { property: "og:title", content: "LOQAL - My Financials" },
      {
        property: "og:description",
        content: "Complete financial overview with revenue tracking, expense management, and detailed reporting.",
      },
    ],
  }),
});

function FinancialsPage() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [property, setProperty] = useState("");
  const [period, setPeriod] = useState("yearly");
  const [category, setCategory] = useState("");

  const maxRevenue = Math.max(...revenueTrend.map((r) => r.v));

  function alertAction(message: string) {
    window.alert(message);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="My Loqal" />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div className="flex-1">
            <h1 className="mb-2 text-2xl font-bold text-foreground md:text-[32px]">My Financials</h1>
            <p className="text-sm text-muted-foreground">
              Complete financial overview with revenue tracking, expense management, and detailed reporting
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                alertAction(
                  "Exporting comprehensive financial report...\n\nPDF with all financials will be generated and downloaded.",
                )
              }
              className="rounded-md bg-brand px-5 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-brand-soft"
            >
              <span aria-hidden>📊</span> Export Report
            </button>
            <button
              type="button"
              onClick={() =>
                alertAction("Opening tax documents...\n\nAccessing 1099 forms, tax summaries, and deduction records.")
              }
              className="rounded-md border border-border bg-brand-tint px-5 py-2.5 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/15"
            >
              <span aria-hidden>📋</span> Tax Docs
            </button>
          </div>
        </div>

        {/* TABS */}
        <div className="mb-8 flex gap-3 overflow-x-auto border-b-2 border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap border-b-[3px] px-5 py-3 text-sm font-semibold transition-colors ${
                tab === t.key
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-brand"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {tab === "overview" ? (
          <div>
            <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon="💰"
                trend="↑ 6.2%"
                trendType="up"
                label="Annual Revenue"
                value="$207,800"
                detail="All properties combined"
              />
              <MetricCard
                icon="📊"
                trend="↑ 3.1%"
                trendType="up"
                label="Monthly Average"
                value="$18,500"
                detail="Last 12 months"
              />
              <MetricCard
                icon="🏦"
                trend="↓ 1.8%"
                trendType="down"
                label="Total Expenses"
                value="$89,200"
                detail="Services, maintenance, utilities"
              />
              <MetricCard
                icon="✓"
                trend="↑ 8.1%"
                trendType="up"
                label="Net Profit"
                value="$118,600"
                detail="After all deductions"
              />
            </div>

            <div className="mb-8 rounded-lg border border-border bg-card p-6">
              <div className="mb-5 text-lg font-bold text-foreground">
                <span aria-hidden>📈</span> Monthly Revenue Trend
              </div>
              <div className="flex h-64 items-end gap-2 sm:gap-3">
                {revenueTrend.map((r) => (
                  <div key={r.m} className="flex flex-1 flex-col items-center gap-2">
                    <div className="w-full text-center text-[11px] font-semibold text-brand">
                      ${(r.v / 1000).toFixed(1)}k
                    </div>
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-brand to-brand-soft"
                      style={{ height: `${(r.v / maxRevenue) * 180}px` }}
                    />
                    <div className="text-[11px] font-medium text-muted-foreground">{r.m}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                icon="📌"
                label="Occupancy Rate"
                value="96.8%"
                detail="High occupancy performance"
              />
              <MetricCard
                icon="🎯"
                label="Profit Margin"
                value="57.1%"
                detail="Industry average: 45-50%"
              />
              <MetricCard
                icon="💳"
                label="Monthly Services"
                value="$2,847"
                detail="6 active service subscriptions"
              />
              <MetricCard icon="⏱️" label="Avg Days to Rent" value="18 days" detail="Fast turnover" />
            </div>
          </div>
        ) : null}

        {/* INCOME & REVENUE */}
        {tab === "income" ? (
          <div>
            <div className="mb-8 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4 md:p-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Property
                </label>
                <select
                  value={property}
                  onChange={(e) => setProperty(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-[13px] text-foreground"
                >
                  <option value="">All Properties</option>
                  <option value="downtown">Downtown Plaza</option>
                  <option value="riverside">Riverside Apartments</option>
                  <option value="oak">Oak Street Complex</option>
                  <option value="cedar">Cedar House</option>
                  <option value="commerce">Commerce Plaza</option>
                  <option value="maple">Maple Tower</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Period
                </label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-[13px] text-foreground"
                >
                  <option value="yearly">Yearly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() =>
                  alertAction("Exporting income report...\n\nDetailed income breakdown by property will be downloaded.")
                }
                className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-brand-soft"
              >
                <span aria-hidden>📥</span> Export Income
              </button>
            </div>

            <div className="mb-8 rounded-lg border border-border bg-card p-6">
              <div className="mb-5 text-lg font-bold text-foreground">Income Breakdown by Property</div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {propertyIncome.map((i) => (
                  <IncomeItem key={i.name} {...i} />
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-5 text-lg font-bold text-foreground">Additional Revenue Sources</div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {additionalRevenue.map((i) => (
                  <IncomeItem key={i.name} {...i} />
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* EXPENSES */}
        {tab === "expenses" ? (
          <div>
            <div className="mb-8 flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4 md:p-6">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="rounded-md border border-border px-3 py-2 text-[13px] text-foreground"
                >
                  <option value="">All Categories</option>
                  <option value="services">Services & Management</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="utilities">Utilities</option>
                  <option value="insurance">Insurance</option>
                  <option value="taxes">Taxes & Fees</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() =>
                  alertAction("Exporting expense report...\n\nCategorized expense summary will be downloaded.")
                }
                className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-brand-soft"
              >
                <span aria-hidden>📥</span> Export Expenses
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="grid grid-cols-3 gap-4 bg-brand-tint px-4 py-4 text-[13px] font-bold uppercase tracking-wide text-brand md:grid-cols-4 md:px-6">
                <div>Expense Category</div>
                <div className="text-right md:text-left">Monthly</div>
                <div className="hidden text-right md:block md:text-left">Annual</div>
                <div className="text-right md:text-left">% of Revenue</div>
              </div>

              {expenseRows.map((row) => (
                <div
                  key={row.name}
                  className="grid grid-cols-3 items-center gap-4 border-b border-border px-4 py-4 transition-colors last:border-b-0 hover:bg-background md:grid-cols-4 md:px-6"
                >
                  <div className="text-sm font-semibold text-foreground">{row.name}</div>
                  <div className="text-right text-[13px] font-semibold text-foreground md:text-left">
                    {row.monthly}
                  </div>
                  <div className="hidden text-right text-[13px] font-semibold text-foreground md:block md:text-left">
                    {row.annual}
                  </div>
                  <div className="text-right text-[13px] text-muted-foreground md:text-left">{row.pct}</div>
                </div>
              ))}

              <div className="grid grid-cols-3 items-center gap-4 px-4 py-4 md:grid-cols-4 md:px-6">
                <div className="text-sm font-semibold text-foreground">📊 Total Monthly Expenses</div>
                <div className="text-right text-[13px] font-bold text-destructive md:text-left">$10,277</div>
                <div className="hidden text-right text-[13px] font-bold text-destructive md:block md:text-left">
                  $123,324
                </div>
                <div className="text-right text-[13px] font-bold text-foreground md:text-left">59.4%</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* CASH FLOW */}
        {tab === "cashflow" ? (
          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-base font-bold text-foreground">Monthly Cash Flow</div>
                <div className="text-lg font-bold text-brand">+$8,223/mo avg</div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {monthlyCashFlow.map((m) => (
                  <div
                    key={m.m}
                    className="cursor-pointer rounded-md border border-brand/10 bg-brand-tint p-3 text-center transition-colors hover:bg-brand/15"
                  >
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {m.m}
                    </div>
                    <div className="text-sm font-bold text-brand">{m.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <div className="mb-5 flex items-center justify-between">
                <div className="text-base font-bold text-foreground">Quarterly Performance</div>
                <div className="text-lg font-bold text-brand">$98,676 total</div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {quarterlyPerformance.map((q) => (
                  <div
                    key={q.q}
                    className="cursor-pointer rounded-md border border-brand/10 bg-brand-tint p-3 text-center transition-colors hover:bg-brand/15"
                  >
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {q.q}
                    </div>
                    <div className="text-sm font-bold text-brand">{q.v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
