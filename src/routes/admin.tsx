import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { fullName, useAuth } from "@/lib/auth";

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
