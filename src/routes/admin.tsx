import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { PARTNER_LABEL, fullName, useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { useRealtors } from "@/lib/realtors";
import { KICKOFF_LABEL, useLeads } from "@/lib/leads";
import { buyerAgentSummary, useBuyerProcess } from "@/lib/buyer-process";
import { logActivity } from "@/lib/activity";
import { openSupportThread, useSupportInbox } from "@/lib/chat";
import {
  ActivityFeed,
  EmployeeTracking,
  PartnerComparison,
  PartnerMetrics,
} from "@/components/admin/AdminSections";
import { AdminCases } from "@/components/admin/AdminCases";
import { AdminAccounting } from "@/components/admin/AdminAccounting";
import { AdminSupport } from "@/components/admin/AdminSupport";
import { AdminPeople } from "@/components/admin/AdminPeople";
import { AdminSettings } from "@/components/admin/AdminSettings";

type AdminTab =
  | "overview"
  | "cases"
  | "partners"
  | "people"
  | "people_clients"
  | "people_partners"
  | "accounting"
  | "support"
  | "employees"
  | "activity"
  | "settings";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin Console — Loqal" },
      {
        name: "description",
        content:
          "Loqal staff console for accounts, access levels, partner onboarding, mortgage requests and compliance review.",
      },
      { property: "og:title", content: "Admin Console — Loqal" },
      {
        property: "og:description",
        content: "Manage Loqal accounts, access levels, partners and compliance queues.",
      },
    ],
  }),
});

const METRICS: [string, string, string][] = [
  ["Total accounts", "1,284", "↑ 46 this month"],
  ["Pending verifications", "23", "9 flagged for review"],
  ["Active partners", "87", "12 awaiting onboarding"],
  ["Mortgage requests", "31", "6 need a lender assigned"],
];

const ACCOUNTS = [
  ["A. Novak", "Client", "Verified", "US person"],
  ["Harbour Holdings Ltd.", "Corporate", "Pending KYB", "Non-US"],
  ["M. Ferreira", "Partner · Realtor", "Verified", "US person"],
  ["Sunrise Lending", "Partner · Mortgage lender", "Verified", "US person"],
  ["BrightClean Co.", "Partner · Cleaning", "Onboarding", "US person"],
  ["K. Andersson", "Client", "Awaiting mortgage profile", "Non-US"],
];

const QUEUES: [string, string, string][] = [
  ["Mortgage profiles to review", "6", "SSN provided on 4 of 6"],
  ["Partner applications", "12", "Documents pending on 5"],
  ["Corporate KYB", "3", "Beneficial owner checks"],
  ["Support escalations", "8", "2 breaching SLA"],
];

function AdminPage() {
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<AdminTab>("overview");
  const [teamMenu, setTeamMenu] = useState(false);
  const [peopleMenu, setPeopleMenu] = useState(false);
  const [focusThread, setFocusThread] = useState<string | null>(null);
  const { unreadTotal } = useSupportInbox();
  const { requests, setStatus } = usePartnerRequests();
  const { addRealtor } = useRealtors();
  const { leads } = useLeads();
  const proc = useBuyerProcess();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!(e.target as HTMLElement | null)?.closest?.("[data-admin-menu]")) {
        setTeamMenu(false);
        setPeopleMenu(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  if (!ready) return <div className="min-h-screen bg-background" />;

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="Home" />
        <main className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-foreground">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This console is limited to Loqal employees.
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

  const pending = requests.filter((r) => r.status === "pending");
  const buyerFiles = leads.filter((l) => l.clientDecision === "accepted" && l.buyerAgent);

  function approve(r: PartnerRequest) {
    setStatus(r.id, "approved");
    logActivity("Loqal admin", "approved a partner registration", r.companyName);
    if (r.partnerType === "realtor") {
      addRealtor({
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email,
        phone: r.phone,
        address: { street: r.street, city: r.city, state: r.state, zip: r.zip, country: r.country },
        licenses: r.realtorLicenses ?? [],
        languages: r.languages ?? ["English"],
        approvedAt: new Date().toISOString(),
      });
    }
  }

  function messagePerson(p: { email: string; name: string; role: string }) {
    openSupportThread(p.email, p.name, p.role);
    setFocusThread(p.email.toLowerCase());
    setTab("support");
  }

  const itemCls = (active: boolean) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-brand-tint text-brand" : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
    }`;
  const subCls = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-brand-tint hover:text-brand ${
      active ? "font-semibold text-brand" : "text-foreground"
    }`;
  const go = (t: AdminTab) => {
    setTab(t);
    setTeamMenu(false);
    setPeopleMenu(false);
  };

  const peopleActive = tab === "people" || tab === "people_clients" || tab === "people_partners";

  const teamActive = tab === "employees" || tab === "activity" || tab === "settings";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        navSlot={
          <>
            <button type="button" onClick={() => go("overview")} className={itemCls(tab === "overview")}>
              <span aria-hidden>🏠</span> Home
            </button>
            <button type="button" onClick={() => go("cases")} className={itemCls(tab === "cases")}>
              <span aria-hidden>🗂</span> Cases
            </button>
            <button type="button" onClick={() => go("partners")} className={itemCls(tab === "partners")}>
              <span aria-hidden>🤝</span> Partners
            </button>
            <div className="relative" data-admin-menu>
              <button
                type="button"
                onClick={() => setPeopleMenu(!peopleMenu)}
                className={itemCls(peopleActive)}
              >
                <span aria-hidden>👥</span> People
                <span className="text-[9px] opacity-60">▼</span>
              </button>
              {peopleMenu ? (
                <div className="absolute left-0 top-[calc(100%+8px)] w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                  <button type="button" onClick={() => go("people")} className={subCls(tab === "people")}>
                    <span aria-hidden>📇</span> All
                  </button>
                  <button
                    type="button"
                    onClick={() => go("people_clients")}
                    className={subCls(tab === "people_clients")}
                  >
                    <span aria-hidden>🙋</span> Clients
                  </button>
                  <button
                    type="button"
                    onClick={() => go("people_partners")}
                    className={subCls(tab === "people_partners")}
                  >
                    <span aria-hidden>🤝</span> Partners
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => go("accounting")}
              className={itemCls(tab === "accounting")}
            >
              <span aria-hidden>💳</span> Accounting
            </button>
            <button type="button" onClick={() => go("support")} className={itemCls(tab === "support")}>
              <span aria-hidden>💬</span> Support
              {unreadTotal ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-background">
                  {unreadTotal}
                </span>
              ) : null}
            </button>
            <div className="relative hidden lg:block" data-admin-menu>
              <button
                type="button"
                onClick={() => setTeamMenu(!teamMenu)}
                className={itemCls(teamActive)}
              >
                <span aria-hidden>🛠</span> Team
                <span className="text-[9px] opacity-60">▼</span>
              </button>
              {teamMenu ? (
                <div className="absolute left-0 top-[calc(100%+8px)] w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg">
                  <button type="button" onClick={() => go("employees")} className={subCls(tab === "employees")}>
                    <span aria-hidden>🧑‍💼</span> Employees
                  </button>
                  <button type="button" onClick={() => go("activity")} className={subCls(tab === "activity")}>
                    <span aria-hidden>📈</span> Activity log
                  </button>
                  <button type="button" onClick={() => go("settings")} className={subCls(tab === "settings")}>
                    <span aria-hidden>⚙️</span> Platform settings
                  </button>
                </div>
              ) : null}
            </div>
            {/* Mobile fallbacks for the Team items */}
            <button
              type="button"
              onClick={() => go("employees")}
              className={`${itemCls(tab === "employees")} lg:hidden`}
            >
              <span aria-hidden>🧑‍💼</span> Team
            </button>
          </>
        }
      />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-8">
          <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand">
            Staff console
          </span>
          <h1 className="mt-3 text-2xl font-bold text-foreground md:text-[32px]">
            Welcome back, {fullName(user)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cases, partners, people, accounting, support and platform settings in one place.
          </p>
        </div>

        {tab === "cases" ? <AdminCases /> : null}
        {tab === "accounting" ? <AdminAccounting /> : null}
        {tab === "support" ? <AdminSupport focusThread={focusThread} /> : null}
        {tab === "people" ? <AdminPeople scope="all" onMessage={messagePerson} /> : null}
        {tab === "people_clients" ? (
          <AdminPeople scope="clients" onMessage={messagePerson} />
        ) : null}
        {tab === "people_partners" ? (
          <AdminPeople scope="partners" onMessage={messagePerson} />
        ) : null}
        {tab === "employees" ? <EmployeeTracking /> : null}
        {tab === "activity" ? <ActivityFeed /> : null}
        {tab === "settings" ? <AdminSettings /> : null}

        {tab === "partners" ? (
          <div className="space-y-6">
            <section className="rounded-lg border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">
                  Partner registration requests
                </h2>
                <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
                  {pending.length} pending
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Partners only get access to their workspace after you approve them here.
              </p>
              {pending.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">No requests waiting for review.</p>
              ) : (
                <ul className="mt-4 space-y-4">
                  {pending.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-foreground">
                            {r.companyName}{" "}
                            <span className="ml-1 rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                              {r.kind === "partner"
                                ? PARTNER_LABEL[r.partnerType ?? "other"]
                                : "Corporate"}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {r.firstName} {r.lastName} · {r.position} · {r.email} · {r.phone}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {r.street}, {r.city}
                            {r.state ? `, ${r.state}` : ""} {r.zip}, {r.country} · Reg №{" "}
                            {r.registrationNumber} · submitted {formatDate(r.submittedAt)}
                          </div>
                          {r.realtorLicenses?.length ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {r.realtorLicenses.map((l) => (
                                <span
                                  key={l.state}
                                  className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand"
                                >
                                  {l.state} · {l.number} · valid till {formatDate(l.validUntil)}
                                </span>
                              ))}
                            </div>
                          ) : null}
                          {r.languages?.length ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Languages: {r.languages.join(", ")}
                            </div>
                          ) : null}
                          {r.lenderLicence ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Licence: {r.lenderLicence}
                            </div>
                          ) : null}
                          {r.companyLicence ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Company licence: {r.companyLicence}
                              {r.companyPhone ? ` · Company phone: ${r.companyPhone}` : ""}
                            </div>
                          ) : null}
                          {r.verificationDocs.length ? (
                            <div className="mt-1 text-xs text-muted-foreground">
                              Verification docs: {r.verificationDocs.join(", ")}
                            </div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            onClick={() => approve(r)}
                            className="rounded-md bg-success px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setStatus(r.id, "declined");
                              logActivity("Loqal admin", "declined a partner registration", r.companyName);
                            }}
                            className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <PartnerComparison />
            <PartnerMetrics />
          </div>
        ) : null}

        {tab === "overview" ? (
          <>
            <section className="mb-6 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {METRICS.map(([label, value, note]) => (
                <div key={label} className="rounded-lg border border-border bg-card p-6">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                  <div className="mt-2 text-3xl font-bold text-brand">{value}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{note}</div>
                </div>
              ))}
            </section>

            <section className="mb-6 rounded-lg border border-border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">Buyer files — oversight</h2>
                <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
                  {buyerFiles.length} active
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Every accepted pre-approval: who represents the buyer, the kickoff choice and the
                current status. Loqal personal advocate cases carry an extra 1% platform fee.
              </p>
              {buyerFiles.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  No active buyer files yet — they appear here once clients accept pre-approval
                  terms.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 font-semibold">Buyer</th>
                        <th className="py-2 pr-4 font-semibold">Property</th>
                        <th className="py-2 pr-4 font-semibold">Representation</th>
                        <th className="py-2 pr-4 font-semibold">Kickoff</th>
                        <th className="py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {buyerFiles.map((l) => (
                        <tr key={l.id}>
                          <td className="py-3 pr-4 font-semibold text-foreground">{l.clientName}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{l.propertyLabel}</td>
                          <td className="py-3 pr-4">
                            {l.buyerAgent?.representation === "loqal_rep" ? (
                              <span className="rounded-full bg-gold-tint px-2.5 py-1 text-[11px] font-semibold text-gold">
                                🛡 Loqal advocate (+1% fee)
                              </span>
                            ) : (
                              <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
                                {l.buyerAgent?.agentName
                                  ? `Direct · ${l.buyerAgent.agentName}`
                                  : "Awaiting choice"}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {l.buyerAgent?.kickoff ? KICKOFF_LABEL[l.buyerAgent.kickoff] : "—"}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {buyerAgentSummary(l, proc) ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-base font-semibold text-foreground">Accounts</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Every access type across the platform.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-2 pr-4 font-semibold">Account</th>
                        <th className="py-2 pr-4 font-semibold">Access</th>
                        <th className="py-2 pr-4 font-semibold">Status</th>
                        <th className="py-2 font-semibold">Tax residency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {ACCOUNTS.map(([name, access, status, residency]) => (
                        <tr key={name}>
                          <td className="py-3 pr-4 font-semibold text-foreground">{name}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{access}</td>
                          <td className="py-3 pr-4">
                            <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
                              {status}
                            </span>
                          </td>
                          <td className="py-3 text-muted-foreground">{residency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-base font-semibold text-foreground">Review queues</h2>
                <div className="mt-4 space-y-3">
                  {QUEUES.map(([label, count, note]) => (
                    <div key={label} className="rounded-lg bg-brand-tint/50 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                        <strong className="text-lg font-bold text-brand">{count}</strong>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
