import { Link } from "@tanstack/react-router";
import { ClipboardCheck, FileCheck2 } from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { InspectorNav } from "@/components/partner/InspectorNav";
import { InspectionJobs } from "@/components/partner/InspectionJobs";
import { GetStartedCard } from "@/components/onboarding/GetStartedCard";
import { TaskTracker } from "@/components/tasks/TaskTracker";
import { PointOfContactCard } from "@/components/partner/PointOfContactCard";
import { PartnerRecentActivity } from "@/components/tasks/PartnerRecentActivity";
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
  return <div className="min-h-screen bg-background"><AppHeader navSlot={<InspectorNav current={current}/>}/><main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
    <header className="mb-7"><p className="text-xs font-semibold uppercase tracking-wide text-brand">Inspection partner portal</p><h1 className="mt-2 text-2xl font-bold text-foreground">{current === "home" ? "Inspection overview" : current === "cases" ? "Inspection cases" : "Inspection metrics"}</h1><p className="mt-2 text-sm text-muted-foreground">{registration?.inspectorProfile?.legalName || user.companyName || `${user.firstName} ${user.lastName}`}</p></header>
    {current === "home" ? <>
      <GetStartedCard className="mb-6"/>
      {missing.length ? <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-l-4 border-gold bg-gold-tint p-4"><div className="flex items-start gap-3"><FileCheck2 className="size-5 shrink-0 text-gold"/><div><h2 className="text-sm font-semibold text-foreground">Licence copies needed</h2><p className="mt-1 text-xs text-muted-foreground">{missing.length} service-specific copies outstanding · {Array.from(new Set(missing.map((r) => r.state))).join(", ")}</p></div></div><Button asChild size="sm"><Link to="/profile" search={{ open: "licences", ...(missing[0] ? { focus: missing[0].key } : {}) }}>Provide copies</Link></Button></div> : null}
    </> : null}
    {current !== "cases" ? <section className="mb-7 grid grid-cols-2 gap-4 lg:grid-cols-4">{metrics.map(([label, value]) => <div key={label} className="border-b-2 border-border py-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold text-brand">{ready ? value : "—"}</p></div>)}</section> : null}
    {current === "home" ? <><div className="mb-7 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-foreground">Inspection pipeline</h2><Button variant="outline" size="sm" asChild><Link to="/partner" search={{ tab: "cases" }}><ClipboardCheck/>View all cases</Link></Button></div><InspectionJobs user={user} items={items} ready={ready} refresh={refresh} compact/><div className="mt-8 grid items-start gap-6 lg:grid-cols-2"><TaskTracker/><PartnerRecentActivity/></div><div className="mt-6 max-w-xl"><PointOfContactCard compact/></div></> : current === "cases" ? <InspectionJobs user={user} items={items} ready={ready} refresh={refresh}/> : <section><h2 className="text-lg font-semibold text-foreground">Case distribution by property type</h2><div className="mt-4 divide-y divide-border">{([ ["house", "Houses"], ["apartment", "Apartments"], ["commercial", "Commercial properties"], ["land", "Land"] ] as const).map(([id, label]) => <div key={id} className="flex justify-between py-4 text-sm"><span className="text-foreground">{label}</span><span className="font-semibold text-brand">{mine.filter((r) => r.propertyCategory === id).length}</span></div>)}</div></section>}
  </main></div>;
}