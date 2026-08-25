import { useEffect, useMemo, useState } from "react";
import {
  computeDti,
  totalMonthlyObligations,
  LEAD_STATUS_LABEL,
  MORTGAGE_STAGE_LABEL,
  isOpenRequest,
  leadCity,
  leadState,
  mortgageStage,
  useLeads,
  type LeadStatus,
  type MortgageLead,
} from "@/lib/leads";
import { useAuth } from "@/lib/auth";

import { ApplicantFile, Row } from "@/components/lender/ApplicantFile";
import { countryLabel } from "@/data/countries";
import { formatDate, formatDateTime } from "@/lib/dates";

import { LENDER_ROLE_LABEL, useLenderTeam } from "@/lib/lender-team";
import { usStatusOf, US_STATUS_LABEL, isMajorityForeignIncome } from "@/lib/mortgage-form";
import { LenderHome } from "@/components/lender/LenderHome";
import { LenderAnalytics } from "@/components/lender/LenderAnalytics";
import { LenderAccounting } from "@/components/lender/LenderAccounting";
import { LenderMortgages } from "@/components/lender/LenderMortgages";
import { LenderTeam } from "@/components/lender/LenderTeam";
import { LenderEmployees } from "@/components/lender/LenderEmployees";
import { InfoRequestDialog } from "@/components/lender/InfoRequestDialog";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const date = (iso?: string) => formatDateTime(iso);

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "bg-gold-tint text-gold",
  info_required: "bg-brand-tint text-brand",
  not_qualified: "bg-destructive/10 text-destructive",
  qualified: "bg-success/10 text-success",
  annulled: "bg-muted text-muted-foreground",
};

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${STATUS_TONE[status]}`}
    >
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}

function Step2Summary({ lead }: { lead: MortgageLead }) {
  if (!lead.debts) return null;
  const obligations = totalMonthlyObligations(lead.debts);
  const dti = computeDti({
    monthlyIncome: lead.profile.monthlyGross,
    obligations,
    dtiLimit: lead.dtiLimit,
    listPrice: lead.propertyPrice,
  });
  return (
    <section className="rounded-lg border border-border bg-brand-tint/30 p-4">
      <h3 className="text-sm font-semibold text-foreground">
        Step 2 — affordability (client submitted)
      </h3>
      <div className="mt-2 divide-y divide-border">
        <Row label="Property loan payments" value={money(lead.debts.propertyLoans)} />
        <Row label="Vehicle loan payments" value={money(lead.debts.vehicleLoans)} />
        <Row label="Insurance costs" value={money(lead.debts.insurance)} />
        {lead.debts.other.map((o) => (
          <Row key={o.id} label={o.label || "Other obligation"} value={money(o.amount)} />
        ))}
        <Row label="Total monthly obligations" value={money(obligations)} />
        <Row label="DTI ceiling applied" value={`${Math.round(dti.dtiLimit * 100)}%`} />
        <Row label="Max purchase price" value={money(dti.maxPurchasePrice)} />
        <Row
          label="DTI at list price"
          value={`${Math.round(dti.dtiAtListPrice * 100)}% · ${
            dti.qualifiesAtListPrice ? "within policy" : "over policy"
          }`}
        />
      </div>
    </section>
  );
}

function DecisionPanel({ lead }: { lead: MortgageLead }) {
  const { updateLead, addInfoRequest } = useLeads();
  const { user } = useAuth();
  /** Company name and NMLS come from the partner's registration; lenders cannot edit them. */
  const lenderName = user?.companyName?.trim() || "";
  const lenderNmls = user?.lenderLicence?.trim() || "";
  /** No SSN → no US credit file: no soft score and no DTI ceiling is issued. */
  const hasSsn = Boolean(lead.profile.ssn?.trim());
  const [score, setScore] = useState(lead.creditScore ? String(lead.creditScore) : "");
  const [note, setNote] = useState(lead.lenderNote ?? "");
  const [dtiLimit, setDtiLimit] = useState(String(Math.round(lead.dtiLimit * 100)));
  const [ratePct, setRatePct] = useState(lead.terms ? String(lead.terms.ratePct) : "");
  const [termYears, setTermYears] = useState(lead.terms ? String(lead.terms.termYears) : "30");
  const [downPct, setDownPct] = useState(lead.terms ? String(lead.terms.downPaymentPct) : "");
  const [closingPct, setClosingPct] = useState(
    lead.terms ? String(lead.terms.closingCostPct) : "2.5",
  );
  const [taxInsPct, setTaxInsPct] = useState(
    lead.terms ? String(lead.terms.taxInsurancePct) : "1.45",
  );
  const [infoOpen, setInfoOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function decide(status: LeadStatus) {
    const parsed = Number(score);
    if (hasSsn && (!parsed || parsed < 300 || parsed > 850)) {
      setError("A soft credit report score between 300 and 850 is required with every decision.");
      return;
    }
    const rate = Number(ratePct);
    const years = Number(termYears);
    const down = Number(downPct);
    const closing = Number(closingPct);
    const taxIns = Number(taxInsPct);
    if (status === "qualified") {
      if (!lenderName || !lenderNmls) {
        setError(
          "Your partner profile is missing the registered company name or NMLS number. Please complete partner registration before issuing terms.",
        );
        return;
      }
      const valid =
        rate > 0 &&
        rate < 25 &&
        years >= 5 &&
        years <= 40 &&
        down >= 0 &&
        down < 100 &&
        closing >= 0 &&
        closing < 20 &&
        taxIns >= 0 &&
        taxIns < 10;
      if (!valid) {
        setError(
          "Approved pricing is required to unlock the client estimate: interest rate, loan term, down payment, closing costs and tax/insurance rate.",
        );
        return;
      }
    }
    setError(null);
    const limit = Math.min(Math.max(Number(dtiLimit) || 50, 20), 60) / 100;
    updateLead(lead.id, {
      status,
      ...(hasSsn && parsed ? { creditScore: parsed } : {}),
      lenderNote: note.trim(),
      dtiLimit: limit,
      decidedAt: new Date().toISOString(),
      ...(status === "qualified"
        ? {
            terms: {
              lenderName,
              lenderNmls,
              ratePct: rate,
              termYears: years,
              downPaymentPct: down,
              closingCostPct: closing,
              taxInsurancePct: taxIns,
              issuedAt: new Date().toISOString(),
            },
          }
        : {}),
    });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Pre-qualification feedback</h3>
      {hasSsn ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Soft credit report score <span className="text-destructive">*</span>
            </span>
            <input
              inputMode="numeric"
              placeholder="720"
              value={score}
              onChange={(e) => setScore(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              DTI ceiling for this applicant (%)
            </span>
            <input
              inputMode="numeric"
              value={dtiLimit}
              onChange={(e) => setDtiLimit(e.target.value)}
              className={inputClass}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Default policy is 50%; adjust for applicant-specific criteria.
            </span>
          </label>
        </div>
      ) : (
        <p className="rounded-md border border-border bg-brand-tint/40 px-3 py-2 text-xs text-muted-foreground">
          This applicant has no SSN — no US credit file exists, so no soft credit report score or
          DTI ceiling is issued. The client feedback shows terms only.
        </p>
      )}

      <div className="rounded-md border border-gold/40 bg-gold-tint/40 p-3">
        <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Approved pricing (required for “Qualified” — unlocks the client estimate)
        </span>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              Lending company name (shown to the client)
            </span>
            <input
              value={lenderName}
              onChange={(e) => setLenderName(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
              Company NMLS № (shown to the client)
            </span>
            <input
              placeholder="NMLS #2481907"
              value={lenderNmls}
              onChange={(e) => setLenderNmls(e.target.value)}
              className={inputClass}
            />
          </label>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {(
            [
              ["Interest rate (%)", ratePct, setRatePct, "6.75"],
              ["Loan term (years)", termYears, setTermYears, "30"],
              ["Down payment (%)", downPct, setDownPct, "20"],
              ["Closing costs (%)", closingPct, setClosingPct, "2.5"],
              ["Taxes + insurance (%/yr)", taxInsPct, setTaxInsPct, "1.45"],
            ] as [string, string, (v: string) => void, string][]
          ).map(([label, value, setter, ph]) => (
            <label key={label} className="block">
              <span className="mb-1.5 block text-[11px] font-semibold text-muted-foreground">
                {label}
              </span>
              <input
                inputMode="decimal"
                placeholder={ph}
                value={value}
                onChange={(e) => setter(e.target.value)}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Note to Loqal / client
        </span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </label>

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide("qualified")}
          className="rounded-md bg-success px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90"
        >
          Qualified
        </button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setInfoOpen(true);
          }}
          className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
        >
          Information request
        </button>
        <button
          type="button"
          onClick={() => decide("not_qualified")}
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
        >
          Not qualified
        </button>
      </div>

      <InfoRequestDialog
        lead={lead}
        open={infoOpen}
        onOpenChange={setInfoOpen}
        onSend={(question, needsDocument) => addInfoRequest(lead.id, question, needsDocument)}
      />
    </div>
  );
}

function Thread({ lead }: { lead: MortgageLead }) {
  if (lead.infoRequests.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">
        Case communication (saved under this property)
      </h3>
      <ul className="mt-2 space-y-3">
        {lead.infoRequests.map((r) => (
          <li key={r.id} className="rounded-md border border-border bg-background p-3 text-sm">
            <div className="font-semibold text-foreground">You asked</div>
            <p className="text-muted-foreground">{r.question}</p>
            <div className="mt-1 text-[11px] text-muted-foreground">{date(r.requestedAt)}</div>
            {r.answeredAt ? (
              <div className="mt-3 rounded-md bg-brand-tint/40 p-3">
                <div className="font-semibold text-foreground">Client replied</div>
                <p className="text-muted-foreground">{r.answer || "(no written answer)"}</p>
                {r.documents.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {r.documents.map((d) => (
                      <li key={d.id} className="text-xs text-brand">
                        📎 {d.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-1 text-[11px] text-muted-foreground">{date(r.answeredAt)}</div>
              </div>
            ) : (
              <div className="mt-2 text-xs font-semibold text-gold">Awaiting client response</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One key-fact cell in the compact request row. */
function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

/** Assign the inquiry to a licensed member of the lender company. */
function AssignBar({ lead }: { lead: MortgageLead }) {
  const { updateLead } = useLeads();
  const { members, coversState } = useLenderTeam();
  const state = leadState(lead);
  const eligible = members.filter((m) => m.allStates || m.states.includes(state));

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-brand-tint/30 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Assigned reviewer
      </span>
      <select
        value={lead.assignedToId ?? ""}
        onChange={(e) => {
          const member = members.find((m) => m.id === e.target.value);
          updateLead(
            lead.id,
            member
              ? {
                  assignedToId: member.id,
                  assignedToName: member.name,
                  assignedAt: new Date().toISOString(),
                }
              : { assignedToId: undefined, assignedToName: undefined, assignedAt: undefined },
          );
        }}
        className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
      >
        <option value="">Unassigned</option>
        {eligible.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} · {LENDER_ROLE_LABEL[m.role]}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">
        Process status:{" "}
        <strong className="text-foreground">
          {lead.status === "qualified"
            ? MORTGAGE_STAGE_LABEL[mortgageStage(lead)]
            : LEAD_STATUS_LABEL[lead.status]}
        </strong>
        {lead.assignedAt ? ` · assigned ${date(lead.assignedAt)}` : ""}
      </span>
      {!coversState(state) ? (
        <span className="text-[11px] text-gold">Your seat is not licensed in {state}.</span>
      ) : null}
    </div>
  );
}

function RequestsInbox({
  canDecide,
  focusLeadId,
}: {
  canDecide: boolean;
  focusLeadId?: string | null;
}) {
  const { leads: allLeads } = useLeads();
  const { scopedStates } = useLenderTeam();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"open" | "past">("open");
  const [filter, setFilter] = useState<LeadStatus | "all">("all");
  const [state, setState] = useState<string>("all");

  // Seats limited to specific states only ever see work located there.
  const leads = useMemo(
    () => (scopedStates ? allLeads.filter((l) => scopedStates.includes(leadState(l))) : allLeads),
    [allLeads, scopedStates],
  );

  const hiddenByScope = allLeads.length - leads.length;

  // Opening a file from the dashboard jumps straight to it, in the right list.
  useEffect(() => {
    if (!focusLeadId) return;
    const lead = leads.find((l) => l.id === focusLeadId);
    if (!lead) return;
    setView(isOpenRequest(lead) ? "open" : "past");
    setFilter("all");
    setState("all");
    setSelectedId(focusLeadId);
  }, [focusLeadId, leads]);

  const states = useMemo(() => Array.from(new Set(leads.map(leadState))).sort(), [leads]);

  const pool = useMemo(
    () => leads.filter((l) => (view === "open" ? isOpenRequest(l) : !isOpenRequest(l))),
    [leads, view],
  );

  const visible = useMemo(
    () =>
      pool
        .filter((l) => (view === "past" && filter !== "all" ? l.status === filter : true))
        .filter((l) => (state === "all" ? true : leadState(l) === state)),
    [pool, filter, state, view],
  );
  const selected = selectedId ? visible.find((l) => l.id === selectedId) : undefined;

  const counts = useMemo(
    () => ({
      new: leads.filter((l) => l.status === "new").length,
      info: leads.filter((l) => l.status === "info_required").length,
      qualified: leads.filter((l) => l.status === "qualified").length,
      past: leads.filter((l) => !isOpenRequest(l)).length,
    }),
    [leads],
  );

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground md:text-[30px]">Pre-approval requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the client file, run your own underwriting, then return a decision with the soft
          credit score. Decided files move to past pre-approval requests.
        </p>
      </div>

      {hiddenByScope > 0 ? (
        <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
          {hiddenByScope} {hiddenByScope === 1 ? "request is" : "requests are"} outside your
          licensed state coverage and hidden from this seat. A portal admin can widen your state
          scope in Other → Team.
        </div>
      ) : null}

      {counts.new > 0 ? (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-gold/40 bg-gold-tint px-4 py-3">
          <span className="text-lg">🔔</span>
          <p className="text-sm font-semibold text-foreground">
            {counts.new} new incoming {counts.new === 1 ? "inquiry" : "inquiries"} awaiting your
            pre-qualification feedback.
          </p>
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          ["New inquiries", String(counts.new), "Pinned for immediate review"],
          ["Awaiting client info", String(counts.info), "Documents or answers requested"],
          ["Past requests", String(counts.past), "Qualified or declined — decision issued"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 text-3xl font-bold text-brand">{value}</div>
            <div className="mt-2 text-xs text-muted-foreground">{note}</div>
          </div>
        ))}
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ["open", `Open requests (${leads.filter(isOpenRequest).length})`],
            ["past", `Past pre-approval requests (${counts.past})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setView(id);
              setSelectedId(null);
              setFilter("all");
            }}
            className={`rounded-md px-4 py-2 text-xs font-semibold ${
              view === id
                ? "bg-brand text-background"
                : "border border-border text-muted-foreground hover:bg-brand-tint"
            }`}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          State
          <select
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setSelectedId(null);
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
          >
            <option value="all">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selected ? (
        <section className="space-y-6">
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-brand-tint"
          >
            ← Back to {view === "open" ? "open requests" : "past requests"}
          </button>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Pre-approval application — {selected.clientName}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selected.propertyLabel}
                  {selected.creditScore ? ` · soft score ${selected.creditScore}` : ""}
                </p>
              </div>
              <StatusPill status={selected.status} />
            </div>
            {selected.status === "annulled" ? (
              <div className="rounded-md border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">
                <strong className="text-foreground">Annulled by the client</strong>
                {selected.annulledAt ? ` on ${date(selected.annulledAt)}` : ""}. This application can
                no longer be assigned and no feedback can be issued. If the client resubmits, it will
                reappear as a new inquiry.
              </div>
            ) : (
              <AssignBar lead={selected} />
            )}
            <div className="mt-4">
              <a
                href={`/lender/file/${selected.id}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs font-semibold text-brand hover:bg-brand-tint"
              >
                Open full applicant file ↗
              </a>
            </div>
          </div>

          {selected.debts ? <Step2Summary lead={selected} /> : null}
          <Thread lead={selected} />
          {selected.status === "annulled" ? (
            <div className="rounded-lg border border-border bg-muted/60 p-4 text-sm text-muted-foreground">
              The client annulled this application before it was picked up, so no decision can be
              issued.
            </div>
          ) : selected.status === "not_qualified" ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              Marked not qualified
              {selected.creditScore ? ` (score ${selected.creditScore})` : ""}. This decision is
              final for this application.
            </div>
          ) : selected.status === "qualified" ? (
            <div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
              <div className="font-semibold text-success">
                Qualified with priced terms
                {selected.terms
                  ? ` — ${selected.terms.ratePct}% · ${selected.terms.termYears}y · ${selected.terms.downPaymentPct}% down`
                  : ""}
                .
              </div>
              <p className="mt-1 text-muted-foreground">
                {MORTGAGE_STAGE_LABEL[mortgageStage(selected)]} — this file is tracked under
                Mortgages.
              </p>
            </div>
          ) : canDecide ? (
            <DecisionPanel key={selected.id} lead={selected} />
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Your seat can review this file but cannot issue a decision. Ask an underwriter or
              company admin to sign off.
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-lg border border-border bg-card">
          {view === "past" ? (
            <div className="flex flex-wrap gap-1.5 border-b border-border p-4">
              {(["all", "qualified", "not_qualified", "annulled"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    filter === f
                      ? "bg-brand text-background"
                      : "border border-border text-muted-foreground hover:bg-brand-tint"
                  }`}
                >
                  {f === "all" ? "All" : LEAD_STATUS_LABEL[f]}
                </button>
              ))}
            </div>
          ) : null}

          {visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              No applications in this view yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className="grid w-full grid-cols-1 gap-3 p-4 text-left transition-colors hover:bg-brand-tint/40 md:grid-cols-[1.25fr_1fr_0.8fr_0.9fr_1.1fr_1.25fr] md:items-start"
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">{l.clientName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Submitted {date(l.submittedAt)}
                      </div>
                    </div>

                    <Cell label="State & city of interest">
                      {leadCity(l)}, {leadState(l)}
                    </Cell>
                    <Cell label="Requested price">{money(l.propertyPrice)}</Cell>
                    <Cell label="US status">
                      <span className="block">
                        {US_STATUS_LABEL[usStatusOf(l.profile, l.usPerson)]}
                      </span>
                      {isMajorityForeignIncome(l.profile.incomes ?? []) ? (
                        <span className="mt-1 block w-fit rounded-full bg-gold-tint px-1.5 py-0.5 text-[10px] font-semibold text-gold underline decoration-gold decoration-2 underline-offset-2">
                          Foreign income
                        </span>
                      ) : null}
                    </Cell>
                    <Cell label="Citizenship">
                      {l.usPerson
                        ? "US citizen / green card"
                        : [
                            countryLabel(l.profile.citizenship),
                            countryLabel(l.profile.secondCitizenship),
                          ]
                            .filter(Boolean)
                            .join(" / ") || "Non-US person"}
                    </Cell>

                    <div className="flex min-w-0 flex-col items-start gap-1">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Process status / assignee
                      </div>
                      <StatusPill status={l.status} />
                      {l.assignedToName ? (
                        <span className="text-[11px] text-muted-foreground">
                          {l.status === "qualified"
                            ? MORTGAGE_STAGE_LABEL[mortgageStage(l)]
                            : LEAD_STATUS_LABEL[l.status]}{" "}
                          · {l.assignedToName}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-gold">Unassigned</span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

export const TABS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "requests", label: "Pre-approval Requests", icon: "📥" },
  { id: "mortgages", label: "Mortgages", icon: "🏦" },
  { id: "employees", label: "Employees", icon: "👥" },
  { id: "analytics", label: "Analytics", icon: "📈" },
  { id: "accounting", label: "Accounting", icon: "💵" },
  { id: "other", label: "Other", icon: "⚙️" },
] as const;

export type LenderTabId = (typeof TABS)[number]["id"];
type TabId = LenderTabId;

export function useLenderTabs() {
  const { can } = useLenderTeam();
  const allowed: Record<TabId, boolean> = {
    home: true,
    requests: can("requests.view"),
    mortgages: can("mortgages.view"),
    employees: true,
    analytics: can("analytics.view"),
    accounting: can("accounting.view"),
    other: true,
  };
  return TABS.filter((t) => allowed[t.id]);
}

export function LenderPortal({
  lenderName,
  tab: tabProp,
  onTabChange,
}: {
  lenderName: string;
  tab?: TabId;
  onTabChange?: (tab: TabId) => void;
}) {
  const [tabState, setTabState] = useState<TabId>("home");
  const [focusLeadId, setFocusLeadId] = useState<string | null>(null);
  const tab = tabProp ?? tabState;
  const setTab = onTabChange ?? setTabState;
  const { active, can, isCompanyOnVacation, companyVacation } = useLenderTeam();

  const allowed: Record<TabId, boolean> = {
    home: true,
    requests: can("requests.view"),
    mortgages: can("mortgages.view"),
    employees: true,
    analytics: can("analytics.view"),
    accounting: can("accounting.view"),
    other: true,
  };
  const current = allowed[tab] ? tab : "home";

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-gold-tint px-3 py-1 text-xs font-semibold text-gold">
          Mortgage lender portal
        </span>
        {active ? (
          <span className="text-xs text-muted-foreground">
            Signed in as {active.name} · {LENDER_ROLE_LABEL[active.role]}
          </span>
        ) : null}
      </div>

      {isCompanyOnVacation && companyVacation ? (
        <div className="mb-6 rounded-lg border border-gold/40 bg-gold-tint px-4 py-3 text-sm text-foreground">
          <span className="font-semibold">Company-wide vacation mode is on</span> (
          {formatDate(companyVacation.from)} – {formatDate(companyVacation.until)}
          {companyVacation.reason ? ` · ${companyVacation.reason}` : ""}). New Loqal clients are
          being routed to the next preferred partner while your company is away. Existing files in
          this portal are unaffected.
        </div>
      ) : null}

      {current === "home" ? (
        <LenderHome
          lenderName={lenderName}
          onOpenRequests={(leadId) => {
            setFocusLeadId(leadId ?? null);
            setTab("requests");
          }}
        />
      ) : null}
      {current === "requests" ? (
        <RequestsInbox canDecide={can("requests.decide")} focusLeadId={focusLeadId} />
      ) : null}
      {current === "mortgages" ? <LenderMortgages canManage={can("mortgages.manage")} /> : null}
      {current === "employees" ? <LenderEmployees /> : null}
      {current === "analytics" ? <LenderAnalytics /> : null}
      {current === "accounting" ? <LenderAccounting lenderName={lenderName} /> : null}
      {current === "other" ? <LenderTeam /> : null}
    </main>
  );
}
