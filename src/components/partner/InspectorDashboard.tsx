import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, CalendarDays, ClipboardCheck, Clock3, FileCheck2, House, Receipt, Search, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GetStartedCard } from "@/components/onboarding/GetStartedCard";
import { TaskTracker } from "@/components/tasks/TaskTracker";
import { PartnerRecentActivity } from "@/components/tasks/PartnerRecentActivity";
import { PointOfContactCard } from "@/components/partner/PointOfContactCard";
import { InspectionJobDetails } from "@/components/partner/InspectionJobs";
import { formatDateTime } from "@/lib/dates";
import { INSPECTION_STATUS_LABEL, type InspectionRequest } from "@/lib/inspections";
import { SERVICE_LABEL, type InspectorProfile } from "@/lib/inspection-licensing";
import type { LoqalUser } from "@/lib/auth";

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="overflow-hidden rounded-lg border border-border bg-card">
    <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 className="text-sm font-semibold text-foreground">{title}</h2>{action}</div>
    <div className="px-4">{children}</div>
  </section>;
}

function CaseLink({ tab = "cases", children = "View all" }: { tab?: string; children?: ReactNode }) {
  return <Button asChild size="sm" variant="link" className="h-auto p-0 text-xs text-brand"><Link to="/partner" search={{ tab }}>{children}<ArrowRight className="size-3"/></Link></Button>;
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

function CaseRow({ item, onOpen, scheduled = false }: { item: InspectionRequest; onOpen: () => void; scheduled?: boolean }) {
  const Icon = scheduled ? Clock3 : item.propertyCategory === "house" ? House : Building2;
  const badge = item.status === "open" ? "New" : item.status === "scheduled" ? "Scheduled" : item.status === "accepted" ? "To confirm" : INSPECTION_STATUS_LABEL[item.status];
  const badgeClass = item.status === "scheduled" || item.status === "completed" || item.status === "report_uploaded" ? "bg-success/10 text-success" : item.status === "accepted" ? "bg-warning/10 text-warning" : "bg-brand-tint text-brand";
  return <Button variant="ghost" onClick={onOpen} className="h-auto min-h-20 w-full justify-start gap-3 rounded-none border-b border-border px-0 py-3 text-left whitespace-normal last:border-0 hover:bg-brand-tint/40">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand"><Icon className="size-4"/></span>
    <span className="min-w-0 flex-1"><span className="block text-xs font-semibold leading-5 text-foreground">{item.propertyLabel}</span><span className="mt-0.5 block text-[11px] font-normal leading-4 text-muted-foreground">{scheduled && (item.scheduledAt || item.proposedAt) ? formatDateTime(item.scheduledAt || item.proposedAt || "") : `${item.state} · ${item.inspectionTypes.join(", ")}`}</span></span>
    <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${badgeClass}`}>{badge}</span>
  </Button>;
}

export function InspectorDashboard({ user, authUserId, items, ready, refresh, profile, licenceNotice }: { user: LoqalUser; authUserId: string | null | undefined; items: InspectionRequest[]; ready: boolean; refresh: () => void; profile?: InspectorProfile | undefined; licenceNotice: ReactNode }) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mine = items.filter((item) => item.inspectorUserId === authUserId && item.status !== "cancelled");
  const available = items.filter((item) => item.status === "open");
  const active = mine.filter((item) => item.status === "accepted" || item.status === "scheduled");
  const completed = mine.filter((item) => item.status === "completed" || item.status === "report_uploaded");
  const now = new Date();
  const upcoming = active.filter((item) => {
    const at = item.scheduledAt || item.proposedAt;
    if (!at) return false;
    const date = new Date(at);
    return date.toDateString() === now.toDateString() || date > now;
  }).sort((a, b) => new Date(a.scheduledAt || a.proposedAt || "").getTime() - new Date(b.scheduledAt || b.proposedAt || "").getTime());
  const today = upcoming.filter((item) => new Date(item.scheduledAt || item.proposedAt || "").toDateString() === now.toDateString());
  const scheduled = today.length ? today : upcoming;
  const monthlyFees = mine.filter((item) => {
    const at = item.scheduledAt || item.proposedAt;
    if (!at) return false;
    const date = new Date(at);
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }).reduce((sum, item) => sum + (item.fee ?? 0), 0);
  const serviceCoverage = new Map<string, string[]>();
  for (const area of profile?.coverage ?? []) for (const service of area.services) {
    const states = serviceCoverage.get(service.service) ?? [];
    if (!states.includes(area.state)) states.push(area.state);
    serviceCoverage.set(service.service, states);
  }
  const query = search.trim().toLowerCase();
  const results = [...available, ...mine].filter((item) => `${item.propertyLabel} ${item.state} ${item.clientLabel} ${item.id} ${item.inspectionTypes.join(" ")}`.toLowerCase().includes(query));
  const selected = items.find((item) => item.id === selectedId);
  const metrics = [
    { label: "Reports delivered", value: completed.length, icon: ClipboardCheck, note: "Reports ready & completed", tone: "text-success" },
    { label: "This month's quoted fees", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(monthlyFees), icon: Wallet, note: "Scheduled & proposed work", tone: "text-muted-foreground" },
    { label: "Pending reports", value: active.length, icon: FileCheck2, note: `${active.filter((item) => item.status === "scheduled").length} scheduled inspections`, tone: "text-warning" },
    { label: "Active clients", value: new Set(active.map((item) => item.clientEmail)).size, icon: Users, note: `${active.length} active cases`, tone: "text-success" },
  ];
  return <>
    <label className="mb-4 flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-4 focus-within:ring-2 focus-within:ring-ring">
      <Search className="size-4 shrink-0 text-muted-foreground"/>
      <input aria-label="Search inspections" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search inspections, property address, client or ID…" className="min-w-0 flex-1 bg-transparent py-3 text-xs text-foreground outline-none placeholder:text-muted-foreground"/>
      {search ? <Button size="sm" variant="ghost" onClick={() => setSearch("")} className="h-7 text-xs">Clear</Button> : null}
    </label>
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
      <div className="min-w-0 space-y-4">
        <GetStartedCard className="rounded-lg shadow-none"/>
        {licenceNotice}
        {query ? <Panel title="Search results" action={<span className="text-xs text-muted-foreground">{results.length} matching cases</span>}>
          {!ready ? <Empty>Loading inspections…</Empty> : results.length ? results.map((item) => <CaseRow key={item.id} item={item} onOpen={() => setSelectedId(item.id)}/>) : <Empty>No inspections match your search.</Empty>}
        </Panel> : <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="New inspection requests" action={<CaseLink/>}>
            {!ready ? <Empty>Loading requests…</Empty> : available.length ? available.slice(0, 3).map((item) => <CaseRow key={item.id} item={item} onOpen={() => setSelectedId(item.id)}/>) : <Empty>No new requests in your coverage areas.</Empty>}
          </Panel>
          <Panel title={today.length ? "Today's schedule" : "Upcoming inspections"} action={<CaseLink/>}>
            {!ready ? <Empty>Loading schedule…</Empty> : scheduled.length ? scheduled.slice(0, 3).map((item) => <CaseRow key={item.id} item={item} scheduled onOpen={() => setSelectedId(item.id)}/>) : <Empty>No upcoming inspections scheduled.</Empty>}
          </Panel>
        </div>}
        <PartnerRecentActivity title="Recent activity & updates" initialLimit={3} className="rounded-lg"/>
        <TaskTracker/>
      </div>
      <aside className="min-w-0 space-y-4">
        <section aria-label="Inspection metrics" className="grid grid-cols-2 gap-3">
          {metrics.map((metric) => <div key={metric.label} className="min-w-0 rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gold-tint text-gold"><metric.icon className="size-4"/></span><span className="break-all text-xl font-bold text-foreground">{ready ? metric.value : "—"}</span></div>
            <h2 className="mt-3 text-[10px] font-semibold uppercase leading-4 text-muted-foreground">{metric.label}</h2><p className={`mt-1 text-[11px] leading-4 ${metric.tone}`}>{metric.note}</p>
          </div>)}
        </section>
        <Panel title="Inspection fees" action={<CaseLink/>}>
          {!ready ? <Empty>Loading fees…</Empty> : mine.some((item) => item.fee != null) ? mine.filter((item) => item.fee != null).slice(0, 3).map((item) => <Button key={item.id} variant="ghost" onClick={() => setSelectedId(item.id)} className="h-auto min-h-20 w-full justify-start gap-3 whitespace-normal rounded-none border-b border-border px-0 py-3 text-left last:border-0"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gold-tint text-gold"><Receipt className="size-4"/></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-foreground">{item.propertyLabel}</span><span className="mt-1 block text-[11px] font-normal text-muted-foreground">{INSPECTION_STATUS_LABEL[item.status]}</span></span><span className="shrink-0 text-xs font-semibold text-brand">${item.fee?.toLocaleString("en-US")}</span></Button>) : <Empty>No inspection fees on file yet.</Empty>}
        </Panel>
        <Panel title="Active services" action={<Button variant="link" size="sm" className="h-auto p-0 text-xs text-brand" asChild><Link to="/profile" search={{ open: "licences" }}>Manage<ArrowRight className="size-3"/></Link></Button>}>
          {serviceCoverage.size ? Array.from(serviceCoverage).map(([id, states]) => <div key={id} className="flex items-center gap-3 border-b border-border py-3 last:border-0"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand"><ClipboardCheck className="size-4"/></span><div className="min-w-0"><h3 className="text-xs font-semibold leading-5 text-foreground">{SERVICE_LABEL[id as keyof typeof SERVICE_LABEL] || id}</h3><p className="mt-0.5 text-[11px] text-muted-foreground">{states.join(", ")} coverage</p></div></div>) : <Empty>No inspection services on file.</Empty>}
        </Panel>
        <PointOfContactCard compact/>
      </aside>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg">
        <DialogHeader><DialogTitle>Inspection case</DialogTitle><DialogDescription>{selected?.propertyLabel}</DialogDescription></DialogHeader>
        {selected ? <InspectionJobDetails r={selected} user={user} onDone={refresh}/> : null}
      </DialogContent>
    </Dialog>
  </>;
}