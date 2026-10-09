/**
 * Inspection company workspace: open requests in the states they cover, and
 * their accepted jobs through scheduling to report upload.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { DateInput } from "@/components/form/DateInput";
import { notify } from "@/lib/notifications";
import { formatDate, formatDateTime } from "@/lib/dates";
import { fullName, type LoqalUser } from "@/lib/auth";
import {
  INSPECTION_STATUS_LABEL,
  acceptInspection,
  downloadInspectionReport,
  updateInspection,
  uploadInspectionReport,
  type InspectionRequest,
} from "@/lib/inspections";

const input = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground";

export function InspectionJobs({ user, items, ready, refresh, compact = false }: { user: LoqalUser; items: InspectionRequest[]; ready: boolean; refresh: () => void; compact?: boolean }) {
  const { authUserId } = useAuth();
  const [category, setCategory] = useState("all");
  const [stage, setStage] = useState("all");
  const filtered = items.filter((i) => (category === "all" || i.propertyCategory === category) && (stage === "all" || (stage === "active" ? i.status === "accepted" || i.status === "scheduled" : stage === "reports" ? i.status === "report_uploaded" || i.status === "completed" : i.status === "open")));
  const open = filtered.filter((i) => i.status === "open");
  const mine = filtered.filter((i) => i.inspectorUserId === authUserId && i.status !== "open" && i.status !== "cancelled");
  const visibleOpen = compact ? open.slice(0, 3) : open;
  const visibleMine = compact ? mine.filter((r) => r.status === "accepted" || r.status === "scheduled").slice(0, 3) : mine;

  return (
    <div className="space-y-6">
      {!compact ? <div className="space-y-4"><div role="group" aria-label="Property type" className="flex flex-wrap gap-2">{([["all", "All property types"], ["house", "Houses"], ["apartment", "Apartments"], ["commercial", "Commercial"], ["land", "Land"]] as const).map(([id, label]) => <Button key={id} size="sm" variant={category === id ? "secondary" : "ghost"} aria-pressed={category === id} onClick={() => setCategory(id)}>{label}</Button>)}</div><label className="flex items-center gap-3 text-xs font-medium text-muted-foreground">Case stage<select aria-label="Case stage" value={stage} onChange={(e) => setStage(e.target.value)} className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"><option value="all">All stages</option><option value="open">New requests</option><option value="active">Scheduled & in progress</option><option value="reports">Reports & completed</option></select></label></div> : null}

      <section className="border-t border-border py-5">
        <h2 className="text-base font-semibold text-foreground">New inspection requests</h2>
        <div className="mt-4 space-y-3">
          {!ready ? <p className="text-sm text-muted-foreground">Loading…</p> : !visibleOpen.length ? <p className="text-sm text-muted-foreground">No new requests in this view.</p> : visibleOpen.map((r) => <OpenJob key={r.id} r={r} user={user} onDone={refresh} />)}
        </div>
      </section>

      <section className="border-t border-border py-5">
        <h2 className="text-base font-semibold text-foreground">{compact ? "Cases requiring follow-up" : "My inspection cases"}</h2>
        <div className="mt-4 space-y-3">
          {!ready ? <p className="text-sm text-muted-foreground">Loading…</p> : !visibleMine.length ? <p className="text-sm text-muted-foreground">No assigned cases in this view.</p> : visibleMine.map((r) => <MyJob key={r.id} r={r} onDone={refresh} />)}
        </div>
      </section>
    </div>
  );
}

function JobHead({ r }: { r: InspectionRequest }) {
  const deadline = r.agreementSignedAt && r.deadlineDays ? new Date(new Date(r.agreementSignedAt).getTime() + r.deadlineDays * 86400000).toISOString() : null;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{r.propertyLabel} <span className="font-normal text-muted-foreground">· {r.state}</span></p>
        <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand">{INSPECTION_STATUS_LABEL[r.status]}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">Buyer {r.clientLabel}{deadline ? ` · inspection period ends ${formatDate(deadline)}` : ""}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">{r.inspectionTypes.map((t) => <li key={t} className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] text-foreground">{t}</li>)}</ul>
    </>
  );
}

export function InspectionJobDetails({ r, user, onDone }: { r: InspectionRequest; user: LoqalUser; onDone: () => void }) {
  return r.status === "open" ? <OpenJob r={r} user={user} onDone={onDone} /> : <MyJob r={r} onDone={onDone} />;
}

function OpenJob({ r, user, onDone }: { r: InspectionRequest; user: LoqalUser; onDone: () => void }) {
  const [form, setForm] = useState(false);
  const [fee, setFee] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [busy, setBusy] = useState(false);
  async function accept() {
    if (!(Number(fee) > 0) || !date) { toast("Enter your fee and a proposed date."); return; }
    setBusy(true);
    try {
      const at = new Date(`${date}T${time}`).toISOString();
      await acceptInspection(r.id, Number(fee), at, { name: fullName(user), phone: user.phone ?? "", email: user.email });
      notify({ id: `inspection-accepted-${r.id}`, to: r.clientEmail, title: "An inspector accepted your inspection request", body: `${r.propertyLabel} — ${user.companyName || fullName(user)} proposed ${formatDateTime(at)} for $${Number(fee).toLocaleString("en-US")}.`, href: "/my-properties", severity: "info" });
      if (r.agentEmail) notify({ id: `inspection-accepted-agent-${r.id}`, to: r.agentEmail, title: "Inspector assigned to your buyer's file", body: `${r.propertyLabel} — ${user.companyName || fullName(user)}, proposed ${formatDateTime(at)}.`, href: `/partner?tab=buyers&focus=${r.leadId}`, severity: "info" });
      toast("Job accepted");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't accept"); onDone(); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <JobHead r={r} />
      {form ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_120px_auto] sm:items-end">
          <label className="text-xs text-muted-foreground">Total fee (USD)<input className={input} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value.replace(/[^\d.]/g, ""))} /></label>
          <label className="text-xs text-muted-foreground">Proposed date<DateInput value={date} onChange={setDate} /></label>
          <label className="text-xs text-muted-foreground">Time<input type="time" className={input} value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <Button size="sm" disabled={busy} onClick={accept}>{busy ? "Saving…" : "Confirm"}</Button>
        </div>
      ) : (
        <Button size="sm" onClick={() => setForm(true)} className="mt-3">Accept job</Button>
      )}
    </div>
  );
}

function MyJob({ r, onDone }: { r: InspectionRequest; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  async function confirmDate() {
    setBusy(true);
    try {
      await updateInspection(r.id, { status: "scheduled", scheduled_at: r.proposedAt });
      notify({ id: `inspection-scheduled-${r.id}`, to: r.clientEmail, title: "Your inspection is scheduled", body: `${r.propertyLabel} — ${r.proposedAt ? formatDateTime(r.proposedAt) : ""} with ${r.inspectorCompany}.`, href: "/my-properties", severity: "info" });
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }
  async function upload(file: File) {
    setBusy(true);
    try {
      await uploadInspectionReport(r, file);
      notify({ id: `inspection-report-${r.id}-${Date.now()}`, to: r.clientEmail, title: "Your inspection report is ready", body: `${r.propertyLabel} — ${r.inspectorCompany} uploaded the report. Review it with your agent before the inspection period ends.`, href: "/my-properties", severity: "info" });
      if (r.agentEmail) notify({ id: `inspection-report-agent-${r.id}-${Date.now()}`, to: r.agentEmail, title: "Inspection report uploaded", body: `${r.propertyLabel} — the buyer may ask for repairs or credits.`, href: `/partner?tab=buyers&focus=${r.leadId}`, severity: "warning" });
      toast("Report uploaded");
      onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload failed"); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-md border border-border bg-background p-4">
      <JobHead r={r} />
      <p className="mt-2 text-xs text-muted-foreground">Fee ${r.fee?.toLocaleString("en-US")} · {r.scheduledAt ? `scheduled ${formatDateTime(r.scheduledAt)}` : r.proposedAt ? `proposed ${formatDateTime(r.proposedAt)}` : ""}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {r.status === "accepted" ? <Button size="sm" disabled={busy} onClick={confirmDate}>Mark as scheduled</Button> : null}
        <Button variant="outline" size="sm" disabled={busy} onClick={() => fileInput.current?.click()}><Upload aria-hidden/> {r.reportFiles.length ? "Add another report file" : "Upload report"}</Button>
        <input ref={fileInput} aria-label="Inspection report file" type="file" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        {r.reportFiles.map((f) => <Button key={f.path} type="button" variant="ghost" size="sm" onClick={() => downloadInspectionReport(f).catch(() => toast.error("Download failed"))} className="text-xs text-brand"><Download className="h-3.5 w-3.5" aria-hidden /> {f.name}</Button>)}
      </div>
    </div>
  );
}
