import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { MortgageQuestionnaire } from "@/components/mortgage/MortgageQuestionnaire";
import {
  AddressTopic,
  AssetsTopic,
  CitizenshipTopic,
  DeclarationsTopic,
  DemographicsTopic,
  DocumentsTopic,
  IncomeTopic,
  LiabilitiesTopic,
  PersonalTopic,
} from "@/components/profile/ProfileTopicsContent";
import { PartnerProfile } from "@/components/profile/PartnerProfile";
import { PARTNER_LABEL, ROLE_LABEL, fullName, useAuth, type MortgageProfile } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import { LEAD_STATUS_LABEL, hasPricedOffer, useLeads, type MortgageLead } from "@/lib/leads";
import { useMortgageDrafts } from "@/lib/mortgage-draft";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Loqal" },
      {
        name: "description",
        content:
          "Review the information you shared with Loqal, track submitted applications and read lender feedback.",
      },
      { property: "og:title", content: "My Profile — Loqal" },
      {
        property: "og:description",
        content:
          "Your Loqal profile: personal details, submitted applications, lender feedback and unfinished forms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Row({ label, value }: { label: string; value?: string | number | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function statusTone(lead: MortgageLead) {
  if (lead.status === "qualified") return "bg-success/10 text-success";
  if (lead.status === "not_qualified") return "bg-destructive/10 text-destructive";
  if (lead.status === "info_required") return "bg-gold-tint text-gold";
  return "bg-brand-tint text-brand";
}

function FeedbackBlock({ lead }: { lead: MortgageLead }) {
  const answered = lead.infoRequests.filter((r) => r.answeredAt);
  const open = lead.infoRequests.filter((r) => !r.answeredAt);

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Lender feedback
      </div>

      {lead.status === "new" ? (
        <p className="text-sm text-muted-foreground">
          Delivered to a Loqal lending partner. No feedback yet — you will see it here.
        </p>
      ) : null}

      {lead.decidedAt ? (
        <p className="text-xs text-muted-foreground">
          Decision issued {formatDateTime(lead.decidedAt)}
        </p>
      ) : null}

      {lead.lenderNote ? (
        <p className="rounded-md bg-brand-tint/40 p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Note: </strong>
          {lead.lenderNote}
        </p>
      ) : null}

      {lead.creditScore ? <Row label="Soft credit score" value={lead.creditScore} /> : null}

      {hasPricedOffer(lead) && lead.terms ? (
        <div className="rounded-md border border-success/30 bg-success/5 p-3">
          <div className="text-sm font-semibold text-success">Priced pre-approval</div>
          <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
            <Row label="Rate" value={`${lead.terms.ratePct}%`} />
            <Row label="Term" value={`${lead.terms.termYears} years`} />
            <Row label="Down payment" value={`${lead.terms.downPaymentPct}%`} />
            <Row label="Closing costs" value={`${lead.terms.closingCostPct}%`} />
            <Row
              label="Your decision"
              value={
                lead.clientDecision
                  ? `${lead.clientDecision === "accepted" ? "Accepted" : "Declined"} · ${formatDate(
                      lead.clientDecisionAt,
                    )}`
                  : "Awaiting your confirmation"
              }
            />
          </div>
        </div>
      ) : null}

      {open.length ? (
        <div className="rounded-md border border-gold/40 bg-gold-tint/50 p-3 text-sm text-foreground">
          {open.length} open question{open.length > 1 ? "s" : ""} from your lender — open the
          property page to reply.
        </div>
      ) : null}

      {answered.length ? (
        <div className="space-y-2">
          {answered.map((r) => (
            <div key={r.id} className="rounded-md border border-border p-3">
              <div className="text-sm font-medium text-foreground">{r.question}</div>
              <div className="mt-1 text-sm text-muted-foreground">{r.answer}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Answered {formatDateTime(r.answeredAt)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ApplicationCard({ lead }: { lead: MortgageLead }) {
  const [open, setOpen] = useState(false);

  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Mortgage pre-approval — {lead.propertyLabel}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {formatDateTime(lead.submittedAt)} · {money(lead.propertyPrice)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone(lead)}`}>
          {LEAD_STATUS_LABEL[lead.status]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
        >
          {open ? "Hide details" : "View feedback"}
        </button>
        <Link
          to="/property/$propertyId"
          params={{ propertyId: String(lead.propertyId) }}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
        >
          Open property
        </Link>
      </div>

      {open ? <FeedbackBlock lead={lead} /> : null}
    </article>
  );
}

function ProfileTopics({ profile }: { profile: MortgageProfile }) {
  const { user, saveMortgageProfile } = useAuth();
  const save = (patch: Partial<MortgageProfile>) => {
    if (!user) return;
    saveMortgageProfile({ ...profile, ...patch });
  };

  return (
    <div className="space-y-4">
      <PersonalTopic profile={profile} onSave={save} />
      <CitizenshipTopic profile={profile} usPerson={user?.usPerson ?? false} onSave={save} />
      <AddressTopic profile={profile} onSave={save} />
      <IncomeTopic profile={profile} onSave={save} />
      <AssetsTopic profile={profile} onSave={save} />
      <LiabilitiesTopic profile={profile} onSave={save} />
      <DeclarationsTopic profile={profile} onSave={save} />
      <DemographicsTopic profile={profile} onSave={save} />
      <DocumentsTopic profile={profile} onSave={save} />
    </div>
  );
}

function ProfilePage() {
  const { user, ready } = useAuth();
  const { leadsForClient } = useLeads();
  const { drafts: allDrafts } = useMortgageDrafts();
  const { t } = useI18n();
  const [wizardOpen, setWizardOpen] = useState(false);

  if (!ready) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="My profile" />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">My profile</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Log in to see the information you shared with Loqal and your applications.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            {t("Log in")}
          </Link>
        </main>
      </div>
    );
  }

  const isPartner = user.role === "partner";
  const leads = leadsForClient(user.email)
    .slice()
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  const profile = user.mortgageProfile;
  const unfinished = allDrafts(user.email).filter((d) => !d.submitted);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="My profile" />

      <main className="mx-auto max-w-[1100px] px-4 py-8 md:px-7">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">My profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isPartner
                ? "Your partner details, licenses and performance with Loqal."
                : "Everything you have shared with Loqal, and the status of what you submitted."}
            </p>
          </div>
          {!isPartner ? (
            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              {profile ? "Update my information" : "Pre-fill my information"}
            </button>
          ) : null}
        </header>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-lg border border-border bg-card p-6">
              <h2 className="text-base font-semibold text-foreground">Account details</h2>
              <div className="mt-3">
                <Row label="Full name" value={fullName(user)} />
                <Row label="Email" value={user.email} />
                <Row label="Phone" value={user.phone} />
                {!isPartner ? (
                  <Row label="US citizen / green card" value={user.usPerson ? "Yes" : "No"} />
                ) : null}
                {user.role === "admin" ? (
                  <Row
                    label="Access"
                    value={`${ROLE_LABEL[user.role]}${
                      user.partnerType ? ` · ${PARTNER_LABEL[user.partnerType]}` : ""
                    }`}
                  />
                ) : null}
                {user.companyName ? <Row label="Company" value={user.companyName} /> : null}
              </div>
            </section>

            {isPartner ? (
              <PartnerProfile user={user} />
            ) : (
              <section className="rounded-lg border border-border bg-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-foreground">
                    Financial & personal profile
                  </h2>
                  {profile ? (
                    <span className="rounded-full bg-success/10 px-3 py-1 text-[11px] font-semibold text-success">
                      Last updated {formatDate(profile.submittedAt)}
                    </span>
                  ) : (
                    <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
                      Not provided yet
                    </span>
                  )}
                </div>

                {profile ? (
                  <div className="mt-4">
                    <ProfileTopics profile={profile} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    You have not shared your personal, address, income and declaration details yet.
                    You can pre-fill them whenever you want — once saved, every future request
                    reuses them.
                  </p>
                )}
              </section>
            )}
          </div>

          {!isPartner ? (
            <aside className="space-y-6">
              <section className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-base font-semibold text-foreground">Submitted applications</h2>
                {leads.length ? (
                  <div className="mt-4 space-y-4">
                    {leads.map((lead) => (
                      <ApplicationCard key={lead.id} lead={lead} />
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Nothing submitted yet. Request a mortgage from any property page and it will
                    appear here with the lender's feedback.
                  </p>
                )}
              </section>

              <section className="rounded-lg border border-border bg-card p-6">
                <h2 className="text-base font-semibold text-foreground">Unfinished forms</h2>
                {unfinished.length ? (
                  <ul className="mt-4 space-y-3">
                    {unfinished.map((d) => (
                      <li
                        key={`${d.propertyId}-${d.updatedAt}`}
                        className="rounded-md border border-border p-3"
                      >
                        <div className="text-sm font-medium text-foreground">
                          {d.propertyLabel ?? "Mortgage pre-approval"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {d.completion}% complete · last edited {formatDateTime(d.updatedAt)}
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                          <div
                            className="h-1.5 rounded-full bg-brand"
                            style={{ width: `${d.completion}%` }}
                          />
                        </div>
                        {d.propertyId ? (
                          <Link
                            to="/property/$propertyId"
                            params={{ propertyId: String(d.propertyId) }}
                            className="mt-3 inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
                          >
                            Continue
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setWizardOpen(true)}
                            className="mt-3 inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
                          >
                            Continue
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No forms in progress. Anything you start is saved automatically.
                  </p>
                )}
              </section>
            </aside>
          ) : null}
        </div>
      </main>

      <MortgageQuestionnaire open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}
