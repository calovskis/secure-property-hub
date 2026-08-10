import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "LOQAL - Analytics" },
      {
        name: "description",
        content:
          "Advanced insights, performance metrics, and data-driven recommendations for your property portfolio.",
      },
      { property: "og:title", content: "LOQAL - Analytics" },
      {
        property: "og:description",
        content:
          "Advanced insights, performance metrics, and data-driven recommendations for your property portfolio.",
      },
    ],
  }),
});

const metrics = [
  {
    icon: "📈",
    trend: "↑ 12.3%",
    label: "Portfolio Growth",
    value: "+$34,200",
    detail: "vs. previous quarter",
  },
  {
    icon: "📊",
    trend: "↑ 4.8%",
    label: "Avg. Rent per Unit",
    value: "$1,824",
    detail: "Across all properties",
  },
  {
    icon: "⏱️",
    trend: "↑ 15.2%",
    label: "Occupancy Rate",
    value: "96.8%",
    detail: "Above market average",
  },
  {
    icon: "💎",
    trend: "↑ 8.7%",
    label: "Tenant Satisfaction",
    value: "4.7/5.0",
    detail: "Based on 142 reviews",
  },
];

const revenueMonthly = [
  { label: "Jan", value: 162000 },
  { label: "Feb", value: 168000 },
  { label: "Mar", value: 171000 },
  { label: "Apr", value: 175000 },
  { label: "May", value: 182000 },
  { label: "Jun", value: 186000 },
  { label: "Jul", value: 191000 },
  { label: "Aug", value: 195000 },
  { label: "Sep", value: 198000 },
  { label: "Oct", value: 202000 },
  { label: "Nov", value: 206000 },
  { label: "Dec", value: 210000 },
];

const occupancyData = [
  { label: "Downtown Plaza", value: 95.2, color: "bg-brand" },
  { label: "Commerce Plaza", value: 100, color: "bg-success" },
  { label: "Riverside Apts", value: 96.4, color: "bg-brand" },
  { label: "Maple Tower", value: 95.0, color: "bg-brand-soft" },
  { label: "Cedar House", value: 100, color: "bg-success" },
  { label: "Oak Street", value: 86.7, color: "bg-warning" },
];

const performanceRows = [
  {
    name: "Downtown Plaza",
    occupancy: "95.2%",
    revenue: "$59,400",
    expenses: "$28,650",
    net: "$30,750",
    badge: "Excellent",
    badgeClass: "bg-success/15 text-success",
  },
  {
    name: "Commerce Plaza",
    occupancy: "100%",
    revenue: "$28,800",
    expenses: "$12,100",
    net: "$16,700",
    badge: "Excellent",
    badgeClass: "bg-success/15 text-success",
  },
  {
    name: "Riverside Apartments",
    occupancy: "96.4%",
    revenue: "$32,000",
    expenses: "$14,800",
    net: "$17,200",
    badge: "Excellent",
    badgeClass: "bg-success/15 text-success",
  },
  {
    name: "Maple Tower",
    occupancy: "95.0%",
    revenue: "$26,400",
    expenses: "$12,200",
    net: "$14,200",
    badge: "Good",
    badgeClass: "bg-brand-soft/15 text-brand-soft",
  },
  {
    name: "Cedar House",
    occupancy: "100%",
    revenue: "$21,600",
    expenses: "$8,900",
    net: "$12,700",
    badge: "Excellent",
    badgeClass: "bg-success/15 text-success",
  },
  {
    name: "Oak Street Complex",
    occupancy: "86.7%",
    revenue: "$18,600",
    expenses: "$9,450",
    net: "$9,150",
    badge: "Fair",
    badgeClass: "bg-warning/15 text-warning",
  },
];

const insights = [
  {
    icon: "🎯",
    title: "Optimize Oak Street Complex",
    text: "Occupancy at Oak Street is 10% below portfolio average. Consider targeted marketing or minor renovations to attract tenants.",
    action: "View Action Plan →",
  },
  {
    icon: "💰",
    title: "Rent Adjustment Opportunity",
    text: "Market analysis suggests you can increase rent by 3-5% at Riverside Apartments without impacting occupancy rates.",
    action: "See Market Data →",
  },
  {
    icon: "⚡",
    title: "Reduce Operating Costs",
    text: "Switching to LED lighting and smart thermostats across properties could save $4,200 annually in utility expenses.",
    action: "Calculate Savings →",
  },
  {
    icon: "📅",
    title: "Lease Renewal Timing",
    text: "18 leases expiring in Q2. Start renewal outreach 90 days early to minimize vacancy risk and reduce turnover costs.",
    action: "View Timeline →",
  },
  {
    icon: "⭐",
    title: "Tenant Satisfaction Alert",
    text: "Recent survey shows maintenance response time concerns at Downtown Plaza. Improving this could boost retention by 12%.",
    action: "Read Survey Results →",
  },
  {
    icon: "📊",
    title: "Portfolio Diversification",
    text: "Your commercial properties outperform residential by 8% ROI. Consider expanding commercial holdings for balanced growth.",
    action: "View Portfolio Mix →",
  },
];

function AnalyticsPage() {
  const [timePeriod, setTimePeriod] = useState("90days");
  const [property, setProperty] = useState("all");
  const [compare, setCompare] = useState("none");
  const [revenueView, setRevenueView] = useState("monthly");
  const [occupancyView, setOccupancyView] = useState("trend");

  const maxRevenue = Math.max(...revenueMonthly.map((r) => r.value));

  const handleAlert = (msg: string) => () => alert(msg);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="My Portfolio" />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        {/* PAGE HEADER */}
        <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div className="flex-1">
            <h1 className="mb-2 text-2xl font-bold text-foreground md:text-[32px]">
              Analytics
            </h1>
            <p className="text-sm text-muted-foreground">
              Advanced insights, performance metrics, and data-driven
              recommendations for your property portfolio
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleAlert(
                "Exporting comprehensive analytics report...\n\nPDF with detailed insights and visualizations will be generated."
              )}
              className="rounded-md bg-brand px-5 py-2.5 text-[13px] font-semibold text-card transition-colors hover:bg-brand-soft"
            >
              <span aria-hidden="true">📊</span> Export Analytics
            </button>
            <button
              onClick={handleAlert(
                "Opening report scheduler...\n\nSet up automated analytics reports sent to your email."
              )}
              className="rounded-md border border-border bg-brand-tint px-5 py-2.5 text-[13px] font-semibold text-brand transition-colors hover:bg-brand/15"
            >
              <span aria-hidden="true">📅</span> Schedule Report
            </button>
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="mb-8 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4 md:px-6">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Time Period
            </label>
            <select
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
              className="min-w-[150px] rounded-md border border-border px-3 py-2 text-[13px] text-foreground"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="12months">Last 12 Months</option>
              <option value="ytd">Year to Date</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Property
            </label>
            <select
              value={property}
              onChange={(e) => setProperty(e.target.value)}
              className="min-w-[150px] rounded-md border border-border px-3 py-2 text-[13px] text-foreground"
            >
              <option value="all">All Properties</option>
              <option value="downtown">Downtown Plaza</option>
              <option value="riverside">Riverside Apartments</option>
              <option value="maple">Maple Tower</option>
              <option value="commerce">Commerce Plaza</option>
              <option value="oak">Oak Street Complex</option>
              <option value="cedar">Cedar House</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Compare To
            </label>
            <select
              value={compare}
              onChange={(e) => setCompare(e.target.value)}
              className="min-w-[150px] rounded-md border border-border px-3 py-2 text-[13px] text-foreground"
            >
              <option value="none">No Comparison</option>
              <option value="previous">Previous Period</option>
              <option value="lastyear">Same Period Last Year</option>
              <option value="average">Portfolio Average</option>
            </select>
          </div>
        </div>

        {/* KEY METRICS */}
        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-6 transition-all hover:border-brand-soft hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="text-[28px]" aria-hidden="true">
                  {m.icon}
                </div>
                <div className="rounded bg-success/10 px-2 py-1 text-xs font-semibold text-success">
                  {m.trend}
                </div>
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {m.label}
              </div>
              <div className="text-[28px] font-bold text-brand">{m.value}</div>
              <div className="text-xs text-muted-foreground">{m.detail}</div>
            </div>
          ))}
        </div>

        {/* REVENUE CHART */}
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-lg font-bold text-foreground">
              <span aria-hidden="true">📈</span> Revenue Trends
            </div>
            <div className="flex gap-2">
              {["monthly", "quarterly", "yearly"].map((v) => (
                <button
                  key={v}
                  onClick={() => setRevenueView(v)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    revenueView === v
                      ? "border-brand bg-brand text-card"
                      : "border-border bg-background text-muted-foreground hover:bg-brand-tint hover:text-brand"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-[300px] items-end gap-2">
            {revenueMonthly.map((r) => (
              <div
                key={r.label}
                className="flex flex-1 flex-col items-center justify-end gap-2"
              >
                <div className="text-[11px] text-muted-foreground">
                  ${Math.round(r.value / 1000)}k
                </div>
                <div
                  className="w-full rounded-t-md bg-brand"
                  style={{ height: `${(r.value / maxRevenue) * 100}%` }}
                />
                <div className="text-xs text-muted-foreground">{r.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* OCCUPANCY CHART */}
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="text-lg font-bold text-foreground">
              <span aria-hidden="true">🏘️</span> Occupancy &amp; Turnover
              Analysis
            </div>
            <div className="flex gap-2">
              {["trend", "comparison"].map((v) => (
                <button
                  key={v}
                  onClick={() => setOccupancyView(v)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                    occupancyView === v
                      ? "border-brand bg-brand text-card"
                      : "border-border bg-background text-muted-foreground hover:bg-brand-tint hover:text-brand"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <div className="flex h-[300px] items-end gap-3">
            {occupancyData.map((o) => (
              <div
                key={o.label}
                className="flex flex-1 flex-col items-center justify-end gap-2"
              >
                <div className="text-[11px] text-muted-foreground">
                  {o.value.toFixed(1)}%
                </div>
                <div
                  className={`w-full rounded-t-md ${o.color}`}
                  style={{ height: `${o.value}%` }}
                />
                <div className="text-center text-[11px] text-muted-foreground">
                  {o.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* PROPERTY PERFORMANCE TABLE */}
        <div className="mb-8 rounded-lg border border-border bg-card p-6">
          <div className="mb-5 text-lg font-bold text-foreground">
            Property Performance Comparison
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 rounded-md bg-brand-tint px-6 py-4 text-[13px] font-bold uppercase tracking-wide text-brand">
                <div>Property</div>
                <div>Occupancy</div>
                <div>Revenue</div>
                <div>Expenses</div>
                <div>Net Income</div>
                <div>Rating</div>
              </div>
              {performanceRows.map((row) => (
                <div
                  key={row.name}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center gap-4 border-b border-border px-6 py-4 last:border-b-0 hover:bg-background"
                >
                  <div className="text-sm font-semibold text-foreground">
                    {row.name}
                  </div>
                  <div className="text-right text-[13px] text-foreground">
                    {row.occupancy}
                  </div>
                  <div className="text-right text-[13px] text-foreground">
                    {row.revenue}
                  </div>
                  <div className="text-right text-[13px] text-foreground">
                    {row.expenses}
                  </div>
                  <div className="text-right text-[13px] text-foreground">
                    {row.net}
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold ${row.badgeClass}`}
                    >
                      {row.badge}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* INSIGHTS & RECOMMENDATIONS */}
        <div className="mb-5 text-lg font-bold text-foreground">
          AI-Powered Insights &amp; Recommendations
        </div>
        <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {insights.map((insight) => (
            <div
              key={insight.title}
              className="flex gap-4 rounded-lg border border-border bg-card p-5 transition-all hover:border-brand-soft hover:shadow-md"
            >
              <div className="flex-shrink-0 text-[32px]" aria-hidden="true">
                {insight.icon}
              </div>
              <div className="flex-1">
                <div className="mb-2 text-sm font-bold text-foreground">
                  {insight.title}
                </div>
                <div className="text-[13px] leading-relaxed text-muted-foreground">
                  {insight.text}
                </div>
                <div
                  onClick={handleAlert(
                    `Opening detailed view for insight: ${insight.title}\n\nShowing actionable recommendations and data analysis.`
                  )}
                  className="mt-2 inline-block cursor-pointer text-xs font-semibold text-brand hover:text-brand-soft hover:underline"
                >
                  {insight.action}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
