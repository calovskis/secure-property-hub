import { createFileRoute, Link } from "@tanstack/react-router";
import { InspectorWorkspace } from "@/components/partner/InspectorWorkspace";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/inspection-accounting")({
  head: () => ({ meta: [
    { title: "Inspection Accounting — Loqal" },
    { name: "description", content: "Review inspection quotes, estimated Loqal platform fees and accounting summaries." },
    { property: "og:title", content: "Inspection Accounting — Loqal" },
    { property: "og:description", content: "Inspection partner accounting and platform fee records on Loqal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AccountingPage,
});

function AccountingPage() {
  const { user, ready } = useAuth();
  if (!ready) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!user) return <main className="mx-auto max-w-lg p-8"><h1 className="text-xl font-semibold">Inspection Accounting</h1><Button asChild size="sm" className="mt-4"><Link to="/auth">Sign in to view Accounting</Link></Button></main>;
  if (user.role !== "partner" || user.partnerType !== "inspector") return <p className="p-8 text-sm text-muted-foreground">Accounting is available in the inspection partner portal.</p>;
  return <InspectorWorkspace user={user} tab="accounting"/>;
}
