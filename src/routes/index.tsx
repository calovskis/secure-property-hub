import { createFileRoute, Link } from "@tanstack/react-router";

import { AppHeader, LanguageMenu } from "@/components/layout/AppHeader";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { offerReminders, pendingOfferDecision, useLeads } from "@/lib/leads";
import { formatDateTime } from "@/lib/dates";

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
  const t = useT();
  return (
    <div className="rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{t(title)}</h2>
        <button type="button" className="text-xs font-semibold text-brand hover:underline">
          {t(action)}
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
  const t = useT();
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
        <div className="text-sm font-semibold text-foreground">{t(title)}</div>
        <div className="text-xs text-muted-foreground">{t(desc)}</div>
        <div className="mt-1 text-xs text-muted-foreground">{t(time)}</div>
      </div>
      {right}
    </div>
  );
}

function LandingHeader() {
  const t = useT();
  const links: { label: string; href: string }[] = [
    { label: "How it works", href: "#how-it-works" },
    { label: "About Us", href: "#about" },
    { label: "FAQ", href: "#faq" },
    { label: "Contact", href: "#contact" },
  ];
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <div className="mx-auto flex h-[72px] max-w-[1100px] items-center justify-between gap-3 px-4 md:px-7">
        <a href="#top" className="flex shrink-0 items-center gap-1.5">
          <span className="flex size-7 items-center justify-center rounded-md bg-gradient-to-br from-gold to-gold/70 text-[13px] font-bold text-primary-foreground">
            LQ
          </span>
          <span className="bg-gradient-to-br from-brand to-brand-soft bg-clip-text text-[22px] font-bold tracking-tight text-transparent md:text-[28px]">
            LOQAL
          </span>
        </a>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-brand-tint hover:text-brand"
            >
              {t(l.label)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageMenu />
          <Link
            to="/auth"
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-brand-soft"
          >
            {t("Log in")}
          </Link>
        </div>
      </div>
    </header>
  );
}

const howItWorksSteps = [
  {
    icon: "📝",
    title: "Create your profile",
    text: "Sign up in a minute and tell us about your goals — vacation home, investment property or a whole portfolio.",
  },
  {
    icon: "🏦",
    title: "Get pre-approved",
    text: "Complete the guided mortgage questionnaire once. Our lending partners review your file and return estimated terms.",
  },
  {
    icon: "🤝",
    title: "Work with your team",
    text: "A dedicated realtor partner — or a Loqal personal advocate — handles viewings, photos, inspections and negotiations for you.",
  },
  {
    icon: "🔑",
    title: "Close & relax",
    text: "Sign the Purchase Agreement and let Loqal run management, cleaning, utilities and reporting from one dashboard.",
  },
];

const landingFaq = [
  {
    q: "Who is Loqal for?",
    a: "Real estate investors and property owners — US-based or international — who want every service around their property handled from a single place.",
  },
  {
    q: "Do I need to be a US citizen to buy through Loqal?",
    a: "No. Our mortgage questionnaire and lending partners support non-US persons, including ITIN holders and buyers on valid visas. Income in foreign currencies is converted automatically.",
  },
  {
    q: "What does a buyer's agent do for me?",
    a: "Your realtor partner represents your interests only: visiting the property, delivering fresh photos, advising on inspections, and negotiating the price down before you sign the Purchase Agreement.",
  },
  {
    q: "What is a Loqal personal advocate?",
    a: "For an extra 1% at closing, a Loqal personal advocate manages the purchase as if it were their own investment — recommending inspections, negotiations and next steps at every stage.",
  },
  {
    q: "How do partners join the platform?",
    a: "Realtors, mortgage lenders and service providers request access, sign the partner agreement and complete KYB verification. Our team approves every partner before they can work with clients.",
  },
];

function Landing() {
  const t = useT();
  return (
    <div id="top" className="min-h-screen bg-background">
      <LandingHeader />
      <main className="mx-auto max-w-[1100px] px-4 py-16 md:px-7">
        <section className="rounded-2xl border border-border bg-gradient-to-br from-brand-tint via-card to-gold-tint p-8 md:p-14">
          <span className="rounded-full bg-card px-3 py-1 text-xs font-semibold text-brand">
            {t("White-glove concierge for real estate")}
          </span>
          <h1 className="mt-5 max-w-2xl text-3xl font-bold leading-tight text-foreground md:text-5xl">
            {t("Own property anywhere. Run everything from one place.")}
          </h1>
          <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
            {t("Loqal connects entity formation, banking, mortgage, inspections, management, legal and utilities into a single operating layer for investors and owners.")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-brand px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-brand-soft"
            >
              {t("Become a Loqal")}
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-brand-tint"
            >
              {t("Log in")}
            </Link>
            <Link
              to="/marketplace"
              className="rounded-md border border-gold/30 bg-gold-tint px-6 py-3 text-sm font-semibold text-gold"
            >
              {t("Browse properties")}
            </Link>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="text-sm font-semibold text-foreground">{t("Client access")}</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("Individual owners and investors managing a portfolio remotely. Create your profile in a minute and start onboarding properties and services.")}
            </p>
            <Link
              to="/auth"
              className="mt-4 inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-brand-soft"
            >
              {t("Become a Loqal")}
            </Link>
          </div>
          <div className="rounded-lg border border-gold/30 bg-gold-tint/40 p-6">
            <div className="text-sm font-semibold text-foreground">
              {t("Partner & corporate access")}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("Realtors, mortgage lenders, cleaning crews, other service providers and company-held portfolios are onboarded by our team. Send us your company details and we will set up your workspace.")}
            </p>
            <Link
              to="/partner-access"
              className="mt-4 inline-flex rounded-md border border-gold/40 bg-card px-5 py-2.5 text-sm font-semibold text-gold transition-colors hover:bg-gold-tint"
            >
              {t("Request access")}
            </Link>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            ["Entity & banking", "LLC formation, EIN, US bank accounts and compliance handled end to end."],
            ["Acquisition & mortgage", "Marketplace listings, inspections, valuations and lender introductions."],
            ["Operations", "Property management, cleaning, maintenance, utilities, legal and reporting."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-lg border border-border bg-card p-6">
              <div className="text-sm font-semibold text-foreground">{t(title!)}</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t(text!)}</p>
            </div>
          ))}
        </section>

        <section id="how-it-works" className="mt-16 scroll-mt-24">
          <div className="text-center">
            <span className="rounded-full bg-gold-tint px-3 py-1 text-xs font-semibold text-gold">
              {t("Show demo")}
            </span>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              {t("How Loqal works")}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              {t("From first sign-up to keys in hand — one guided flow, one dashboard, one team behind you.")}
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorksSteps.map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-lg border border-border bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
              >
                <span className="absolute right-4 top-4 text-xs font-bold text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex size-10 items-center justify-center rounded-md bg-brand-tint text-lg" aria-hidden>
                  {s.icon}
                </div>
                <div className="mt-4 text-sm font-semibold text-foreground">{t(s.title)}</div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t(s.text)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link
              to="/auth"
              className="inline-flex rounded-md bg-brand px-6 py-3 text-sm font-semibold text-background transition-colors hover:bg-brand-soft"
            >
              {t("Try it — create your profile")}
            </Link>
          </div>
        </section>

        <section id="about" className="mt-16 scroll-mt-24 rounded-2xl border border-border bg-gradient-to-br from-brand-tint via-card to-gold-tint p-8 md:p-12">
          <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{t("About Us")}</h2>
          <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("Loqal is a white-glove concierge platform for real estate investors and property owners. We bring every major service around a property — entity formation, banking, mortgage, inspections, management, legal and utilities — into a single operating layer, so owning property anywhere feels local.")}
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {t("Our vetted partner network of realtors, mortgage lenders and service providers works inside the same workspace as our clients. Every step — from pre-approval to the Purchase Agreement and beyond — is tracked, transparent and handled by people who treat your property like their own.")}
            </p>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ["🌍", "Worldwide owners"],
              ["🏘️", "All-in-one services"],
              ["🔐", "Secure by design"],
              ["🤝", "Vetted partners"],
            ].map(([icon, label]) => (
              <div key={label} className="rounded-lg border border-border bg-card p-4 text-center">
                <div className="text-2xl" aria-hidden>{icon}</div>
                <div className="mt-2 text-xs font-semibold text-foreground">{t(label!)}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="mt-16 scroll-mt-24">
          <h2 className="text-center text-2xl font-bold tracking-tight text-foreground md:text-3xl">
            {t("Frequently asked questions")}
          </h2>
          <div className="mt-8 space-y-3">
            {landingFaq.map((f) => (
              <details
                key={f.q}
                className="group rounded-lg border border-border bg-card px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
                  {t(f.q)}
                  <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180" aria-hidden>
                    ▼
                  </span>
                </summary>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t(f.a)}</p>
              </details>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link to="/faq" className="text-sm font-semibold text-brand hover:underline">
              {t("Open the full FAQ →")}
            </Link>
          </div>
        </section>

        <section id="contact" className="mt-16 scroll-mt-24 rounded-2xl border border-border bg-card p-8 shadow-[0_1px_3px_rgba(0,0,0,0.05)] md:p-12">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{t("Contact us")}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("Questions about onboarding, partnerships or your portfolio? Our team replies within one business day — or use the in-platform support chat once you're logged in.")}
              </p>
            </div>
            <div className="space-y-3">
              <a
                href="mailto:hello@loqal.com"
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-brand-tint hover:text-brand"
              >
                <span aria-hidden>✉️</span> hello@loqal.com
              </a>
              <Link
                to="/partner-access"
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-brand-tint hover:text-brand"
              >
                <span aria-hidden>🤝</span> {t("Become a partner")}
              </Link>
              <Link
                to="/auth"
                className="flex items-center gap-3 rounded-lg border border-gold/40 bg-gold-tint px-4 py-3 text-sm font-semibold text-gold transition-colors hover:bg-gold-tint/70"
              >
                <span aria-hidden>✨</span> {t("Become a Loqal")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="mt-16 border-t border-border bg-card">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground md:flex-row md:px-7">
          <span>© {new Date().getFullYear()} Loqal — {t("White-glove concierge for real estate")}</span>
          <div className="flex items-center gap-4">
            <a href="#about" className="hover:text-brand">{t("About Us")}</a>
            <a href="#faq" className="hover:text-brand">{t("FAQ")}</a>
            <a href="#contact" className="hover:text-brand">{t("Contact")}</a>
            <Link to="/auth" className="font-semibold text-brand hover:underline">{t("Log in")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Dashboard() {
  const { user, ready } = useAuth();
  const { leadsForClient } = useLeads();
  const t = useT();

  if (!ready) return <div className="min-h-screen bg-background" />;
  if (!user) return <Landing />;

  const pendingOffers = leadsForClient(user.email).filter(pendingOfferDecision);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="Home" />

      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[32px]">
            {t("Welcome back")}, {user.firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("Here's what's happening with your properties today")}
          </p>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <span aria-hidden className="text-xl">
            🏙️
          </span>
          <input
            type="text"
            aria-label={t("Search properties")}
            placeholder={t("Search for a property, address, city, or ID…")}
            className="min-w-40 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <span className="text-xs text-muted-foreground">
            {t("Start typing or")} <span className="cursor-pointer font-semibold text-brand">{t("open full search")}</span>
          </span>
        </div>

        {pendingOffers.length ? (
          <div className="mb-8 rounded-xl border border-gold/40 bg-gold-tint/50 p-5">
            <div className="text-sm font-semibold text-foreground">
              ⏳ Action needed — your pre-approval terms are waiting for your answer
            </div>
            <div className="mt-3 space-y-2">
              {pendingOffers.map((l) => {
                const next = offerReminders(l).find((r) => !r.due);
                return (
                  <div
                    key={l.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">{l.propertyLabel}</div>
                      <div className="text-xs text-muted-foreground">
                        {l.terms!.ratePct}% · {l.terms!.termYears}y · {l.terms!.downPaymentPct}% down
                        {next
                          ? ` · next reminder ${formatDateTime(next.dueAt)}${next.email ? " (platform + e-mail)" : ""}`
                          : ""}
                      </div>
                    </div>
                    <Link
                      to="/property/$propertyId"
                      params={{ propertyId: String(l.propertyId) }}
                      className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft"
                    >
                      Review &amp; respond
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mb-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md"
            >
              <div className={`mb-3 flex size-10 items-center justify-center rounded-md text-lg ${toneClass[m.tone]}`} aria-hidden>
                {m.icon}
              </div>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(m.label)}</div>
              <div className="mt-1 text-3xl font-bold text-foreground">{m.value}</div>
              <div className={`mt-1 text-xs font-medium ${m.positive ? "text-success" : "text-warning"}`}>
                {t(m.change)}
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
                  <div className="text-sm font-semibold text-foreground">{t(p.name)}</div>
                  <div className="text-xs text-muted-foreground">{t(p.loc)}</div>
                  <span
                    className={`mt-2 inline-block rounded px-2 py-1 text-[11px] font-semibold ${
                      p.pending ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    }`}
                  >
                    {t(p.status)}
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
                    {t(p.badge)}
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
                  <span className="text-[13px] font-medium text-foreground">{t(p.title)}</span>
                  <span className="text-[11px] text-muted-foreground">{p.meta}</span>
                </div>
                <span className="rounded border border-gold/40 bg-gold-tint px-2 py-1 text-[11px] font-semibold text-gold">
                  {t("★ Saved")}
                </span>
              </div>
            ))}
          </SectionCard>
        </div>

        <div className="rounded-lg border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">{t("Recent Activity & Updates")}</h2>
            <button type="button" className="text-xs font-semibold text-brand hover:underline">
              {t("View all →")}
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
