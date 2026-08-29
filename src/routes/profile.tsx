import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/AppHeader";
import { MortgageQuestionnaire } from "@/components/mortgage/MortgageQuestionnaire";
import { FeedbackDialog } from "@/components/mortgage/FeedbackDialog";
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
import { AgreementCard } from "@/components/profile/AgreementCard";
import { KybCard } from "@/components/profile/KybCard";
import { RealtorVerificationCard } from "@/components/profile/RealtorVerificationCard";
import { PartnerAccountCard } from "@/components/profile/PartnerAccountCard";
import { AdminRequestsCard } from "@/components/profile/AdminRequestsCard";
import { useUploadDrafts, requestOpenUpload } from "@/lib/upload-drafts";
import { PARTNER_LABEL, ROLE_LABEL, fullName, useAuth, type MortgageProfile } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LEAD_STATUS_LABEL,
  canCancelLead,
  useLeads,
  type MortgageLead,
} from "@/lib/leads";
import { useMortgageDrafts } from "@/lib/mortgage-draft";
import { useI18n } from "@/lib/i18n";
import { DocumentRequestDialog } from "@/components/mortgage/DocumentRequestDialog";
import {
  outstandingDocumentRequests,
  stagedCounts,
  type DocumentRequest,
} from "@/lib/document-requests";
import { usePartnerRequests } from "@/lib/partner-requests";

const DOC_KINDS = ["idDocuments", "visaDocuments", "bankruptcyDocuments"] as const;

export const Route = createFileRoute("/profile")({
  /** `?doc=<kind>` opens that upload pop-up, `?open=questionnaire` the wizard. */
  validateSearch: (
    search: Record<string, unknown>,
  ): { doc?: DocumentRequest["kind"]; open?: "questionnaire" } => {
    const out: { doc?: DocumentRequest["kind"]; open?: "questionnaire" } = {};
    const doc = search["doc"];
    if (DOC_KINDS.includes(doc as (typeof DOC_KINDS)[number]))
      out.doc = doc as DocumentRequest["kind"];
    if (search["open"] === "questionnaire") out.open = "questionnaire";
    return out;
  },
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
  if (lead.status === "annulled") return "bg-muted text-muted-foreground";
  if (lead.status === "info_required") return "bg-gold-tint text-gold";
  return "bg-brand-tint text-brand";
}

function ApplicationCard({ lead }: { lead: MortgageLead }) {
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { cancelLead } = useLeads();
  const cancellable = canCancelLead(lead);
  const annulled = lead.status === "annulled";

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
          {lead.status === "new" && lead.assignedAt
            ? "Assigned to a loan processor"
            : LEAD_STATUS_LABEL[lead.status]}
        </span>
      </div>

      {lead.status === "new" && lead.assignedAt ? (
        <p className="mt-3 rounded-md bg-brand-tint/40 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Status update: </strong>
          your application was assigned to a licensed loan processor on{" "}
          {formatDateTime(lead.assignedAt)}. They are reviewing your file and will respond with a
          pre-qualification decision.
        </p>
      ) : null}

      {annulled ? (
        <p className="mt-3 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
          You annulled this application{lead.annulledAt ? ` on ${formatDateTime(lead.annulledAt)}` : ""}.
          The lender can no longer assign it or send feedback. You can resubmit at any time — all your
          saved answers are pre-filled and can be changed freely.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/application/$leadId"
          params={{ leadId: lead.id }}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
        >
          View submitted form
        </Link>
        {!annulled ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
          >
            View feedback
          </button>
        ) : null}

        <Link
          to="/property/$propertyId"
          params={{ propertyId: String(lead.propertyId) }}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
        >
          {annulled ? "Resubmit application" : "Open property"}
        </Link>
        {cancellable ? (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10"
          >
            Cancel application
          </button>
        ) : null}
      </div>

      {!annulled ? <FeedbackDialog lead={lead} open={open} onOpenChange={setOpen} /> : null}

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this application?</DialogTitle>
            <DialogDescription>
              The application for {lead.propertyLabel} will be marked <strong>Annulled</strong>. The
              mortgage lender will not be able to pick it up or send feedback anymore. You can
              resubmit later with your saved answers pre-filled.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Keep application
            </button>
            <button
              type="button"
              onClick={() => {
                cancelLead(lead.id);
                setConfirmCancel(false);
              }}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:opacity-90"
            >
              Yes, annul it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}

function DocumentRequestItem({
  request,
  profile,
  stagedCount,
  autoOpen = false,
}: {
  request: DocumentRequest;
  profile: MortgageProfile;
  stagedCount: number;
  /** Opened straight away when the client arrived from its notification. */
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  useEffect(() => {
    if (autoOpen) setOpen(true);
  }, [autoOpen]);
  return (
    <li className="rounded-md border border-gold/40 bg-gold-tint/40 p-3">
      <div className="text-sm font-medium text-foreground">{request.title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{request.label} · not submitted yet</div>
      {stagedCount ? (
        <div className="mt-1 text-xs font-semibold text-gold">
          {stagedCount} file(s) pre-saved — confirm to submit
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
      >
        {stagedCount ? "Continue upload" : "Upload now"}
      </button>
      <DocumentRequestDialog
        request={request}
        profile={profile}
        open={open}
        onOpenChange={setOpen}
      />
    </li>
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
  const { user, ready, saveMortgageProfile } = useAuth();
  const { leadsForClient } = useLeads();
  const { drafts: allDrafts } = useMortgageDrafts();
  const { t } = useI18n();
  const { requests: partnerRequests } = usePartnerRequests();
  const [wizardOpen, setWizardOpen] = useState(false);
  const { doc: docParam, open: openParam } = Route.useSearch();

  // A notification can deep-link straight into the form that needs filling.
  useEffect(() => {
    if (openParam === "questionnaire") setWizardOpen(true);
  }, [openParam]);
  const [staged, setStaged] = useState<Partial<Record<DocumentRequest["kind"], number>>>({});

  useEffect(() => {
    setStaged(stagedCounts(user?.email));
  }, [user?.email, user?.mortgageProfile?.submittedAt, wizardOpen]);


  const clientLeads = user ? leadsForClient(user.email) : [];
  /* If the account has no stored profile yet, rebuild it from the most recent
   * submitted pre-approval application so the client never sees an empty
   * profile after applying. */
  const recoveredProfile =
    !user?.mortgageProfile && clientLeads.length
      ? clientLeads
          .slice()
          .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1))
          .find((l) => l.profile)?.profile
      : undefined;

  useEffect(() => {
    if (recoveredProfile) saveMortgageProfile(recoveredProfile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recoveredProfile?.submittedAt]);

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
  const leads = clientLeads
    .slice()
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  const profile = user.mortgageProfile ?? recoveredProfile;
  const unfinished = allDrafts(user.email).filter((d) => !d.submitted);
  const docRequests = outstandingDocumentRequests(user, profile);



  // The registration on file is the source of truth for the partner type —
  // the sign-in selector can be left on another type by mistake.
  const myRegistration = partnerRequests.find(
    (r) => r.email.toLowerCase() === user.email.toLowerCase(),
  );
  const isRealtor = user.partnerType === "realtor" || myRegistration?.partnerType === "realtor";
  // Realtors keep their workspace header everywhere, including My Profile.
  const realtorNav = [
    { label: "Home", icon: "🏠", to: "/partner" },
    { label: "Files", icon: "📁", to: "/partner" },
    { label: "Analytics", icon: "📈", to: "/partner" },
    { label: "Accounting", icon: "💳", to: "/partner" },
    { label: "My Profile", icon: "👤", to: "/profile" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        active={isRealtor ? "My Profile" : "My profile"}
        {...(isRealtor ? { navItems: realtorNav } : {})}
      />

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
            {isPartner ? (
              <>
                <PartnerAccountCard user={user} />
                <AdminRequestsCard user={user} />
                {isRealtor ? <RealtorVerificationCard user={user} /> : <KybCard user={user} />}
                <PartnerProfile user={user} />
              </>
            ) : (
              <>
                <section className="rounded-lg border border-border bg-card p-6">
                  <h2 className="text-base font-semibold text-foreground">Account details</h2>
                  <div className="mt-3">
                    <Row label="Full name" value={fullName(user)} />
                    <Row label="Email" value={user.email} />
                    <Row label="Phone" value={user.phone} />
                    <Row label="US citizen / green card" value={user.usPerson ? "Yes" : "No"} />
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
              </>
            )}
          </div>

          {isPartner ? (
            <aside className="space-y-6">
              <AgreementCard user={user} />
              <OpenRequests user={user} />
            </aside>
          ) : (
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
                {docRequests.length && profile ? (
                  <ul className="mt-4 space-y-3">
                    {docRequests.map((request) => (
                      <DocumentRequestItem
                        key={request.kind}
                        request={request}
                        profile={profile}
                        stagedCount={staged[request.kind] ?? 0}
                        autoOpen={docParam === request.kind}
                      />
                    ))}
                  </ul>
                ) : null}
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
                ) : docRequests.length ? null : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No forms in progress. Anything you start is saved automatically.
                  </p>
                )}
              </section>
            </aside>
          )}
        </div>
      </main>

      <MortgageQuestionnaire open={wizardOpen} onOpenChange={setWizardOpen} />
    </div>
  );
}

/**
 * Everything Loqal is still waiting for from a partner: document upload
 * requests, missing verification documents and uploads left half-finished.
 */
function OpenRequests({ user }: { user: LoqalUser }) {
  const drafts = useUploadDrafts();
  const { requests } = usePartnerRequests();
  const registration = requests.find(
    (r) => r.email.toLowerCase() === user.email.toLowerCase(),
  );

  const items: { id: string; title: string; detail: string }[] = [];

  for (const item of registration?.adminRequests ?? []) {
    if (item.kind === "info" && !item.answeredAt)
      items.push({
        id: `partner-request:${item.id}`,
        title: item.requiresDocument ? "Document requested by Loqal" : "Information requested",
        detail: item.message,
      });
  }

  if (registration && (user.partnerType === "realtor" || registration.partnerType === "realtor")) {
    if (!registration.realtorVerification?.identityDoc)
      items.push({
        id: "realtor-identity",
        title: "Identity document",
        detail: "Upload your driver's licence or passport.",
      });
    const licences = licenseDocsOf(registration);
    const missing = licences.filter((l) => !l.doc).length;
    if (missing)
      items.push({
        id: "realtor-licences",
        title: "State licence copies",
        detail: `${missing} of ${licences.length} state(s) still need a copy.`,
      });
  }

  for (const d of drafts)
    if (!items.some((i) => i.id === d.id))
      items.push({ id: d.id, title: d.label, detail: "Pre-saved upload — not submitted yet." });

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">Open requests</h2>
      {items.length ? (
        <ul className="mt-4 space-y-3">
          {items.map((item) => {
            const draft = drafts.find((d) => d.id === item.id);
            const staged = draft
              ? draft.states
                ? Object.keys(draft.states).length
                : draft.files.length
              : 0;
            return (
              <li key={item.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-semibold text-foreground">{item.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{item.detail}</div>
                {draft ? (
                  <div className="mt-1 text-[11px] font-semibold text-gold">
                    {staged} of {draft.expected ?? 1} attached · saved{" "}
                    {formatDateTime(draft.updatedAt)}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => requestOpenUpload(item.id)}
                  className="mt-2 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
                >
                  {draft ? "Continue" : "Upload"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing pending. Anything Loqal asks you for shows up here, and unfinished uploads are
          saved automatically.
        </p>
      )}
    </section>
  );
}
