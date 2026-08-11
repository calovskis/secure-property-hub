import { useMemo, useState } from "react";
import {
  computeDti,
  totalMonthlyObligations,
  LEAD_STATUS_LABEL,
  MORTGAGE_STAGE_LABEL,
  isOpenRequest,
  leadState,
  mortgageStage,
  useLeads,
  type LeadStatus,
  type MortgageLead,
} from "@/lib/leads";

import { ApplicantFile, Row } from "@/components/lender/ApplicantFile";
import { formatDateTime } from "@/lib/dates";

import { LENDER_ROLE_LABEL, useLenderTeam } from "@/lib/lender-team";
import { LenderHome } from "@/components/lender/LenderHome";
import { LenderAnalytics } from "@/components/lender/LenderAnalytics";
import { LenderMortgages } from "@/components/lender/LenderMortgages";
import { LenderTeam } from "@/components/lender/LenderTeam";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const date = (iso?: string) => formatDateTime(iso);

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "bg-gold-tint text-gold",
  info_required: "bg-brand-tint text-brand",
  not_qualified: "bg-destructive/10 text-destructive",
  qualified: "bg-success/10 text-success",
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
  const [question, setQuestion] = useState("");
  const [needsDoc, setNeedsDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function decide(status: LeadStatus) {
    const parsed = Number(score);
    if (!parsed || parsed < 300 || parsed > 850) {
      setError("A soft credit report score between 300 and 850 is required with every decision.");
      return;
    }
    if (status === "info_required" && !question.trim()) {
      setError("Describe what the client must answer or upload.");
      return;
    }
    const rate = Number(ratePct);
    const years = Number(termYears);
    const down = Number(downPct);
    const closing = Number(closingPct);
    const taxIns = Number(taxInsPct);
    if (status === "qualified") {
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
      creditScore: parsed,
      lenderNote: note.trim(),
      dtiLimit: limit,
      decidedAt: new Date().toISOString(),
      ...(status === "qualified"
        ? {
            terms: {
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
    if (status === "info_required") {
      addInfoRequest(lead.id, question.trim(), needsDoc);
      setQuestion("");
      setNeedsDoc(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Pre-qualification feedback</h3>
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

      <div className="rounded-md border border-gold/40 bg-gold-tint/40 p-3">
        <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Approved pricing (required for “Qualified” — unlocks the client estimate)
        </span>
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

      <div className="rounded-md border border-border bg-brand-tint/30 p-3">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Information request (used with “More information required”)
        </span>
        <textarea
          rows={2}
          placeholder="e.g. Please upload your last two pay stubs and confirm your bonus structure."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className={inputClass}
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={needsDoc}
            onChange={(e) => setNeedsDoc(e.target.checked)}
          />
          A document upload is required
        </label>
      </div>

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
          onClick={() => decide("info_required")}
          className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
        >
          More information required
        </button>
        <button
          type="button"
          onClick={() => decide("not_qualified")}
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
        >
          Not qualified
        </button>
      </div>
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
  const selected = visible.find((l) => l.id === selectedId) ?? visible[0];

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
          {hiddenByScope} {hiddenByScope === 1 ? "request is" : "requests are"} outside your licensed
          state coverage and hidden from this seat. A portal admin can widen your state scope in
          Other → Team.
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

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-border bg-card p-4">
          {view === "past" ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(["all", "qualified", "not_qualified"] as const).map((f) => (
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
            <p className="py-8 text-center text-sm text-muted-foreground">
              No applications in this view yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full py-3 text-left ${
                      selected?.id === l.id ? "opacity-100" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{l.clientName}</span>
                      <StatusPill status={l.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.propertyLabel} · {money(l.propertyPrice)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded bg-brand-tint px-1.5 py-0.5 font-semibold text-brand">
                        {leadState(l)}
                      </span>
                      {date(l.submittedAt)}
                    </div>
                    {l.status === "qualified" ? (
                      <div className="mt-1 text-[11px] font-semibold text-muted-foreground">
                        {MORTGAGE_STAGE_LABEL[mortgageStage(l)]}
                      </div>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          {!selected ? (
            <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Select an application to review the full client file.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
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
                <ApplicantFile lead={selected} />
              </div>

              {selected.debts ? <Step2Summary lead={selected} /> : null}
              <Thread lead={selected} />
              {selected.status === "not_qualified" ? (
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
            </>
          )}
        </div>
      </section>
    </>
  );
}

export const TABS = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "requests", label: "Pre-approval Requests", icon: "📥" },
  { id: "mortgages", label: "Mortgages", icon: "🏦" },
  { id: "analytics", label: "Analytics", icon: "📈" },
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
    analytics: can("analytics.view"),
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
  const { active, can } = useLenderTeam();

  const allowed: Record<TabId, boolean> = {
    home: true,
    requests: can("requests.view"),
    mortgages: can("mortgages.view"),
    analytics: can("analytics.view"),
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
      {current === "analytics" ? <LenderAnalytics /> : null}
      {current === "other" ? <LenderTeam /> : null}
    </main>
  );
}
