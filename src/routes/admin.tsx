import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { PARTNER_LABEL, fullName, useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { useRealtors } from "@/lib/realtors";
import { KICKOFF_LABEL, useLeads } from "@/lib/leads";
import { buyerAgentSummary, useBuyerProcess } from "@/lib/buyer-process";

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
  const { requests, setStatus } = usePartnerRequests();
  const { addRealtor } = useRealtors();
  const { leads } = useLeads();
  const proc = useBuyerProcess();

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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="Home" />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-8">
          <span className="rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand">
            Staff console
          </span>
          <h1 className="mt-3 text-2xl font-bold text-foreground md:text-[32px]">
            Welcome back, {fullName(user)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts, access levels, partner onboarding and compliance in one place.
          </p>
        </div>

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
                        onClick={() => setStatus(r.id, "declined")}
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

        <section className="mb-6 rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Buyer files — oversight</h2>
            <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
              {buyerFiles.length} active
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Every accepted pre-approval: who represents the buyer, the kickoff choice and the
            current status. Loqal personal manager cases carry an extra 1% platform fee.
          </p>
          {buyerFiles.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No active buyer files yet — they appear here once clients accept pre-approval terms.
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
                            🛡 Loqal manager (+1% fee)
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
      </main>
    </div>
  );
}
