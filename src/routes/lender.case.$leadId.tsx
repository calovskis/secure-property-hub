import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { LenderNavSlot } from "@/components/lender/LenderNavSlot";
import { MortgageFileDetail } from "@/components/lender/MortgageFileDetail";
import { useAuth } from "@/lib/auth";
import { useActiveLeads } from "@/lib/leads";

export const Route = createFileRoute("/lender/case/$leadId")({
  component: LenderMortgageCasePage,
  head: ({ params }) => {
    const title = `Mortgage case ${params.leadId} — Loqal`;
    const description = `Mortgage case workspace ${params.leadId} for an authorised Loqal lending partner.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
});

function LenderMortgageCasePage() {
  const { leadId } = Route.useParams();
  const { user, ready: authReady } = useAuth();
  const { leads, ready: leadsReady } = useActiveLeads();
  const lead = leads.find((item) => item.id === leadId);
  const allowed = user?.role === "partner" && user.partnerType === "lender";

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        navSlot={<LenderNavSlot current="mortgages" />}
      />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <Link
          to="/partner"
          search={{ tab: "mortgages" }}
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-brand"
        >
          ← Back to mortgages
        </Link>

        {!authReady || !leadsReady ? (
          <p className="text-sm text-muted-foreground">Loading mortgage case…</p>
        ) : !allowed ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            <h1 className="text-lg font-bold text-foreground">Lending partner access required</h1>
            <p className="mt-2">This mortgage case is available only to authorised lending partners.</p>
          </div>
        ) : !lead ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            <h1 className="text-lg font-bold text-foreground">Mortgage case not found</h1>
            <p className="mt-2">This case may have been removed or is no longer active.</p>
          </div>
        ) : (
          <MortgageFileDetail lead={lead} standalone />
        )}
      </main>
    </div>
  );
}