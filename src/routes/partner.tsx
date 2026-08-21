import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { LenderPortal, useLenderTabs, type LenderTabId } from "@/components/lender/LenderPortal";

import { PARTNER_LABEL, fullName, useAuth, type PartnerType } from "@/lib/auth";

export const Route = createFileRoute("/partner")({
  component: PartnerPage,
  head: () => ({
    meta: [
      { title: "Partner Workspace — Loqal" },
      {
        name: "description",
        content:
          "Realtors, mortgage lenders, cleaning crews and service providers manage their Loqal pipeline, jobs and payouts here.",
      },
      { property: "og:title", content: "Partner Workspace — Loqal" },
      {
        property: "og:description",
        content: "Manage your Loqal pipeline, assigned jobs, documents and payouts.",
      },
    ],
  }),
});

type Board = {
  headline: string;
  intro: string;
  metrics: [string, string, string][];
  queue: { title: string; meta: string; badge: string }[];
  actions: string[];
};

const BOARDS: Record<PartnerType, Board> = {
  realtor: {
    headline: "Listings & buyer pipeline",
    intro: "Publish inventory to the Loqal marketplace and track buyer-side interest.",
    metrics: [
      ["Active listings", "14", "3 featured this week"],
      ["Buyer enquiries", "37", "↑ 12% vs last month"],
      ["Deals in closing", "5", "2 awaiting inspection"],
    ],
    queue: [
      {
        title: "255 Park Avenue — showing request",
        meta: "Client: A. Novak · Remote buyer",
        badge: "New",
      },
      {
        title: "1825 Oak Street — offer submitted",
        meta: "Awaiting seller response",
        badge: "In process",
      },
      {
        title: "450 Residential Lane — listing draft",
        meta: "Photos pending upload",
        badge: "Draft",
      },
    ],
    actions: ["Add listing", "Upload photos", "Log a showing", "Request valuation"],
  },
  lender: {
    headline: "Mortgage requests",
    intro: "Review pre-qualification packages submitted by Loqal clients and issue terms.",
    metrics: [
      ["Open requests", "9", "4 awaiting documents"],
      ["Avg. response time", "11h", "Target: under 24h"],
      ["Approved volume", "$12.4M", "Year to date"],
    ],
    queue: [
      { title: "Pre-qual — 255 Park Avenue", meta: "Foreign national · 20% down", badge: "Review" },
      { title: "Pre-qual — 2001 Ocean Drive", meta: "US person · SSN provided", badge: "Ready" },
      {
        title: "Term sheet — 3030 Valley Road",
        meta: "Multi-family · DSCR product",
        badge: "Sent",
      },
    ],
    actions: ["Open request queue", "Issue term sheet", "Request documents", "Rate sheet"],
  },
  cleaning: {
    headline: "Cleaning schedule",
    intro: "Turnovers, recurring cleans and quality checks across assigned properties.",
    metrics: [
      ["Jobs this week", "23", "6 same-day turnovers"],
      ["On-time rate", "97%", "↑ 2pts"],
      ["Open issues", "2", "Photos requested"],
    ],
    queue: [
      { title: "450 Bay Street — turnover clean", meta: "Today 14:00 · 2h slot", badge: "Today" },
      { title: "2001 Ocean Drive — deep clean", meta: "Tomorrow 09:00", badge: "Scheduled" },
      {
        title: "1 Central Park South — inspection photos",
        meta: "Owner requested proof",
        badge: "Action",
      },
    ],
    actions: ["Accept job", "Upload completion photos", "Report an issue", "Update availability"],
  },
  other: {
    headline: "Service jobs",
    intro: "Maintenance, inspections, legal, utilities and everything else routed through Loqal.",
    metrics: [
      ["Assigned jobs", "16", "3 urgent"],
      ["Completed (30d)", "48", "↑ 9 vs prior"],
      ["Pending payouts", "$8,240", "Next run: Friday"],
    ],
    queue: [
      {
        title: "5000 Industrial Way — HVAC inspection",
        meta: "Scheduled Thursday",
        badge: "Scheduled",
      },
      { title: "Lot 45 Green Hills — survey", meta: "Documents requested", badge: "Action" },
      {
        title: "500 5th Avenue — utility transfer",
        meta: "Awaiting owner signature",
        badge: "Blocked",
      },
    ],
    actions: ["Accept job", "Submit report", "Raise invoice", "Update availability"],
  },
};

function PartnerPage() {
  const { user, ready } = useAuth();

  if (!ready) return <div className="min-h-screen bg-background" />;

  if (!user || user.role !== "partner") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="Home" />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-foreground">Partner access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in with a partner profile to reach this workspace.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background"
          >
            Go to sign in
          </Link>
        </main>
      </div>
    );
  }

  const type = user.partnerType ?? "other";

  if (type === "lender") {
    return <LenderWorkspace lenderName={user.companyName || fullName(user)} />;
  }

  const board = BOARDS[type];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        navSlot={<span className="text-sm font-semibold text-brand">Partner workspace</span>}
      />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-8">
          <span className="rounded-full bg-gold-tint px-3 py-1 text-xs font-semibold text-gold">
            {PARTNER_LABEL[type]}
          </span>
          <h1 className="mt-3 text-2xl font-bold text-foreground md:text-[32px]">
            {board.headline}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {fullName(user)} · {board.intro}
          </p>
        </div>

        <section className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {board.metrics.map(([label, value, note]) => (
            <div key={label} className="rounded-lg border border-border bg-card p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="mt-2 text-3xl font-bold text-brand">{value}</div>
              <div className="mt-2 text-xs text-muted-foreground">{note}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Work queue</h2>
            <div className="mt-4 divide-y divide-border">
              {board.queue.map((q) => (
                <div key={q.title} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{q.title}</div>
                    <div className="text-xs text-muted-foreground">{q.meta}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
                    {q.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
            <div className="mt-4 grid gap-2">
              {board.actions.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="rounded-md border border-border bg-brand-tint/40 px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-brand-tint"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function LenderWorkspace({ lenderName }: { lenderName: string }) {
  const [tab, setTab] = useState<LenderTabId>("home");
  const tabs = useLenderTabs();
  const current = tabs.some((t) => t.id === tab) ? tab : "home";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        navSlot={
          <>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  current === t.id
                    ? "bg-brand-tint text-brand"
                    : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
                }`}
              >
                <span aria-hidden>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </>
        }
      />
      <LenderPortal lenderName={lenderName} tab={current} onTabChange={setTab} />
    </div>
  );
}
