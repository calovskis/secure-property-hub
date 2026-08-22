/**
 * Admin "Cases & files": every mortgage file / buyer case on the platform in
 * one monitor — status, parties, and a detail view with all documents and
 * the full correspondence timeline (lender info requests, client questions,
 * decisions, kickoff notes).
 */
import { useMemo, useState } from "react";
import {
  KICKOFF_LABEL,
  LEAD_STATUS_LABEL,
  MORTGAGE_STAGE_LABEL,
  isMortgageFile,
  mortgageStage,
  useLeads,
  type MortgageLead,
} from "@/lib/leads";
import { formatDate, formatDateTime } from "@/lib/dates";
import { usd } from "@/lib/accounting";
import type { StoredDocument } from "@/lib/auth";

type TimelineItem = { at: string; who: string; what: string };

function documentsOf(lead: MortgageLead): { label: string; docs: StoredDocument[] }[] {
  const p = lead.profile;
  const groups: { label: string; docs: StoredDocument[] }[] = [];
  if (p.visaDocuments?.length) groups.push({ label: "Visa", docs: p.visaDocuments });
  if (p.idDocuments?.length) groups.push({ label: "ID / green card / passport", docs: p.idDocuments });
  if (p.bankruptcyDocuments?.length)
    groups.push({ label: "Bankruptcy discharge", docs: p.bankruptcyDocuments });
  const infoDocs = lead.infoRequests.flatMap((r) => r.documents);
  if (infoDocs.length) groups.push({ label: "Requested by lender", docs: infoDocs });
  return groups;
}

function timelineOf(lead: MortgageLead): TimelineItem[] {
  const items: TimelineItem[] = [
    { at: lead.submittedAt, who: lead.clientName, what: "Submitted the pre-approval inquiry" },
  ];
  for (const r of lead.infoRequests) {
    items.push({
      at: r.requestedAt,
      who: "Lender",
      what: `Requested ${r.needsDocument ? "a document" : "information"}: “${r.question}”`,
    });
    if (r.answeredAt)
      items.push({
        at: r.answeredAt,
        who: lead.clientName,
        what: `Answered: ${r.answer || `${r.documents.length} document(s) uploaded`}`,
      });
  }
  if (lead.decidedAt)
    items.push({
      at: lead.decidedAt,
      who: "Lender",
      what: `Decision: ${LEAD_STATUS_LABEL[lead.status]}${lead.lenderNote ? ` — ${lead.lenderNote}` : ""}`,
    });
  if (lead.terms)
    items.push({
      at: lead.terms.issuedAt,
      who: lead.terms.lenderName ?? "Lender",
      what: `Issued priced terms: ${lead.terms.ratePct}% · ${lead.terms.termYears}y · ${lead.terms.downPaymentPct}% down`,
    });
  for (const q of lead.clientQuestions ?? []) {
    items.push({ at: q.askedAt, who: lead.clientName, what: `Asked the lender: “${q.text}”` });
    if (q.answeredAt)
      items.push({ at: q.answeredAt, who: "Lender", what: `Replied: “${q.answer}”` });
  }
  if (lead.clientDecisionAt)
    items.push({
      at: lead.clientDecisionAt,
      who: lead.clientName,
      what: `Decision on terms: ${
        lead.clientDecision === "accepted"
          ? "Continuing"
          : lead.clientDecision === "hold"
            ? "Put on hold"
            : "Not continuing"
      }`,
    });
  const ba = lead.buyerAgent;
  if (ba?.agreedAt)
    items.push({ at: ba.agreedAt, who: lead.clientName, what: "Confirmed the buyer's agent agreement (3% at closing)" });
  if (ba?.representation)
    items.push({
      at: ba.assignedAt ?? ba.agreedAt,
      who: "System",
      what:
        ba.representation === "loqal_rep"
          ? "Representation: Loqal personal advocate (+1% fee)"
          : `Representation: buyer works directly with ${ba.agentName ?? "the buyer's agent"}`,
    });
  if (ba?.kickoff)
    items.push({
      at: ba.kickoffAt ?? ba.assignedAt ?? ba.agreedAt,
      who: lead.clientName,
      what: `Kickoff: ${KICKOFF_LABEL[ba.kickoff]}${ba.kickoffNotes ? ` — “${ba.kickoffNotes}”` : ""}`,
    });
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

function CaseDetail({ lead, onClose }: { lead: MortgageLead; onClose: () => void }) {
  const docs = documentsOf(lead);
  const timeline = timelineOf(lead);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`File of ${lead.clientName}`}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground">{lead.clientName}</h3>
            <p className="text-sm text-muted-foreground">
              {lead.propertyLabel} · {usd(lead.propertyPrice)} ·{" "}
              {lead.usPerson ? "US person" : "Non-US person"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Status" value={LEAD_STATUS_LABEL[lead.status]} />
          <Mini
            label="Stage"
            value={isMortgageFile(lead) ? MORTGAGE_STAGE_LABEL[mortgageStage(lead)] : "Pre-approval"}
          />
          <Mini label="Lender owner" value={lead.assignedToName ?? "Unassigned"} />
          <Mini
            label="Buyer's side"
            value={
              lead.buyerAgent?.representation === "loqal_rep"
                ? "Loqal advocate"
                : (lead.buyerAgent?.agentName ?? "—")
            }
          />
        </div>

        <h4 className="mt-6 text-sm font-semibold text-foreground">Documents on file</h4>
        {docs.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {docs.map((g) => (
              <div key={g.label} className="rounded-md border border-border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </div>
                <ul className="mt-1 space-y-1">
                  {g.docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">📎 {d.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(d.uploadedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <h4 className="mt-6 text-sm font-semibold text-foreground">Correspondence & history</h4>
        <ol className="mt-2 space-y-2 border-l-2 border-border pl-4">
          {timeline.map((t, i) => (
            <li key={i} className="text-sm">
              <span className="text-xs text-muted-foreground">{formatDateTime(t.at)}</span>
              <div>
                <strong className="text-foreground">{t.who}</strong>{" "}
                <span className="text-muted-foreground">{t.what}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function AdminCases() {
  const { leads } = useLeads();
  const [openId, setOpenId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "mortgages">("all");

  const rows = useMemo(() => {
    const sorted = [...leads].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    if (filter === "open")
      return sorted.filter((l) => l.status === "new" || l.status === "info_required");
    if (filter === "mortgages") return sorted.filter(isMortgageFile);
    return sorted;
  }, [leads, filter]);

  const open = rows.find((l) => l.id === openId) ?? leads.find((l) => l.id === openId);

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">All cases & files</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every inquiry and mortgage file on the platform — click a row to see documents and the
            full correspondence history.
          </p>
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["all", "All"],
              ["open", "Open requests"],
              ["mortgages", "Mortgage files"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${
                filter === id
                  ? "border-brand bg-brand text-background"
                  : "border-border text-muted-foreground hover:bg-brand-tint"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No files in this view yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Buyer</th>
                <th className="py-2 pr-4 font-semibold">Property</th>
                <th className="py-2 pr-4 font-semibold">Status</th>
                <th className="py-2 pr-4 font-semibold">Stage</th>
                <th className="py-2 pr-4 font-semibold">Lender owner</th>
                <th className="py-2 font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => setOpenId(l.id)}
                  className="cursor-pointer transition-colors hover:bg-brand-tint/40"
                >
                  <td className="py-3 pr-4 font-semibold text-foreground">{l.clientName}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {l.propertyLabel} · {usd(l.propertyPrice)}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        l.status === "qualified"
                          ? "bg-success/10 text-success"
                          : l.status === "not_qualified"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-brand-tint text-brand"
                      }`}
                    >
                      {LEAD_STATUS_LABEL[l.status]}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {isMortgageFile(l) ? MORTGAGE_STAGE_LABEL[mortgageStage(l)] : "—"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{l.assignedToName ?? "—"}</td>
                  <td className="py-3 text-muted-foreground">{formatDate(l.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? <CaseDetail lead={open} onClose={() => setOpenId(null)} /> : null}
    </section>
  );
}
