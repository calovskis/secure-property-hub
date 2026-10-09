import { useState } from "react";
import { Download, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InspectionJobDetails } from "@/components/partner/InspectionJobs";
import { formatDate, isoToUsMonth } from "@/lib/dates";
import { INSPECTION_STATUS_LABEL, type InspectionRequest } from "@/lib/inspections";
import type { LoqalUser } from "@/lib/auth";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
const recordDate = (r: InspectionRequest) => r.scheduledAt || r.proposedAt || r.createdAt;
const periodOf = (r: InspectionRequest) => recordDate(r).slice(0, 7);
const fee = (r: InspectionRequest) => Math.round((r.fee ?? 0) * 10) / 100;

export function InspectorAccounting({ user, items, ready, refresh }: { user: LoqalUser; items: InspectionRequest[]; ready: boolean; refresh: () => void }) {
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const records = items.filter((r) => r.status !== "cancelled" && r.fee != null);
  const periods = Array.from(new Set([new Date().toISOString().slice(0, 7), ...records.map(periodOf)])).sort().reverse();
  const current = records.filter((r) => periodOf(r) === period);
  const gross = current.reduce((sum, r) => sum + (r.fee ?? 0), 0);
  const platformFee = current.reduce((sum, r) => sum + fee(r), 0);
  const selected = records.find((r) => r.id === selectedId);
  function exportCsv() {
    const rows = [["Inspection ID", "Property", "Appointment or request date", "Gross quoted fee USD", "Estimated Loqal fee USD", "Inspection status", "Payment status"], ...current.map((r) => [r.id, r.propertyLabel, formatDate(recordDate(r)), String(r.fee), fee(r).toFixed(2), INSPECTION_STATUS_LABEL[r.status], "Not tracked"])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `Loqal-accounting-${period}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  async function statement(month = period) {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const rows = records.filter((r) => periodOf(r) === month);
    doc.setFontSize(18); doc.text("LOQAL - Accounting summary", 15, 20);
    doc.setFontSize(10); doc.text(`${user.companyName || `${user.firstName} ${user.lastName}`} | ${isoToUsMonth(month)}`, 15, 30);
    doc.text("Estimate based on quoted inspection fees. Not an invoice or payment receipt.", 15, 40);
    let y = 55;
    for (const r of rows) {
      const lines = doc.splitTextToSize(`${r.propertyLabel} | ${formatDate(recordDate(r))} | Quote ${money(r.fee ?? 0)} | Estimated Loqal fee ${money(fee(r))}`, 175);
      if (y + lines.length * 6 > 265) { doc.addPage(); y = 20; }
      doc.text(lines, 15, y); y += lines.length * 6 + 5;
    }
    if (y > 245) { doc.addPage(); y = 20; }
    doc.text(`Total quoted fees: ${money(rows.reduce((s, r) => s + (r.fee ?? 0), 0))}`, 15, y + 10);
    doc.text(`Estimated Loqal fees (10%): ${money(rows.reduce((s, r) => s + fee(r), 0))}`, 15, y + 18);
    doc.text("Payment status and outstanding balance: not tracked. No payout is recorded.", 15, y + 26);
    doc.save(`Loqal-accounting-${month}.pdf`);
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Inspection fees, Loqal platform fees and accounting records</p><Button variant="outline" size="sm" disabled={!ready} onClick={() => void statement()}><Download/>Download summary</Button></div>
    <div role="group" aria-label="Accounting sections" className="flex flex-wrap gap-2 border-b border-border pb-3">{([["overview", "Overview"], ["transactions", "Transactions"], ["invoices", "Invoices & statements"], ["methods", "Payment methods"]] as const).map(([id, label]) => <Button key={id} size="sm" variant="ghost" aria-pressed={id === tab} className={id === tab ? "bg-brand-tint text-brand" : "text-muted-foreground"} onClick={() => setTab(id)}>{label}</Button>)}</div>
    <p role="status" className="rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">Online payments are not connected. Amounts below are estimates, not confirmed revenue, invoices, outstanding balances or payouts.</p>
    {tab !== "methods" ? <label className="flex items-center gap-3 text-xs font-medium text-muted-foreground">Period<select aria-label="Accounting period" className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground" value={period} onChange={(e) => setPeriod(e.target.value)}>{periods.map((p) => <option key={p} value={p}>{isoToUsMonth(p)}</option>)}</select></label> : null}
    {tab === "overview" ? <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[{ title: "Gross quoted fees", value: money(gross), icon: Wallet }, { title: "Estimated Loqal fees", value: money(platformFee), icon: Receipt }, { title: "After estimated platform fee", value: money(gross - platformFee), icon: Wallet }, { title: "Confirmed amount due", value: "Not available", icon: Receipt }].map((m) => <div key={m.title} className="rounded-lg border border-border bg-card p-4"><m.icon className="size-4 text-brand"/><p className="mt-3 break-words text-xl font-semibold text-foreground">{ready ? m.value : "—"}</p><h2 className="mt-2 text-xs text-muted-foreground">{m.title}</h2></div>)}</div>
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]"><section><div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3"><h2 className="text-sm font-semibold">Fee activity</h2><Button variant="ghost" size="sm" onClick={() => setTab("transactions")}>View all transactions</Button></div><p className="my-4 text-xs leading-5 text-muted-foreground">Loqal’s platform fee is 10% of the inspection fee under the Partner Agreement, payable within 10 business days after inspection completion. Dates below are appointments or request dates, not verified completion dates.</p><div className="divide-y divide-border">{current.slice(0, 4).map((r) => <div key={r.id} className="flex flex-wrap items-center gap-3 py-4"><Receipt className="size-4 text-brand"/><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{r.propertyLabel}</p><p className="mt-1 text-[11px] text-muted-foreground">Quoted {money(r.fee ?? 0)} · Estimated Loqal fee {money(fee(r))}</p></div><Button variant="outline" size="sm" onClick={() => setSelectedId(r.id)}>Details</Button></div>)}</div>{!current.length ? <p className="py-8 text-sm text-muted-foreground">{ready ? "No quoted inspections in this period." : "Loading…"}</p> : null}</section><aside className="rounded-lg border border-border bg-card p-5"><h2 className="text-sm font-semibold">Current summary</h2><p className="mt-1 text-xs text-muted-foreground">{isoToUsMonth(period)} · Estimate only</p><p className="my-5 text-3xl font-bold">{ready ? money(platformFee) : "—"}</p><dl className="space-y-3 text-xs"><div className="flex justify-between gap-2"><dt className="text-muted-foreground">Gross quoted inspection fees</dt><dd>{money(gross)}</dd></div><div className="flex justify-between gap-2"><dt className="text-muted-foreground">Estimated Loqal fee (10%)</dt><dd>{money(platformFee)}</dd></div><div className="flex justify-between gap-2 border-t border-border pt-3"><dt className="text-muted-foreground">Confirmed balance</dt><dd>Not tracked</dd></div></dl><Button className="mt-5 w-full" size="sm" disabled>Payment collection unavailable</Button></aside></div>
    </> : tab === "transactions" ? <section><div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Inspection fee records</h2><Button variant="outline" size="sm" disabled={!ready} onClick={exportCsv}><Download/>Export CSV</Button></div><div className="overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[720px] text-left text-xs"><thead className="bg-muted/30 text-muted-foreground"><tr>{["Date", "Inspection", "Gross quote", "Estimated Loqal fee", "Case status", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{current.map((r) => <tr key={r.id}><td className="px-4 py-4">{formatDate(recordDate(r))}</td><td className="max-w-64 px-4 py-4"><p className="font-medium">{r.propertyLabel}</p><p className="mt-1 text-[11px] text-muted-foreground">{r.inspectionTypes.join(", ")}</p></td><td className="px-4 py-4">{money(r.fee ?? 0)}</td><td className="px-4 py-4">{money(fee(r))}</td><td className="px-4 py-4">{INSPECTION_STATUS_LABEL[r.status]}</td><td className="px-4 py-4"><Button size="sm" variant="ghost" onClick={() => setSelectedId(r.id)}>Details</Button></td></tr>)}</tbody></table>{!current.length ? <p className="p-8 text-center text-sm text-muted-foreground">{ready ? "No records in this period." : "Loading…"}</p> : null}</div></section> : tab === "invoices" ? <section><h2 className="text-sm font-semibold">Accounting summaries</h2><p className="mt-2 text-xs text-muted-foreground">No invoices have been issued. Download estimated monthly summaries for your records.</p><div className="mt-4 divide-y divide-border">{periods.map((p) => <div key={p} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm font-medium">{isoToUsMonth(p)}</p><p className="mt-1 text-xs text-muted-foreground">Accounting summary · Not an invoice</p></div><Button variant="outline" size="sm" disabled={!ready} onClick={() => void statement(p)}><Download/>Download PDF</Button></div>)}</div></section> : <section className="grid gap-6 lg:grid-cols-2"><div><h2 className="text-sm font-semibold">Payment methods</h2><p className="mt-3 text-sm text-muted-foreground">No payment provider is connected. Card and bank details cannot be added yet.</p><Button variant="outline" size="sm" disabled className="mt-4">Add payment method</Button></div><div><h2 className="text-sm font-semibold">Payment preferences</h2><div className="mt-4 flex items-center justify-between gap-3 border-b border-border pb-4"><p className="text-xs text-muted-foreground">Automatic payment</p><Button variant="outline" size="sm" disabled>Not available</Button></div><p className="mt-3 text-xs text-muted-foreground">No automatic charges are enabled.</p></div></section>}
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Inspection fee details</DialogTitle><DialogDescription>Quoted fees and the linked inspection case</DialogDescription></DialogHeader>{selected ? <InspectionJobDetails key={selected.id} r={selected} user={user} onDone={refresh}/> : null}</DialogContent></Dialog>
  </div>;
}
