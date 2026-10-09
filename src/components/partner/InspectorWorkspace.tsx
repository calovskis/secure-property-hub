import { Link } from "@tanstack/react-router";
import { FileCheck2 } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { InspectorNav } from "@/components/partner/InspectorNav";
import { InspectionCases } from "@/components/partner/InspectionCases";
import { InspectorDashboard } from "@/components/partner/InspectorDashboard";
import { useInspectionRequests } from "@/lib/inspections";
import { useAuth, type LoqalUser } from "@/lib/auth";
import { usePartnerRequests } from "@/lib/partner-requests";
import { inspectorLicenceRequirements } from "@/lib/inspection-licensing";

export function InspectorWorkspace({ user, tab }: { user: LoqalUser; tab?: string | undefined }) {
  const current = tab === "cases" || tab === "metrics" ? tab : "home";
  const { authUserId } = useAuth();
  const { items, ready, refresh } = useInspectionRequests();
  const { requests } = usePartnerRequests();
  const registration = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const missing = inspectorLicenceRequirements(registration?.inspectorProfile).filter((r) => !r.provided);
  const mine = items.filter((r) => r.inspectorUserId === authUserId && r.status !== "cancelled");
  const metrics = [
    ["Available requests", items.filter((r) => r.status === "open").length],
    ["Active cases", mine.filter((r) => r.status === "accepted" || r.status === "scheduled").length],
    ["Reports delivered", mine.filter((r) => r.status === "report_uploaded" || r.status === "completed").length],
    ["Completed cases", mine.filter((r) => r.status === "completed").length],
  ] as const;
  return <div className="min-h-screen bg-background"><AppHeader navSlot={<InspectorNav current={current}/>}/><main className="mx-auto max-w-[1170px] px-4 py-8 md:px-7">
    <header className="mb-5"><p className="text-[10px] font-semibold uppercase tracking-wide text-brand">Inspection partner portal</p><h1 className="mt-2 text-2xl font-bold leading-tight text-foreground">{current === "home" ? `Hi ${user.firstName}` : current === "cases" ? "Inspection cases" : "Inspection metrics"}</h1><p className="mt-2 text-sm text-muted-foreground">{registration?.inspectorProfile?.legalName || user.companyName || `${user.firstName} ${user.lastName}`}{current === "home" ? " · Your inspection overview" : ""}</p></header>
    {current === "metrics" ? <section className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="border-b-2 border-border py-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold text-brand">{ready ? value : "—"}</p></div>)}</section> : null}
    {current === "home" ? <InspectorDashboard user={user} authUserId={authUserId} items={items} ready={ready} refresh={refresh} profile={registration?.inspectorProfile} licenceNotice={missing.length ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/30 bg-gold-tint p-4"><div className="flex items-start gap-3"><FileCheck2 className="size-5 shrink-0 text-gold"/><div><h2 className="text-sm font-semibold text-foreground">Licence copies needed</h2><p className="mt-1 text-xs text-muted-foreground">{missing.length} service-specific copies outstanding · {Array.from(new Set(missing.map((r) => r.state))).join(", ")}</p></div></div><Button asChild size="sm"><Link to="/profile" search={{ open: "licences", ...(missing[0] ? { focus: missing[0].key } : {}) }}>Provide copies</Link></Button></div> : null}/> : current === "cases" ? <InspectionCases user={user} items={items} ready={ready} refresh={refresh}/> : <section><h2 className="text-lg font-semibold text-foreground">Case distribution by property type</h2><div className="mt-4 divide-y divide-border">{([ ["house", "Houses"], ["apartment", "Apartments"], ["commercial", "Commercial properties"], ["land", "Land"] ] as const).map(([id, label]) => <div key={id} className="flex justify-between py-4 text-sm"><span className="text-foreground">{label}</span><span className="font-semibold text-brand">{mine.filter((r) => r.propertyCategory === id).length}</span></div>)}</div></section>}
  </main></div>;
}