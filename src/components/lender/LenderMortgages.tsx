import { useMemo, useState } from "react";
import {
  CLIENT_DECISION_LABEL,
  MORTGAGE_STAGE_LABEL,
  hasPricedOffer,
  leadState,
  mortgageStage,
  totalMonthlyObligations,
  useLeads,
  type MortgageFileStage,
  type MortgageLead,
} from "@/lib/leads";
import { formatDate, formatDateTime } from "@/lib/dates";
import { ApplicantFile, Row } from "@/components/lender/ApplicantFile";
import { useLenderTeam } from "@/lib/lender-team";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const STAGE_TONE: Record<MortgageFileStage, string> = {
  awaiting_client: "bg-gold-tint text-gold",
  client_on_hold: "bg-warning/10 text-warning",
  client_declined: "bg-destructive/10 text-destructive",
  in_underwriting: "bg-success/10 text-success",
};

/** Questions the client asked about the issued terms, with an answer box. */
function ClientQuestions({ lead }: { lead: MortgageLead }) {
  const { answerClientQuestion } = useLeads();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const questions = lead.clientQuestions ?? [];
  if (!questions.length) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Client questions about the terms</h3>
      <div className="mt-3 space-y-3">
        {questions.map((q) => (
          <div key={q.id} className="rounded-md border border-border p-3">
            <div className="text-sm font-medium text-foreground">{q.text}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Asked {formatDateTime(q.askedAt)}
            </div>
            {q.answer ? (
              <p className="mt-2 rounded-md bg-brand-tint/40 p-2 text-sm text-muted-foreground">
                <strong className="text-foreground">Your answer: </strong>
                {q.answer}
              </p>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  placeholder="Write the answer for the client…"
                  value={drafts[q.id] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [q.id]: e.target.value })}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="button"
                  disabled={!(drafts[q.id] ?? "").trim()}
                  onClick={() => answerClientQuestion(lead.id, q.id, (drafts[q.id] ?? "").trim())}
                  className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function FileDetail({ lead }: { lead: MortgageLead }) {
  const t = lead.terms!;
  const loan = lead.propertyPrice * (1 - t.downPaymentPct / 100);
  const answered = lead.infoRequests.filter((r) => r.answeredAt).length;

  return (
    <div className="space-y-6 border-t border-border bg-background/50 p-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Pre-approval terms issued</h3>
        <div className="mt-2 divide-y divide-border">
          <Row label="Loan amount" value={money(loan)} />
          <Row label="Interest rate" value={`${t.ratePct}%`} />
          <Row label="Term" value={`${t.termYears} years`} />
          <Row label="Down payment" value={`${t.downPaymentPct}%`} />
          <Row label="Closing costs" value={`${t.closingCostPct}%`} />
          <Row label="Taxes + insurance" value={`${t.taxInsurancePct}% / yr`} />
          <Row label="Soft credit score" value={lead.creditScore ?? "—"} />
          <Row label="DTI ceiling" value={`${Math.round(lead.dtiLimit * 100)}%`} />
          <Row label="Issued" value={formatDate(t.issuedAt)} />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Client confirmation</h3>
        <div className="mt-2 divide-y divide-border">
          <Row label="Stage" value={MORTGAGE_STAGE_LABEL[mortgageStage(lead)]} />
          <Row
            label="Client decision"
            value={
              lead.clientDecision
                ? `${CLIENT_DECISION_LABEL[lead.clientDecision]} · ${formatDateTime(lead.clientDecisionAt)}`
                : "Pending — terms delivered to the client, reminders running"
            }
          />
          <Row
            label="Hard check"
            value={
              lead.clientDecision === "accepted"
                ? "Authorised — work the file in Mortgages"
                : "Not authorised"
            }
          />
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Pre-approval information</h3>
        <div className="mt-2 divide-y divide-border">
          <Row
            label="Step 2 affordability"
            value={
              lead.debts
                ? `${money(totalMonthlyObligations(lead.debts))} /mo obligations`
                : "Not submitted"
            }
          />
          <Row
            label="Information requests"
            value={`${answered} answered of ${lead.infoRequests.length}`}
          />
          {lead.lenderNote ? <Row label="Lender note" value={lead.lenderNote} /> : null}
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-brand">
            Open the full pre-approval file
          </summary>
          <div className="mt-4">
            <ApplicantFile lead={lead} />
          </div>
        </details>
      </section>
    </div>
  );
}

export function LenderMortgages({ canManage }: { canManage: boolean }) {
  const { leads } = useLeads();
  const { scopedStates } = useLenderTeam();
  const [openId, setOpenId] = useState<string | null>(null);
  const [state, setState] = useState("all");
  const [stage, setStage] = useState<MortgageFileStage | "all">("all");

  const files = useMemo(
    () =>
      leads
        .filter(hasPricedOffer)
        .filter((l) => (scopedStates ? scopedStates.includes(leadState(l)) : true)),
    [leads, scopedStates],
  );
  const states = useMemo(() => Array.from(new Set(files.map(leadState))).sort(), [files]);
  const visible = files
    .filter((l) => (state === "all" ? true : leadState(l) === state))
    .filter((l) => (stage === "all" ? true : mortgageStage(l) === stage));

  const counts = {
    in_underwriting: files.filter((l) => mortgageStage(l) === "in_underwriting").length,
    awaiting_client: files.filter((l) => mortgageStage(l) === "awaiting_client").length,
    client_on_hold: files.filter((l) => mortgageStage(l) === "client_on_hold").length,
    client_declined: files.filter((l) => mortgageStage(l) === "client_declined").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-[30px]">Mortgages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every qualified pre-approval opens a mortgage file here. Files move into active work once
          the client confirms the issued terms for a hard check.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Open mortgage files", counts.in_underwriting, "Client confirmed — hard check"],
            ["Awaiting client decision", counts.awaiting_client, "Terms delivered — reminders running"],
            ["On hold by client", counts.client_on_hold, "Client paused the process"],
            ["Qualified, not continuing", counts.client_declined, "Client declined the terms"],
          ] as const
        ).map(([label, value, note]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 text-3xl font-bold text-brand">{value}</div>
            <div className="mt-2 text-xs text-muted-foreground">{note}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All files"],
            ["in_underwriting", MORTGAGE_STAGE_LABEL.in_underwriting],
            ["awaiting_client", MORTGAGE_STAGE_LABEL.awaiting_client],
            ["client_on_hold", MORTGAGE_STAGE_LABEL.client_on_hold],
            ["client_declined", MORTGAGE_STAGE_LABEL.client_declined],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStage(id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              stage === id
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
            onChange={(e) => setState(e.target.value)}
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

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No mortgage files in this view. Qualify a pre-approval request and issue terms to see it
          here.
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((l) => {
            const t = l.terms!;
            const loan = l.propertyPrice * (1 - t.downPaymentPct / 100);
            const st = mortgageStage(l);
            const open = openId === l.id;
            return (
              <li key={l.id} className="overflow-hidden rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : l.id)}
                  className="flex w-full flex-wrap items-center gap-4 p-5 text-left hover:bg-brand-tint/30"
                >
                  <div className="min-w-[200px] flex-1">
                    <div className="text-sm font-semibold text-foreground">{l.clientName}</div>
                    <div className="text-xs text-muted-foreground">
                      {l.propertyLabel} · {money(l.propertyPrice)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div className="font-semibold text-foreground">{money(loan)}</div>
                    {t.ratePct}% · {t.termYears}y · {t.downPaymentPct}% down
                  </div>
                  <span className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand">
                    {leadState(l)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold ${STAGE_TONE[st]}`}
                  >
                    {MORTGAGE_STAGE_LABEL[st]}
                  </span>
                  <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
                </button>
                {open ? <FileDetail lead={l} /> : null}
              </li>
            );
          })}
        </ul>
      )}

      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          Your seat has read-only access to mortgage servicing actions.
        </p>
      ) : null}
    </div>
  );
}
