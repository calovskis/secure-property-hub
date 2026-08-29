import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { ApplicantFile } from "@/components/lender/ApplicantFile";
import { useLeads } from "@/lib/leads";

export const Route = createFileRoute("/lender/file/$leadId")({
  component: LenderApplicantFilePage,
  head: ({ params }) => {
    const title = `Applicant file ${params.leadId} — LOQAL`;
    const description = `Full lender applicant file and underwriting record for pre-approval request ${params.leadId} on LOQAL.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
});

function LenderApplicantFilePage() {
  const { leadId } = Route.useParams();
  const { leads, ready } = useLeads();
  const lead = leads.find((l) => l.id === leadId);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        navSlot={
          <Link
            to="/partner"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-md bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand"
          >
            <span aria-hidden>🏦</span> Lender workspace
          </Link>
        }
      />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link
          to="/partner"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-brand"
        >
          ← Back to lender portal
        </Link>

        {!ready ? (
          <p className="text-sm text-muted-foreground">Loading applicant file…</p>
        ) : !lead ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            <h1 className="text-lg font-bold text-foreground">Applicant file not found</h1>
            <p className="mt-2">
              This pre-approval request could not be found. It may have been removed, or the link
              may be incorrect.
            </p>
          </div>
        ) : (
          <ApplicantFile lead={lead} />
        )}
      </main>
    </div>
  );
}
