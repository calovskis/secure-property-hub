import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { PartnerAccountCard } from "@/components/profile/PartnerAccountCard";
import { PARTNER_LABEL, ROLE_LABEL, fullName, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Account settings · Loqal" },
      {
        name: "description",
        content:
          "Manage your Loqal account details, registered name, company and contact information.",
      },
      { property: "og:title", content: "Account settings · Loqal" },
      {
        property: "og:description",
        content: "Manage your Loqal account details, registered name and company information.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="Settings" />
      <main className="mx-auto max-w-[900px] px-4 py-8 md:px-7">
        <header>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your account details live here. Changes to your registered name or company are reviewed
            by Loqal.
          </p>
        </header>

        <div className="mt-6 space-y-6">
          {!user ? (
            <p className="text-sm text-muted-foreground">Sign in to manage your account.</p>
          ) : user.role === "partner" ? (
            <PartnerAccountCard user={user} />
          ) : (
            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground">Account details</h2>
              <div className="mt-3">
                <Row label="Full name" value={fullName(user)} />
                <Row label="Email" value={user.email} />
                <Row label="Phone" value={user.phone} />
                <Row
                  label="Access"
                  value={`${ROLE_LABEL[user.role]}${
                    user.partnerType ? ` · ${PARTNER_LABEL[user.partnerType]}` : ""
                  }`}
                />
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
