import { useState } from "react";
import { Banknote, Check, CreditCard, Download, FileText, Info, Receipt, ShieldCheck, Wallet } from "lucide-react";
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
  const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'];
  const testConnected = clientToken?.startsWith("pk_test_");
  const previousPeriod = (() => {
    const [year = 2026, month = 1] = period.split("-").map(Number);
    return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 7);
  })();
  const previousGross = records.filter((r) => periodOf(r) === previousPeriod).reduce((sum, r) => sum + (r.fee ?? 0), 0);
  const change = previousGross ? ((gross - previousGross) / previousGross) * 100 : null;
  const sections = [["overview", "Overview"], ["transactions", "Transactions"], ["invoices", "Invoices & statements"], ["methods", "Payment methods"]] as const;
  const statusBadge = (r: InspectionRequest) => <span className="inline-flex rounded px-2 py-1 text-[9px] font-semibold uppercase text-brand bg-brand-tint">{INSPECTION_STATUS_LABEL[r.status]}</span>;
  const empty = (label: string) => <div className="py-10 text-center text-muted-foreground"><FileText className="mx-auto mb-3 size-6 opacity-50"/><p className="text-xs">{ready ? label : "Loading…"}</p></div>;
  const tableHead = "px-4 py-3 text-[9px] font-semibold uppercase text-muted-foreground";
  const tableCell = "px-4 py-3.5 text-[11px]";
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Review Loqal platform fees and manage accounting records.</p>
      <Button variant="outline" size="sm" disabled={!ready} onClick={() => void statement()}><Download/>Download current summary</Button>
    </div>
    <div role="tablist" aria-label="Accounting sections" className="flex gap-5 overflow-x-auto border-b border-border sm:gap-7">
      {sections.map(([id, label]) => <Button key={id} role="tab" aria-selected={id === tab} aria-controls={`accounting-${id}`} id={`accounting-tab-${id}`} size="sm" variant="ghost" className={`h-11 shrink-0 rounded-none border-b-2 px-0 text-xs hover:bg-transparent ${id === tab ? "border-brand text-brand" : "border-transparent text-muted-foreground"}`} onClick={() => setTab(id)}>{label}</Button>)}
    </div>
    <div role="status" className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><Info className="mt-0.5 size-3.5 shrink-0 text-brand"/><p>{testConnected ? "Payments connected in test mode. " : "Online collection is not yet available. "}Accounting amounts are quoted estimates; no confirmed balances, invoices or payouts are recorded.</p></div>
    {tab !== "methods" ? <div className="flex justify-end"><label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">Period<select aria-label="Accounting period" className="rounded-md border border-input bg-card px-2 py-1.5 text-[11px] text-foreground" value={period} onChange={(e) => setPeriod(e.target.value)}>{periods.map((p) => <option key={p} value={p}>{isoToUsMonth(p)}</option>)}</select></label></div> : null}
    <div role="tabpanel" id={`accounting-${tab}`} aria-labelledby={`accounting-tab-${tab}`}>
    {tab === "overview" ? <>
      <div className="mb-4 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Gross quoted fees", value: money(gross), icon: Banknote, note: change === null ? `${current.length} quoted inspection${current.length === 1 ? "" : "s"}` : `${change >= 0 ? "↑" : "↓"} ${Math.abs(change).toFixed(0)}% quoted vs previous month`, tone: "text-muted-foreground" },
          { title: "Loqal platform fee estimate", value: money(platformFee), icon: Receipt, note: "10% of quoted inspection fees", tone: "text-brand" },
          { title: "After estimated platform fee", value: money(gross - platformFee), icon: Check, note: "Quoted amount, not settled earnings", tone: "text-success" },
          { title: "Current amount due", value: "Not tracked", icon: FileText, note: "Awaiting confirmed billing records", tone: "text-warning" },
        ].map((m) => <div key={m.title} className="rounded-lg border border-border bg-card px-4 py-3.5">
          <div className="flex items-start justify-between gap-2"><span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand"><m.icon className="size-4"/></span><p className="break-words text-right text-xl font-bold leading-7">{ready ? m.value : "—"}</p></div>
          <h2 className="mt-3 text-[9px] font-semibold uppercase text-muted-foreground">{m.title}</h2><p className={`mt-1 text-[10px] ${m.tone}`}>{m.note}</p>
        </div>)}
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[1.35fr_.85fr]">
        <section className="bg-card">
          <header className="flex flex-wrap items-start justify-between gap-3 border-y border-border px-4 py-3.5"><div><h2 className="text-sm font-semibold">Fee activity</h2><p className="mt-1 text-[10px] text-muted-foreground">Inspection services and corresponding estimated platform fees.</p></div><Button variant="outline" size="sm" onClick={() => setTab("transactions")}>View all transactions</Button></header>
          <div className="px-4 py-4"><div className="mb-2 flex items-start gap-2.5 rounded-md border border-brand/10 bg-brand-tint px-3 py-2.5 text-[11px] leading-5 text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0 text-brand"/><p><strong className="text-brand">How Loqal fees work:</strong> the platform fee is 10% of the inspection fee, payable within 10 business days after inspection completion, subject to the Partner Agreement.</p></div>
            <div className="divide-y divide-border">{current.slice(0, 4).map((r) => <div key={r.id} className="flex items-start gap-3 py-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-gold-tint text-gold"><Receipt className="size-4"/></span><div className="min-w-0 flex-1"><Button variant="link" className="h-auto max-w-full justify-start whitespace-normal p-0 text-left text-xs font-semibold text-foreground" onClick={() => setSelectedId(r.id)}>{r.propertyLabel}</Button><p className="mt-1 text-[10px] text-muted-foreground">{r.inspectionTypes.join(" · ")}</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">Quote {money(r.fee ?? 0)} · Loqal fee estimate {money(fee(r))} · {formatDate(recordDate(r))}</p></div><div className="shrink-0">{statusBadge(r)}</div></div>)}</div>
            {!current.length ? empty("No quoted inspections in this period.") : null}
          </div>
          <footer className="flex flex-wrap justify-end gap-2 border-y border-border bg-background/50 px-4 py-3"><Button variant="outline" size="sm" onClick={() => setTab("methods")}>Payment method</Button><Button size="sm" disabled>Pay outstanding balance</Button></footer>
        </section>
        <section className="bg-card">
          <header className="border-y border-border px-4 py-3.5"><h2 className="text-sm font-semibold">Current statement</h2><p className="mt-1 text-[10px] text-muted-foreground">{isoToUsMonth(period)} · Estimate only</p></header>
          <div className="px-4 py-4"><p className="text-[28px] font-bold leading-9">{ready ? money(platformFee) : "—"}</p><p className="mb-4 mt-1 text-[11px] leading-5 text-muted-foreground">Estimated platform fee based on quoted services in the selected period. Not an amount due.</p>
            <dl className="border-t border-border pt-1 text-[11px]">{[["Gross quoted inspection fees", money(gross)], ["Loqal platform fee (10%)", `− ${money(platformFee)}`], ["After estimated platform fee", money(gross - platformFee)]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-2"><dt className="text-muted-foreground">{label}</dt><dd className="shrink-0 font-semibold">{value}</dd></div>)}<div className="mt-1 flex justify-between gap-3 border-t border-border py-3 font-semibold"><dt>Confirmed amount due</dt><dd className="text-muted-foreground">Not tracked</dd></div></dl>
            <Button size="sm" className="mt-2 w-full" disabled>Review and pay</Button><p className="mt-2 text-center text-[10px] text-muted-foreground">Fee collection is not available yet.</p>
          </div>
        </section>
      </div>
    </> : tab === "transactions" ? <section className="bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-y border-border px-4 py-4"><div><h2 className="text-sm font-semibold">All transactions</h2><p className="mt-1 text-[11px] text-muted-foreground">A detailed activity record of inspection quotes and estimated Loqal fees.</p></div><Button variant="outline" size="sm" disabled={!ready} onClick={exportCsv}><Download/>Export CSV</Button></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr>{["Date", "Inspection", "Gross service quote", "Loqal fee estimate", "Case status", ""].map((h) => <th key={h} className={tableHead}>{h}</th>)}</tr></thead><tbody className="divide-y divide-border border-t border-border">{current.map((r) => <tr key={r.id}><td className={tableCell}>{formatDate(recordDate(r))}</td><td className={`${tableCell} max-w-64`}><p className="font-semibold">{r.propertyLabel}</p><p className="mt-1 text-[10px] text-muted-foreground">{r.inspectionTypes.join(" · ")}</p></td><td className={tableCell}>{money(r.fee ?? 0)}</td><td className={tableCell}>{money(fee(r))}</td><td className={tableCell}>{statusBadge(r)}</td><td className={tableCell}><Button size="sm" variant="link" className="h-auto p-0 text-[11px]" onClick={() => setSelectedId(r.id)}>View details</Button></td></tr>)}</tbody></table></div>{!current.length ? empty("No records in this period.") : null}
    </section> : tab === "invoices" ? <section className="bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-y border-border px-4 py-4"><div><h2 className="text-sm font-semibold">Invoices & statements</h2><p className="mt-1 text-[11px] text-muted-foreground">Download monthly accounting summaries. No invoices have been issued.</p></div><Button variant="outline" size="sm" disabled={!ready} onClick={exportCsv}><Download/>Export current period</Button></header>
      <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left"><thead><tr>{["Statement period", "Document", "Gross quotes", "Loqal fee estimate", "Status", ""].map((h) => <th key={h} className={tableHead}>{h}</th>)}</tr></thead><tbody className="divide-y divide-border border-t border-border">{periods.map((p) => { const monthly = records.filter((r) => periodOf(r) === p); return <tr key={p}><td className={tableCell}>{isoToUsMonth(p)}</td><td className={tableCell}>Accounting summary</td><td className={tableCell}>{money(monthly.reduce((sum, r) => sum + (r.fee ?? 0), 0))}</td><td className={tableCell}>{money(monthly.reduce((sum, r) => sum + fee(r), 0))}</td><td className={tableCell}><span className="rounded bg-brand-tint px-2 py-1 text-[9px] font-semibold text-brand">ESTIMATE</span></td><td className={tableCell}><Button variant="link" size="sm" className="h-auto p-0 text-[11px]" disabled={!ready} onClick={() => void statement(p)}><Download className="size-3"/>Download PDF</Button></td></tr>; })}</tbody></table></div>
    </section> : <div className="grid items-start gap-4 lg:grid-cols-[1.35fr_.85fr]">
      <section className="bg-card"><header className="flex flex-wrap items-start justify-between gap-3 border-y border-border px-4 py-4"><div><h2 className="text-sm font-semibold">Payment methods</h2><p className="mt-1 text-[11px] text-muted-foreground">Saved methods for settling Loqal platform-fee statements.</p></div><Button variant="outline" size="sm" disabled><CreditCard/>Add payment method</Button></header><div className="px-4 py-5"><div className="flex items-center gap-3"><span className="flex h-8 w-11 items-center justify-center rounded-md bg-brand-tint text-brand"><CreditCard className="size-5"/></span><div><p className="text-xs font-semibold">No saved payment methods</p><p className="mt-1 text-[11px] text-muted-foreground">Payment-method setup is not available yet.</p></div></div><div className="mt-5 flex items-start gap-2 rounded-md bg-brand-tint px-3 py-3 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand"/><p><strong className="text-brand">Secure payments:</strong> no card or bank details are stored in Loqal’s accounting records.</p></div></div></section>
      <section className="bg-card"><header className="border-y border-border px-4 py-4"><h2 className="text-sm font-semibold">Payment preferences</h2><p className="mt-1 text-[11px] text-muted-foreground">Automatic settlement of open statements.</p></header><div className="px-4 py-4"><div className="flex items-center justify-between gap-3 border-b border-border pb-4"><span className="text-xs font-medium">Automatic payment</span><span className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">Not enabled</span></div><p className="mt-3 text-[11px] leading-5 text-muted-foreground">No automatic charges are enabled. Payment preferences will be available once fee collection is ready.</p></div></section>
    </div>}
    </div>
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Inspection fee details</DialogTitle><DialogDescription>Quoted fees and the linked inspection case</DialogDescription></DialogHeader>{selected ? <InspectionJobDetails key={selected.id} r={selected} user={user} onDone={refresh}/> : null}</DialogContent></Dialog>
  </div>;
}
