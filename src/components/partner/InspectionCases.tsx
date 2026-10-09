import { useState } from "react";
import { ArrowDownUp, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, FileCheck2, House, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InspectionJobDetails } from "@/components/partner/InspectionJobs";
import { formatDateTime } from "@/lib/dates";
import { INSPECTION_STATUS_LABEL, type InspectionRequest } from "@/lib/inspections";
import { useAuth, type LoqalUser } from "@/lib/auth";

const field = "h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground";
const PAGE_SIZE = 8;
const isPending = (r: InspectionRequest) => r.status === "scheduled" && !r.reportFiles.length && !!r.scheduledAt && new Date(r.scheduledAt).getTime() <= Date.now();
const sameDay = (date?: string | null) => !!date && new Date(date).toDateString() === new Date().toDateString();

export function InspectionCases({ user, items, ready, refresh }: { user: LoqalUser; items: InspectionRequest[]; ready: boolean; refresh: () => void }) {
  const { authUserId } = useAuth();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [service, setService] = useState("all");
  const [category, setCategory] = useState("all");
  const [newest, setNewest] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const visible = items.filter((r) => r.status === "open" || (!!authUserId && r.inspectorUserId === authUserId));
  const matchesTab = (r: InspectionRequest, id: string) => id === "all" || (id === "open" ? r.status === "open" : id === "scheduled" ? r.status === "accepted" || r.status === "scheduled" : id === "pending" ? isPending(r) : r.status === "report_uploaded" || r.status === "completed");
  const tabs = [["all", "All inspections"], ["open", "New requests"], ["scheduled", "Scheduled & assigned"], ["pending", "Reports pending"], ["complete", "Reports & completed"]];
  const services = Array.from(new Set(visible.flatMap((r) => r.inspectionTypes))).sort();
  const filtered = visible.filter((r) => matchesTab(r, tab) && (status === "all" || r.status === status) && (service === "all" || r.inspectionTypes.includes(service)) && (category === "all" || r.propertyCategory === category) && `${r.propertyLabel} ${r.clientLabel} ${r.id} ${r.state}`.toLowerCase().includes(search.toLowerCase().trim())).sort((a, b) => (newest ? -1 : 1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  const maxPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, maxPage);
  const rows = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selected = visible.find((r) => r.id === selectedId);
  const summaries = [
    { label: "New requests", count: visible.filter((r) => r.status === "open").length, icon: Inbox, detail: "Available in your coverage areas", tab: "open" },
    { label: "Scheduled today", count: visible.filter((r) => r.status === "scheduled" && sameDay(r.scheduledAt)).length, icon: CalendarDays, detail: "Confirmed appointments today", tab: "scheduled" },
    { label: "Reports pending", count: visible.filter(isPending).length, icon: FileCheck2, detail: "Appointment passed · report not uploaded", tab: "pending" },
    { label: "Completed this month", count: visible.filter((r) => r.status === "completed" && r.reportFiles.some((f) => new Date(f.uploadedAt).getMonth() === new Date().getMonth() && new Date(f.uploadedAt).getFullYear() === new Date().getFullYear())).length, icon: ClipboardCheck, detail: "Completed cases with a report this month", tab: "complete" },
  ];
  const reset = () => { setSearch(""); setStatus("all"); setService("all"); setCategory("all"); setTab("all"); setPage(0); };
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{summaries.map((m) => <Button key={m.label} variant="outline" onClick={() => { setTab(m.tab); setPage(0); }} className="h-auto min-w-0 flex-col items-start gap-2 whitespace-normal p-4 text-left"><span className="flex w-full items-center justify-between"><m.icon className="text-brand"/><span className="text-2xl font-bold text-foreground">{ready ? m.count : "—"}</span></span><span className="text-xs font-semibold">{m.label}</span><span className="text-[11px] font-normal text-muted-foreground">{m.detail}</span></Button>)}</div>
    <section aria-label="Inspection case workspace" className="overflow-hidden rounded-lg border border-border bg-card">
      <div role="group" aria-label="Inspection stages" className="flex flex-wrap gap-1 border-b border-border px-3 py-2">{tabs.map(([id, label]) => <Button key={id} variant="ghost" size="sm" aria-pressed={tab === id} onClick={() => { setTab(id); setPage(0); }} className={tab === id ? "bg-brand-tint text-brand" : "text-muted-foreground"}>{label}<span className="text-[10px]">{ready ? visible.filter((r) => matchesTab(r, id)).length : "—"}</span></Button>)}</div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <label className="relative min-w-0 flex-1 basis-60"><Search className="absolute left-3 top-3 size-3.5 text-muted-foreground"/><input aria-label="Search inspection cases" placeholder="Search address, client or inspection ID" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className={`${field} w-full pl-9`}/></label>
        <select aria-label="Inspection status" className={field} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="all">All statuses</option>{Object.entries(INSPECTION_STATUS_LABEL).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select aria-label="Inspection service" className={`${field} max-w-full`} value={service} onChange={(e) => { setService(e.target.value); setPage(0); }}><option value="all">All services</option>{services.map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Property type" className={field} value={category} onChange={(e) => { setCategory(e.target.value); setPage(0); }}><option value="all">All property types</option><option value="house">Houses</option><option value="apartment">Apartments</option><option value="commercial">Commercial</option><option value="land">Land</option></select>
        <Button variant="outline" size="sm" onClick={() => { setNewest(!newest); setPage(0); }}><ArrowDownUp/> {newest ? "Newest" : "Oldest"}</Button>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-muted/30 text-muted-foreground"><tr>{["Property", "Client & realtor", "Service", "Appointment", "Status", "Action"].map((h) => <th key={h} scope="col" className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((r) => <tr key={r.id} className="hover:bg-muted/20"><td className="max-w-64 px-4 py-4"><div className="flex items-start gap-2"><House className="mt-0.5 size-4 shrink-0 text-brand"/><div><p className="font-semibold text-foreground">{r.propertyLabel}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">{r.state} · ID {r.id}</p></div></div></td><td className="max-w-48 px-4 py-4"><p className="font-medium text-foreground">{r.clientLabel}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">{r.agentEmail ? `Realtor: ${r.agentEmail}` : "Realtor not assigned"}</p></td><td className="max-w-40 px-4 py-4"><div className="flex flex-wrap gap-1">{r.inspectionTypes.map((s) => <span key={s} className="rounded-md bg-brand-tint px-2 py-1 text-[10px] text-brand">{s}</span>)}</div></td><td className="px-4 py-4"><p className="font-medium text-foreground">{r.scheduledAt || r.proposedAt ? formatDateTime(r.scheduledAt || r.proposedAt) : "Not arranged"}</p><p className="mt-1 text-[10px] text-muted-foreground">{r.scheduledAt ? sameDay(r.scheduledAt) ? "Today" : "Confirmed" : r.proposedAt ? "Proposed" : "Awaiting acceptance"}</p></td><td className="px-4 py-4"><span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold ${isPending(r) ? "bg-gold-tint text-gold" : "bg-brand-tint text-brand"}`}>{isPending(r) ? "Report pending" : r.status === "open" ? "New request" : INSPECTION_STATUS_LABEL[r.status]}</span></td><td className="px-4 py-4"><Button size="sm" variant={r.status === "open" || isPending(r) ? "default" : "outline"} onClick={() => setSelectedId(r.id)}>{r.status === "open" ? "Accept" : isPending(r) ? "Upload report" : r.reportFiles.length ? "View report" : "Open job"}</Button></td></tr>)}</tbody></table></div>
      {!rows.length ? <div className="space-y-2 px-4 py-12 text-center"><p className="text-sm text-muted-foreground">{!ready ? "Loading inspections…" : "No inspections in this view."}</p>{ready && (search || tab !== "all" || status !== "all" || service !== "all" || category !== "all") ? <Button size="sm" variant="ghost" onClick={reset}>Clear filters</Button> : null}</div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground"><span>{filtered.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length} inspections` : "0 inspections"}</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft/></Button><span>Page {currentPage + 1}</span><Button size="sm" variant="outline" aria-label="Next page" disabled={currentPage === maxPage} onClick={() => setPage(currentPage + 1)}><ChevronRight/></Button></div></div>
    </section>
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{selected?.propertyLabel || "Inspection case"}</DialogTitle><DialogDescription>Inspection details and next actions</DialogDescription></DialogHeader>{selected ? <InspectionJobDetails key={selected.id} r={selected} user={user} onDone={refresh}/> : null}</DialogContent></Dialog>
  </div>;
}