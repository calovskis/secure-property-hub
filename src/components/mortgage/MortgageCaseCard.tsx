import { useState } from "react";
import {
  computeDti,
  offerReminders,
  totalMonthlyObligations,
  useLeads,
  type DebtProfile,
  type MortgageLead,
  type OtherObligation,
} from "@/lib/leads";
import { formatDate, formatDateTime } from "@/lib/dates";
import { BuyerAgentDialog } from "@/components/mortgage/BuyerAgentDialog";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const uid = () => Math.random().toString(36).slice(2, 9);

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

function Amount({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">$</span>
        <input
          inputMode="decimal"
          min={0}
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className={inputClass}
        />
        <span className="text-xs text-muted-foreground">/mo</span>
      </div>
    </label>
  );
}

function InfoRequests({ lead }: { lead: MortgageLead }) {
  const { answerInfoRequest } = useLeads();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, string[]>>({});

  const open = lead.infoRequests.filter((r) => !r.answeredAt);
  const answered = lead.infoRequests.filter((r) => r.answeredAt);

  return (
    <div className="space-y-4">
      {open.map((r) => (
        <div key={r.id} className="rounded-lg border border-gold/40 bg-gold-tint/60 p-4">
          <div className="text-sm font-semibold text-foreground">
            Your lender needs more information
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{r.question}</p>
          <textarea
            rows={3}
            placeholder="Type your answer…"
            value={drafts[r.id] ?? ""}
            onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
            className={`${inputClass} mt-3`}
          />
          <div className="mt-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {r.needsDocument ? "Upload the requested document" : "Attach a document (optional)"}
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => {
                const names = Array.from(e.target.files ?? []).map((f) => f.name);
                setFiles({ ...files, [r.id]: [...(files[r.id] ?? []), ...names] });
                e.currentTarget.value = "";
              }}
              className="mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-xs file:font-semibold file:text-background"
            />
            {(files[r.id] ?? []).map((n, index) => (
              <div
                key={`${n}-${index}`}
                className="mt-1 flex items-center justify-between rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <span className="text-brand">📎 {n}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles({
                      ...files,
                      [r.id]: (files[r.id] ?? []).filter((_, i) => i !== index),
                    })
                  }
                  className="font-semibold text-destructive"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const selectedFiles = files[r.id] ?? [];
              const confirmed = window.confirm(
                `Send this response to the lender${selectedFiles.length ? ` with ${selectedFiles.length} document${selectedFiles.length === 1 ? "" : "s"}` : ""}?`,
              );
              if (confirmed) answerInfoRequest(lead.id, r.id, drafts[r.id] ?? "", selectedFiles);
            }}
            disabled={r.needsDocument && (files[r.id] ?? []).length === 0}
            className="mt-3 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
          >
            Send to lender
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Answers and files are stored with this property case and on your Loqal profile, so they
            can be reused for future applications.
          </p>
        </div>
      ))}

      {answered.length > 0 ? (
        <details className="rounded-lg border border-border bg-background p-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            Case history ({answered.length} answered)
          </summary>
          <ul className="mt-3 space-y-3">
            {answered.map((r) => (
              <li key={r.id} className="text-sm">
                <div className="font-semibold text-foreground">{r.question}</div>
                <p className="text-muted-foreground">{r.answer || "(no written answer)"}</p>
                {r.documents.map((d) => (
                  <div key={d.id} className="text-xs text-brand">
                    📎 {d.name}
                  </div>
                ))}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Step2Form({ lead }: { lead: MortgageLead }) {
  const { saveDebts } = useLeads();
  const [propertyLoans, setPropertyLoans] = useState(
    lead.debts ? String(lead.debts.propertyLoans) : "",
  );
  const [vehicleLoans, setVehicleLoans] = useState(
    lead.debts ? String(lead.debts.vehicleLoans) : "",
  );
  const [insurance, setInsurance] = useState(lead.debts ? String(lead.debts.insurance) : "");
  const [other, setOther] = useState<OtherObligation[]>(lead.debts?.other ?? []);

  const debts: DebtProfile = {
    propertyLoans: Number(propertyLoans) || 0,
    vehicleLoans: Number(vehicleLoans) || 0,
    insurance: Number(insurance) || 0,
    other,
    submittedAt: new Date().toISOString(),
  };
  const obligations = totalMonthlyObligations(debts);
  const dti = computeDti({
    monthlyIncome: lead.profile.monthlyGross,
    obligations,
    dtiLimit: lead.dtiLimit,
    listPrice: lead.propertyPrice,
  });

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">
          Step 2 — maximum purchase price estimate
        </h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Tell us your current monthly obligations. We apply a {Math.round(lead.dtiLimit * 100)}%
          debt-to-income ceiling set by your lender: the new mortgage payment, interest, taxes and
          insurance plus your existing obligations must stay within that share of your gross income.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Amount label="Property loan payments" value={propertyLoans} onChange={setPropertyLoans} />
        <Amount label="Vehicle / car loans" value={vehicleLoans} onChange={setVehicleLoans} />
        <Amount label="Total insurance costs" value={insurance} onChange={setInsurance} />
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-brand-tint/30 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Other monthly obligations
          </span>
          <button
            type="button"
            onClick={() => setOther([...other, { id: uid(), label: "", amount: 0 }])}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
          >
            + Add obligation
          </button>
        </div>
        {other.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add student loans, alimony, credit card minimums or anything else you pay monthly.
          </p>
        ) : null}
        {other.map((o, i) => (
          <div key={o.id} className="flex flex-wrap items-center gap-2">
            <input
              placeholder="Description"
              value={o.label}
              onChange={(e) => {
                const next = [...other];
                next[i] = { ...o, label: e.target.value };
                setOther(next);
              }}
              className={`${inputClass} flex-1 min-w-[160px]`}
            />
            <input
              inputMode="decimal"
              placeholder="0"
              value={o.amount ? String(o.amount) : ""}
              onChange={(e) => {
                const next = [...other];
                next[i] = { ...o, amount: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 };
                setOther(next);
              }}
              className={`${inputClass} w-32`}
            />
            <button
              type="button"
              onClick={() => setOther(other.filter((x) => x.id !== o.id))}
              className="rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-brand/30 bg-brand-tint/50 p-4">
        <div className="divide-y divide-border">
          {[
            ["Monthly gross income", money(lead.profile.monthlyGross)],
            ["Total monthly obligations", money(obligations)],
            [`Available at ${Math.round(dti.dtiLimit * 100)}% DTI`, `${money(dti.allowance)} /mo`],
            ["Estimated maximum purchase price", money(dti.maxPurchasePrice)],
            ["Indicative loan amount", money(dti.maxLoanAmount)],
            ["Required down payment (20%)", money(dti.requiredDownPayment)],
            [
              `DTI at this property (${money(lead.propertyPrice)})`,
              `${Math.round(dti.dtiAtListPrice * 100)}%`,
            ],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <strong className="font-semibold text-foreground">{value}</strong>
            </div>
          ))}
        </div>
        <p
          className={`mt-3 text-xs font-semibold ${
            dti.qualifiesAtListPrice ? "text-success" : "text-destructive"
          }`}
        >
          {dti.qualifiesAtListPrice
            ? "This property fits within your debt-to-income capacity."
            : "This property exceeds your current debt-to-income capacity — consider a larger down payment or a lower price point."}
        </p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Indicative only. Final DTI criteria vary with applicant-specific data and your lender's
          underwriting.
        </p>
      </div>

      <button
        type="button"
        onClick={() => saveDebts(lead.id, debts)}
        className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
      >
        {lead.debts ? "Update and resend to lender" : "Send to lender"}
      </button>
      {lead.debts ? <p className="text-xs text-success">Shared with your lender.</p> : null}
    </div>
  );
}

/** Questions the client asked the lender about the issued terms, with answers. */
function QuestionThread({ lead }: { lead: MortgageLead }) {
  const questions = lead.clientQuestions ?? [];
  if (!questions.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {questions.map((q) => (
        <div key={q.id} className="rounded-md border border-border bg-background p-3 text-sm">
          <div className="font-medium text-foreground">You asked: {q.text}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(q.askedAt)}</div>
          {q.answer ? (
            <p className="mt-2 rounded-md bg-brand-tint/40 p-2 text-muted-foreground">
              <strong className="text-foreground">Lender: </strong>
              {q.answer}
              <span className="mt-1 block text-[11px]">{formatDateTime(q.answeredAt)}</span>
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              Waiting for the lender's answer — the terms stay open in the meantime.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ProceedPanel({ lead }: { lead: MortgageLead }) {
  const { setClientDecision, askClientQuestion } = useLeads();
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const t = lead.terms;
  if (!t) {
    return (
      <div className="mb-4 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
        Your lender is finalising the pricing for your pre-approval. You will be asked to confirm
        the terms as soon as they arrive.
      </div>
    );
  }

  const loan = lead.propertyPrice * (1 - t.downPaymentPct / 100);
  const reminders = offerReminders(lead);
  const nextReminder = reminders.find((r) => !r.due);
  const sentCount = reminders.filter((r) => r.due).length;
  const ba = lead.buyerAgent;

  function sendQuestion() {
    const text = question.trim();
    if (!text) return;
    askClientQuestion(lead.id, text);
    setQuestion("");
    setAskOpen(false);
  }

  return (
    <div className="mb-6 rounded-lg border border-success/40 bg-success/5 p-4">
      <h4 className="text-sm font-semibold text-foreground">Your pre-approval terms</h4>
      <div className="mt-2 divide-y divide-border">
        {[
          ["Indicative loan amount", money(loan)],
          ["Interest rate", `${t.ratePct}%`],
          ["Term", `${t.termYears} years`],
          ["Down payment", `${t.downPaymentPct}%`],
          ["Closing costs", `${t.closingCostPct}%`],
          ["Taxes + insurance", `${t.taxInsurancePct}% / yr`],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <strong className="font-semibold text-foreground">{value}</strong>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1.5 rounded-md border border-border bg-background/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          These are <strong className="text-foreground">preliminary estimated terms</strong> — they
          can change in the final mortgage proposal, which is issued after the prepurchase contract
          is signed.
        </p>
        <p>
          After you accept — and until the prepurchase agreement is signed — you may request a
          property change at any point within{" "}
          <strong className="text-foreground">3 months</strong> under the same pre-approval, within
          the same purchase price. Once you decide on a property, the lender re-checks your
          qualification and the potential mortgage terms for that property.
        </p>
      </div>

      {lead.clientDecision === "accepted" ? (
        <div className="mt-3">
          <p className="text-sm font-semibold text-success">
            You confirmed these terms — your lender is now running the hard credit check and
            preparing the mortgage proposal.
          </p>
          <div className="mt-3 rounded-md border border-brand/30 bg-brand-tint/40 p-3">
            <div className="text-sm font-semibold text-foreground">Your buyer's agent</div>
            {ba?.agentName ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <strong className="text-foreground">{ba.agentName}</strong> represents you as your
                buyer's agent — fee {ba.feePct}% of the purchase price at closing, agreed{" "}
                {formatDate(ba.agreedAt)}.
                {ba.nextStep === "live_call"
                  ? ` Live call requested ${formatDateTime(ba.liveCallRequestedAt)} — the agent will reach out to schedule it.`
                  : " The agent is starting on your brief right away."}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                We are matching you with the best available buyer's agent licensed in this state.
              </p>
            )}
          </div>
        </div>
      ) : lead.clientDecision === "hold" ? (
        <div className="mt-3 rounded-md border border-gold/40 bg-gold-tint/50 p-3">
          <p className="text-sm font-semibold text-foreground">On hold</p>
          <p className="mt-1 text-xs text-muted-foreground">
            You put this pre-approval on hold on {formatDate(lead.clientDecisionAt)}. The terms
            stay valid — continue whenever you are ready.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAgentDialogOpen(true)}
              className="rounded-md bg-success px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
            >
              Continue with these terms
            </button>
            <button
              type="button"
              onClick={() => setClientDecision(lead.id, "declined")}
              className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-destructive"
            >
              Not continuing
            </button>
          </div>
        </div>
      ) : lead.clientDecision === "declined" ? (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            You chose not to continue with these terms. The pre-approval stays valid — you can
            still proceed later.
          </p>
          <button
            type="button"
            onClick={() => setAgentDialogOpen(true)}
            className="mt-3 rounded-md bg-success px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
          >
            Continue with these terms
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            How would you like to respond to these terms? You don't have to decide right away — the
            offer stays in My profile and on your dashboard until you answer.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAgentDialogOpen(true)}
              className="rounded-md bg-success px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
            >
              Continue with these terms
            </button>
            <button
              type="button"
              onClick={() => setClientDecision(lead.id, "hold")}
              className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-gold-tint"
            >
              Put on hold
            </button>
            <button
              type="button"
              onClick={() => setAskOpen((v) => !v)}
              className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-brand-tint"
            >
              Ask the lender a question
            </button>
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Decline these pre-approval terms? You can still proceed later."))
                  setClientDecision(lead.id, "declined");
              }}
              className="rounded-md border border-border px-5 py-2.5 text-sm font-semibold text-muted-foreground hover:text-destructive"
            >
              Not continuing
            </button>
          </div>

          {askOpen ? (
            <div className="mt-3 rounded-md border border-border bg-background p-3">
              <textarea
                rows={3}
                autoFocus
                placeholder="What would you like to ask your lender about these terms?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className={`${inputClass}`}
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={sendQuestion}
                  disabled={!question.trim()}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
                >
                  Send question
                </button>
                <button
                  type="button"
                  onClick={() => setAskOpen(false)}
                  className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {sentCount || nextReminder ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {sentCount
                ? `${sentCount} reminder${sentCount > 1 ? "s" : ""} already sent. `
                : ""}
              {nextReminder
                ? `Next reminder ${formatDateTime(nextReminder.dueAt)}${
                    nextReminder.email ? " — on the platform and by e-mail" : " — on the platform"
                  }.`
                : ""}
            </p>
          ) : null}
        </div>
      )}

      <QuestionThread lead={lead} />
      <BuyerAgentDialog lead={lead} open={agentDialogOpen} onOpenChange={setAgentDialogOpen} />
    </div>
  );
}

export function MortgageCaseCard({ lead }: { lead: MortgageLead }) {
  const openRequests = lead.infoRequests.filter((r) => !r.answeredAt).length;

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Mortgage pre-approval application
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sent to a Loqal lending partner for {lead.propertyLabel}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            lead.status === "qualified"
              ? "bg-success/10 text-success"
              : lead.status === "not_qualified"
                ? "bg-destructive/10 text-destructive"
                : lead.status === "info_required"
                  ? "bg-gold-tint text-gold"
                  : "bg-brand-tint text-brand"
          }`}
        >
          {lead.status === "new"
            ? "In review with lender"
            : lead.status === "info_required"
              ? `Action needed${openRequests ? ` (${openRequests})` : ""}`
              : lead.status === "qualified"
                ? lead.clientDecision === "accepted"
                  ? "Pre-approved — agent assigned"
                  : lead.clientDecision === "hold"
                    ? "On hold"
                    : lead.clientDecision
                      ? "Pre-qualified"
                      : "Awaiting your response"
                : "Not qualified"}
        </span>
      </div>

      {lead.lenderNote ? (
        <p className="mt-4 rounded-md bg-brand-tint/40 p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">Lender note: </strong>
          {lead.lenderNote}
        </p>
      ) : null}

      <div className="mt-4">
        {lead.status === "new" ? (
          <p className="text-sm text-muted-foreground">
            Your application has been delivered. The lender will respond with a pre-qualification
            decision.
          </p>
        ) : null}

        {lead.status === "not_qualified" ? (
          <p className="text-sm text-muted-foreground">
            The lender could not pre-qualify this application. Your Loqal advisor will look at
            alternative structures with you.
          </p>
        ) : null}

        {lead.status === "info_required" ? <InfoRequests lead={lead} /> : null}

        {lead.status === "qualified" ? (
          <>
            <p className="mb-4 text-sm text-success">
              You are pre-qualified. Complete Step 2 to estimate your maximum purchase price.
            </p>
            <ProceedPanel lead={lead} />
            <Step2Form lead={lead} />
          </>
        ) : null}
      </div>
    </section>
  );
}
