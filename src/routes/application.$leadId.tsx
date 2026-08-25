import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { ApplicantFile } from "@/components/lender/ApplicantFile";
import { useAuth } from "@/lib/auth";
import { useLeads, LEAD_STATUS_LABEL } from "@/lib/leads";
import { formatDateTime } from "@/lib/dates";

export const Route = createFileRoute("/application/$leadId")({
  head: () => ({
    meta: [
      { title: "Submitted application — Loqal" },
      {
        name: "description",
        content:
          "Read-only view of the mortgage pre-approval application you submitted through Loqal.",
      },
      { property: "og:title", content: "Submitted application — Loqal" },
      {
        property: "og:description",
        content: "Every answer and document you submitted with this Loqal pre-approval request.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SubmittedApplicationPage,
});

function SubmittedApplicationPage() {
  const { leadId } = Route.useParams();
  const { user, ready } = useAuth();
  const { leads } = useLeads();

  if (!ready) return null;

  const lead = leads.find((l) => l.id === leadId);
  const canView =
    Boolean(user) &&
    Boolean(lead) &&
    (user!.role === "admin" || lead!.clientEmail === user!.email);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="My profile" />
      <main className="mx-auto max-w-[1000px] px-4 py-8 md:px-7">
        {!canView || !lead ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <h1 className="text-xl font-bold text-foreground">Application not available</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This submitted form could not be found, or it does not belong to your account.
            </p>
            <Link
              to="/profile"
              className="mt-6 inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Back to My profile
            </Link>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Submitted pre-approval application
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.propertyLabel} · submitted {formatDateTime(lead.submittedAt)} ·{" "}
                  {LEAD_STATUS_LABEL[lead.status]}
                </p>
              </div>
              <Link
                to="/profile"
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
              >
                Back to My profile
              </Link>
            </header>

            <p className="mt-4 rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              This is a read-only copy of exactly what was submitted. To change any answer, update
              your profile or submit a new application — this snapshot stays as filed.
            </p>

            <div className="mt-6">
              <ApplicantFile lead={lead} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
