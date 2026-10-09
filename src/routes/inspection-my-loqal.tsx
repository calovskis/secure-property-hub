import { createFileRoute, Link } from "@tanstack/react-router";
import { InspectorMyLoqal, MY_LOQAL_SECTIONS, type MyLoqalSection } from "@/components/partner/InspectorMyLoqal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/inspection-my-loqal")({
  validateSearch: (search: Record<string, unknown>): { section: MyLoqalSection } => ({ section: MY_LOQAL_SECTIONS.find((s) => s === search["section"]) || "profile" }),
  head: () => ({ meta: [
    { title: "My Loqal — Inspection Partner Organization" },
    { name: "description", content: "Manage your inspection company profile, registered team, service coverage and partnership compliance on Loqal." },
    { property: "og:title", content: "My Loqal — Inspection Partner Organization" },
    { property: "og:description", content: "Inspection partner company information, services, account access and compliance documents." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: MyLoqalPage,
});

function MyLoqalPage() {
  const { user, ready } = useAuth();
  const { section } = Route.useSearch();
  if (!ready) return <p className="p-8 text-sm text-muted-foreground">Loading…</p>;
  if (!user) return <main className="mx-auto max-w-lg p-8"><h1 className="text-xl font-semibold">My Loqal</h1><Button asChild size="sm" className="mt-4"><Link to="/auth">Sign in to My Loqal</Link></Button></main>;
  if (user.role !== "partner" || user.partnerType !== "inspector") return <p className="p-8 text-sm text-muted-foreground">My Loqal is available in the inspection partner portal.</p>;
  return <InspectorMyLoqal user={user} section={section}/>;
}