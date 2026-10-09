/**
 * Inspection company workspace: open requests in the states they cover, and
 * their accepted jobs through scheduling to report upload.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
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
  useInspectionRequests,
  type InspectionRequest,
} from "@/lib/inspections";

const input = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground";

export function InspectionJobs({ user }: { user: LoqalUser }) {
  const { items, ready, refresh } = useInspectionRequests();
  const open = items.filter((i) => i.status === "open");
  const mine = items.filter((i) => i.inspectorUserId && i.status !== "open" && i.status !== "cancelled");
  const scheduled = mine.filter((i) => i.status === "scheduled").length;
  const reportsDue = mine.filter((i) => i.status === "accepted" || i.status === "scheduled").length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {([["Open requests", open.length, "In the states you cover"], ["Scheduled", scheduled, "Inspection date set"], ["Reports due", reportsDue, "Upload once inspected"]] as const).map(([l, v, n]) => (
          <div key={l} className="rounded-lg border border-border bg-card p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="mt-2 text-3xl font-bold text-brand">{v}</div>
            <div className="mt-2 text-xs text-muted-foreground">{n}</div>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">New inspection requests</h2>
        <p className="mt-1 text-xs text-muted-foreground">From signed purchase agreements in your coverage areas. The first company to accept gets the job.</p>
        <div className="mt-4 space-y-3">
          {!ready ? <p className="text-sm text-muted-foreground">Loading…</p> : open.length === 0 ? <p className="text-sm text-muted-foreground">No open requests right now — new ones appear here and in your notifications.</p> : open.map((r) => <OpenJob key={r.id} r={r} user={user} onDone={refresh} />)}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">My inspection jobs</h2>
        <div className="mt-4 space-y-3">
          {mine.length === 0 ? <p className="text-sm text-muted-foreground">Jobs you accept appear here.</p> : mine.map((r) => <MyJob key={r.id} r={r} onDone={refresh} />)}
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
      notify({ id: `inspection-accepted-${r.id}`, to: r.clientEmail, title: "An inspector accepted your inspection request", body: `${r.propertyLabel} — ${user.companyName || fullName(user)} proposed ${formatDateTime(at)} for $${Number(fee).toLocaleString("en-US")}.`, href: "/my-properties", severity: "success" });
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
          <button type="button" disabled={busy} onClick={accept} className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-background disabled:opacity-60">{busy ? "Saving…" : "Confirm"}</button>
        </div>
      ) : (
        <button type="button" onClick={() => setForm(true)} className="mt-3 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background">Accept job</button>
      )}
    </div>
  );
}

function MyJob({ r, onDone }: { r: InspectionRequest; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
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
      notify({ id: `inspection-report-${r.id}-${Date.now()}`, to: r.clientEmail, title: "Your inspection report is ready", body: `${r.propertyLabel} — ${r.inspectorCompany} uploaded the report. Review it with your agent before the inspection period ends.`, href: "/my-properties", severity: "success" });
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
        {r.status === "accepted" ? <button type="button" disabled={busy} onClick={confirmDate} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background">Mark as scheduled</button> : null}
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground">
          <Upload className="h-3.5 w-3.5" aria-hidden /> {r.reportFiles.length ? "Add another report file" : "Upload report"}
          <input type="file" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        </label>
        {r.reportFiles.map((f) => <button key={f.path} type="button" onClick={() => downloadInspectionReport(f).catch(() => toast.error("Download failed"))} className="inline-flex items-center gap-1 text-xs font-semibold text-brand"><Download className="h-3.5 w-3.5" aria-hidden /> {f.name}</button>)}
      </div>
    </div>
  );
}
