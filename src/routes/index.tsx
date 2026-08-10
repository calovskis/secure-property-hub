import { createFileRoute } from "@tanstack/react-router";

import { AppHeader } from "@/components/layout/AppHeader";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Loqal — Concierge Dashboard for Real Estate Investors" },
      {
        name: "description",
        content:
          "Loqal is the white-glove concierge platform where property owners manage properties, services, payments and documents from one dashboard.",
      },
      { property: "og:title", content: "Loqal — Concierge Dashboard for Real Estate Investors" },
      {
        property: "og:description",
        content:
          "Manage properties, services, payments and documents from one white-glove real estate dashboard.",
      },
    ],
  }),
  component: Dashboard,
});

const metrics = [
  { icon: "🏘️", tone: "blue", label: "Total Properties", value: "12", change: "↑ 2 active listings", positive: true },
  { icon: "💰", tone: "green", label: "Monthly Revenue", value: "€24,580", change: "↑ 12% vs last month", positive: true },
  { icon: "📋", tone: "gold", label: "Pending Services", value: "5", change: "3 require attention", positive: false },
  { icon: "👥", tone: "green", label: "Active Tenants", value: "18", change: "↑ 1 new tenant", positive: true },
];

const toneClass: Record<string, string> = {
  blue: "bg-brand-tint text-brand",
  green: "bg-success/10 text-success",
  gold: "bg-gold-tint text-gold",
};

const activeServices = [
  { icon: "🔧", title: "Monthly Maintenance", desc: "Berlin Downtown Apartment", time: "Last updated: Today" },
  { icon: "🧹", title: "Weekly Cleaning", desc: "Office Space Madrid", time: "Last updated: 2 days ago" },
  { icon: "🔐", title: "Security Monitoring", desc: "3 properties under 24/7 monitoring", time: "Active" },
];

const payments = [
  { icon: "💳", title: "Rent - Berlin Downtown", desc: "Tenant: Clara Müller • €1,980", time: "Due: Today", badge: "Due today", tone: "due" },
  { icon: "💸", title: "Service Invoice - Cleaning", desc: "Office Space Madrid • €420", time: "Due: 2 days ago", badge: "Overdue", tone: "overdue" },
  { icon: "🏦", title: "Mortgage Instalment", desc: "Lisbon Townhouse • €1,340", time: "Due in 6 days", badge: "Upcoming", tone: "upcoming" },
];

const badgeTone: Record<string, string> = {
  due: "bg-warning/10 text-warning",
  overdue: "bg-destructive/10 text-destructive",
  upcoming: "bg-brand/10 text-brand",
};

const savedProperties = [
  { title: "Seaside Villa", meta: "Algarve, Portugal • 4 bed" },
  { title: "Boutique Hotel Concept", meta: "Prague, Czech Republic • 28 rooms" },
  { title: "Historic Mansion", meta: "Florence, Italy • Heritage" },
];

const activity = [
  { icon: "📅", title: "New Service Request Received", desc: "Maintenance request for Berlin Downtown Apartment has been received and assigned to contractor", time: "2 hours ago", service: false },
  { icon: "✅", title: "Service Completed", desc: "Cleaning service completed at Madrid Office Space", time: "5 hours ago", service: true },
  { icon: "💵", title: "Payment Received", desc: "Monthly rent payment from 3 tenants has been processed", time: "1 day ago", service: false },
  { icon: "📝", title: "Document Uploaded", desc: "Lease agreement for new tenant has been uploaded to documents", time: "3 days ago", service: false },
];

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <button type="button" className="text-xs font-semibold text-brand hover:underline">
          {action}
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ActivityRow({
  icon,
  title,
  desc,
  time,
  service,
  right,
}: {
  icon: string;
  title: string;
  desc: string;
  time: string;
  service?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 border-b border-border py-4 first:pt-0 last:border-none last:pb-0">
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-md text-lg ${
          service ? "bg-gold-tint" : "bg-brand-tint"
        }`}
        aria-hidden
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
        <div className="mt-1 text-xs text-muted-foreground">{time}</div>
      </div>
      {right}
    </div>
  );
}

function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="Home" />

      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[32px]">
            Welcome back, Alex
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Here's what's happening with your properties today
          </p>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <span aria-hidden className="text-xl">
            🏙️
          </span>
          <input
            type="text"
            aria-label="Search properties"
            placeholder="Search for a property, address, city, or ID…"
            className="min-w-40 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">
            Start typing or <span className="cursor-pointer font-semibold text-brand">open full search</span>
          </span>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md"
            >
              <div className={`mb-3 flex size-10 items-center justify-center rounded-md text-lg ${toneClass[m.tone]}`} aria-hidden>
                {m.icon}
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.label}</div>
              <div className="mt-1 text-3xl font-bold text-foreground">{m.value}</div>
              <div className={`mt-1 text-xs font-medium ${m.positive ? "text-success" : "text-warning"}`}>
                {m.change}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-8 grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4">
          <SectionCard title="Your Recent Properties" action="View all →">
            {[
              { emoji: "🏠", name: "Luxury Apartment - Downtown", loc: "Berlin, Germany", status: "● Active", pending: false },
              { emoji: "🏢", name: "Modern Office Space", loc: "Madrid, Spain", status: "● Pending review", pending: true },
            ].map((p, i) => (
              <div key={p.name} className={i > 0 ? "mt-4 border-t border-border pt-4" : ""}>
                <div className="flex aspect-video items-center justify-center rounded-md bg-gradient-to-br from-brand-tint to-gold-tint text-5xl text-brand">
                  <span aria-hidden>{p.emoji}</span>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-semibold text-foreground">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.loc}</div>
                  <span
                    className={`mt-2 inline-block rounded px-2 py-1 text-[11px] font-semibold ${
                      p.pending ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            ))}
          </SectionCard>

          <SectionCard title="Active Services" action="Manage →">
            {activeServices.map((s) => (
              <ActivityRow key={s.title} icon={s.icon} title={s.title} desc={s.desc} time={s.time} service />
            ))}
          </SectionCard>

          <SectionCard title="Upcoming & Due Payments" action="View financials →">
            {payments.map((p) => (
              <ActivityRow
                key={p.title}
                icon={p.icon}
                title={p.title}
                desc={p.desc}
                time={p.time}
                right={
                  <span
                    className={`h-fit rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${badgeTone[p.tone]}`}
                  >
                    {p.badge}
                  </span>
                }
              />
            ))}
          </SectionCard>

          <SectionCard title="Saved Properties" action="View all →">
            {savedProperties.map((p) => (
              <div
                key={p.title}
                className="flex items-center justify-between border-b border-border py-3 first:pt-0 last:border-none last:pb-0"
              >
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-foreground">{p.title}</span>
                  <span className="text-[11px] text-muted-foreground">{p.meta}</span>
                </div>
                <span className="rounded border border-gold/40 bg-gold-tint px-2 py-1 text-[11px] font-semibold text-gold">
                  ★ Saved
                </span>
              </div>
            ))}
          </SectionCard>
        </div>

        <div className="rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">Recent Activity & Updates</h2>
            <button type="button" className="text-xs font-semibold text-brand hover:underline">
              View all →
            </button>
          </div>
          <div className="p-5">
            {activity.map((a) => (
              <ActivityRow key={a.title} icon={a.icon} title={a.title} desc={a.desc} time={a.time} service={a.service} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
