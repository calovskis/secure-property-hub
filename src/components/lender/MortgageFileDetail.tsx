/**
 * One mortgage file inside the lender portal, in clearly separated blocks:
 *
 *  1. Pre-approval at a glance — the issued terms, with the full file in a new
 *     tab and the download for the loan origination system;
 *  2. Client & purchase status — where the purchase stands;
 *  3. Bank eligibility — which bank the loan can be sold to;
 *  4. Loan submission — the pre-approval figures copied over and editable,
 *     confirmed against the signed purchase agreement's deadlines;
 *  5. Information requests and client questions;
 *  6. Transfer to the bank — after closing the file waits here until it is
 *     handed over to the chosen bank.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  CLIENT_DECISION_LABEL,
  MORTGAGE_STAGE_LABEL,
  mortgageStage,
  totalMonthlyObligations,
  useLeads,
  type MortgageLead,
} from "@/lib/leads";
import { formatDate, formatDateTime } from "@/lib/dates";
import { ApplicantFile, Row } from "@/components/lender/ApplicantFile";
import { ClientFileTransfer } from "@/components/lender/ClientFileTransfer";
import { BankEligibilitySection } from "@/components/lender/BankEligibility";
import { PaymentScheduleButton } from "@/components/mortgage/PaymentScheduleDialog";
import { buyerAgentSummary, useBuyerProcess } from "@/lib/buyer-process";
import { loqalNumber } from "@/lib/user-id";
import { updateEntityPlan } from "@/lib/entity-structure";
import { useLoanSubmission } from "@/lib/loan-submission";
import {
  PURCHASE_STAGE_LABEL,
  PURCHASE_STAGE_NOTE,
  usePurchaseProgress,
  type PurchaseProgress,
} from "@/lib/purchase-stage";
import { useAuth } from "@/lib/auth";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand";
const labelClass =
  "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

/** Block 1 — the pre-approval in brief, with the full file and the downloads. */
function PreApprovalBlock({ lead }: { lead: MortgageLead }) {
  const t = lead.terms!;
  const loan = lead.propertyPrice * (1 - t.downPaymentPct / 100);
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Pre-approval at a glance</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Terms issued {formatDate(t.issuedAt)} — the figures the client accepted.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/lender/file/${lead.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
          >
            Open the full file in a new tab ↗
          </a>
          <PaymentScheduleButton lead={lead} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Loan amount", money(loan)],
            ["Rate", `${t.ratePct}%`],
            ["Term", `${t.termYears} years`],
            ["Down payment", `${t.downPaymentPct}%`],
            ["Closing costs", `${t.closingCostPct}%`],
            [
              "Taxes + insurance",
              `${money((lead.propertyPrice * t.taxInsurancePct) / 100)} / yr`,
            ],
            ["Soft credit score", String(lead.creditScore ?? "—")],
            [
              "Monthly obligations",
              lead.debts ? `${money(totalMonthlyObligations(lead.debts))} /mo` : "—",
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-md border border-border p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
          </div>
        ))}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-brand">
          Read the full pre-approval here instead
        </summary>
        <div className="mt-3">
          <ApplicantFile lead={lead} />
        </div>
      </details>
    </section>
  );
}

/** Block 2 — client decision and where the purchase stands. */
function StatusBlock({ lead, progress }: { lead: MortgageLead; progress: PurchaseProgress }) {
  const proc = useBuyerProcess();
  const agentProgress = buyerAgentSummary(lead, proc);
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Client & purchase status</h3>
      <div className="mt-2 divide-y divide-border">
        <Row label="Client" value={lead.clientName} />
        <Row label="Client ID" value={loqalNumber(lead.clientEmail)} />
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
          label="Purchase status"
          value={`${PURCHASE_STAGE_LABEL[progress.stage]} — ${PURCHASE_STAGE_NOTE[progress.stage]}`}
        />
        {progress.agreedPrice ? (
          <Row label="Agreed purchase price" value={money(progress.agreedPrice)} />
        ) : null}
        {agentProgress ? <Row label="Buyer–agent progress" value={agentProgress} /> : null}
      </div>
    </section>
  );
}

/**
 * Block 4 — the loan submission. Every figure starts as a copy of the
 * pre-approval terms and can be changed before it is confirmed against the
 * signed purchase agreement.
 */
function LoanSubmissionBlock({
  lead,
  progress,
}: {
  lead: MortgageLead;
  progress: PurchaseProgress;
}) {
  const t = lead.terms!;
  const { user } = useAuth();
  const { submission, save } = useLoanSubmission(lead.id);
  const signed = progress.stage === "agreement_signed";
  const [form, setForm] = useState({
    ratePct: String(submission?.ratePct ?? t.ratePct),
    termYears: String(submission?.termYears ?? t.termYears),
    downPaymentPct: String(submission?.downPaymentPct ?? t.downPaymentPct),
    closingCostPct: String(submission?.closingCostPct ?? t.closingCostPct),
    taxInsuranceAnnual: String(
      submission?.taxInsuranceAnnual ??
        Math.round((lead.propertyPrice * t.taxInsurancePct) / 100),
    ),
    note: submission?.note ?? "",
  });

  const price = progress.agreedPrice ?? lead.propertyPrice;
  const num = (v: string) => Number(v.replace(/[^0-9.]/g, "")) || 0;
  const loan = Math.round(price * (1 - num(form.downPaymentPct) / 100));
  const late = (iso?: string) => Boolean(iso && new Date(iso) < new Date());

  function persist(extra: Record<string, unknown> = {}) {
    save({
      ratePct: num(form.ratePct),
      termYears: num(form.termYears),
      downPaymentPct: num(form.downPaymentPct),
      closingCostPct: num(form.closingCostPct),
      taxInsuranceAnnual: num(form.taxInsuranceAnnual),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
      ...extra,
    });
  }

  function confirm() {
    if (!submission?.bankProgramId) {
      toast.error("Choose the bank you will sell this loan to in Bank eligibility first.");
      return;
    }
    const by = user ? `${user.firstName} ${user.lastName}`.trim() : "Mortgage company";
    persist({ confirmedAt: new Date().toISOString(), confirmedBy: by });
    updateEntityPlan(lead.id, {
      hardCheckConfirmedAt: new Date().toISOString(),
      hardCheckConfirmedBy: by,
      ...(form.note.trim() ? { hardCheckNote: form.note.trim() } : {}),
    });
    toast("Loan submission confirmed", {
      description: `Terms confirmed for ${submission.bankName} — ${submission.programName}.`,
    });
  }

  return (
    <section
      className={`rounded-lg border p-4 ${
        signed && !submission?.confirmedAt
          ? "border-gold/50 bg-gold-tint/40"
          : "border-border bg-card"
      }`}
    >
      <h3 className="text-sm font-semibold text-foreground">Loan submission</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {signed
          ? "The purchase agreement is signed. The pre-approval figures are copied below — adjust anything that changed, then confirm the terms and your mortgage approval."
          : "Opens for confirmation once the purchase agreement is signed. The figures below are copied from the pre-approval and can be prepared now."}
      </p>

      {signed ? (
        <div className="mt-3 divide-y divide-border">
          <Row
            label="Agreement signed"
            value={progress.signedAt ? formatDateTime(progress.signedAt) : "—"}
          />
          {progress.agreementDoc ? (
            <Row label="Signed agreement" value={progress.agreementDoc} />
          ) : null}
          <Row
            label="Closing date"
            value={
              <span
                className={`font-semibold underline decoration-2 ${
                  late(progress.closingDate) ? "text-destructive" : "text-foreground"
                }`}
              >
                {progress.closingDate ? formatDate(progress.closingDate) : "—"}
              </span>
            }
          />
          <Row
            label="Mortgage approval due"
            value={
              <span
                className={`font-semibold underline decoration-2 ${
                  late(progress.approvalDueDate) ? "text-destructive" : "text-foreground"
                }`}
              >
                {progress.approvalDueDate ? formatDate(progress.approvalDueDate) : "—"}
              </span>
            }
          />
        </div>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(
          [
            ["Interest rate %", "ratePct"],
            ["Term (years)", "termYears"],
            ["Down payment %", "downPaymentPct"],
            ["Closing costs %", "closingCostPct"],
            ["Taxes + insurance / yr $", "taxInsuranceAnnual"],
          ] as const
        ).map(([label, key]) => (
          <label key={key} className="block">
            <span className={labelClass}>{label}</span>
            <input
              value={form[key]}
              disabled={Boolean(submission?.confirmedAt)}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className={inputClass}
            />
          </label>
        ))}
        <div className="rounded-md border border-border p-3">
          <div className={labelClass}>Loan amount</div>
          <div className="text-sm font-semibold text-foreground">{money(loan)}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            on {money(price)} purchase price
          </div>
        </div>
      </div>

      <label className="mt-3 block">
        <span className={labelClass}>Note for the file</span>
        <input
          value={form.note}
          disabled={Boolean(submission?.confirmedAt)}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Anything the file should record (optional)"
          className={inputClass}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {submission?.bankName ? (
          <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
            Selling to {submission.bankName} — {submission.programName}
          </span>
        ) : (
          <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
            No bank chosen yet — pick one in Bank eligibility
          </span>
        )}
        {submission?.confirmedAt ? (
          <span className="text-xs font-semibold text-success">
            Confirmed {formatDateTime(submission.confirmedAt)}
            {submission.confirmedBy ? ` by ${submission.confirmedBy}` : ""}.
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                persist();
                toast("Loan submission saved");
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
            >
              Save the figures
            </button>
            {signed ? (
              <button
                type="button"
                onClick={confirm}
                className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft"
              >
                Confirm the terms & mortgage approval
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/** Block 5 — information requests raised on the file and client questions. */
function RequestsBlock({ lead }: { lead: MortgageLead }) {
  const { answerClientQuestion } = useLeads();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const requests = lead.infoRequests ?? [];
  const questions = lead.clientQuestions ?? [];
  const answered = requests.filter((r) => r.answeredAt).length;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Information requests</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {requests.length
          ? `${answered} answered of ${requests.length} raised on this file.`
          : "Nothing requested from the client on this file."}
        {lead.lenderNote ? ` Lender note: ${lead.lenderNote}` : ""}
      </p>

      {requests.length ? (
        <ul className="mt-3 space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-3">
              <div className="text-sm font-medium text-foreground">{r.question}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Requested {formatDateTime(r.requestedAt)}
                {r.answeredAt ? ` · answered ${formatDateTime(r.answeredAt)}` : " · awaiting the client"}
              </div>
              {r.answer ? (
                <p className="mt-2 rounded-md bg-brand-tint/40 p-2 text-sm text-muted-foreground">
                  {r.answer}
                </p>
              ) : null}
              {r.documents.length ? (
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {r.documents.map((d) => d.name).join(", ")}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {questions.length ? (
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Client questions about the terms
          </h4>
          <div className="mt-2 space-y-3">
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
                      className={inputClass}
                    />
                    <button
                      type="button"
                      disabled={!(drafts[q.id] ?? "").trim()}
                      onClick={() =>
                        answerClientQuestion(lead.id, q.id, (drafts[q.id] ?? "").trim())
                      }
                      className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Block 6 — after the mortgage is given and the purchase closes, the file waits
 * in the portal until it is transferred to the bank that buys the loan.
 */
function TransferBlock({ lead, progress }: { lead: MortgageLead; progress: PurchaseProgress }) {
  const { user } = useAuth();
  const { submission, save } = useLoanSubmission(lead.id);
  const [reference, setReference] = useState("");
  if (!submission?.confirmedAt) return null;

  const closed = Boolean(
    progress.closingDate && new Date(progress.closingDate) <= new Date(),
  );

  return (
    <section
      className={`rounded-lg border p-4 ${
        submission.transferredAt
          ? "border-success/40 bg-success/5"
          : "border-brand/40 bg-brand-tint/30"
      }`}
    >
      <h3 className="text-sm font-semibold text-foreground">Transfer to the bank</h3>
      <div className="mt-2 divide-y divide-border">
        <Row label="Bank" value={`${submission.bankName} — ${submission.programName}`} />
        <Row label="Client ID" value={loqalNumber(lead.clientEmail)} />
        <Row
          label="Closing"
          value={
            progress.closingDate
              ? `${formatDate(progress.closingDate)}${closed ? " — closed" : " — upcoming"}`
              : "—"
          }
        />
        <Row
          label="Status"
          value={
            submission.transferredAt
              ? `Transferred ${formatDateTime(submission.transferredAt)}${
                  submission.transferReference ? ` · ref ${submission.transferReference}` : ""
                }`
              : closed
                ? "Pending transfer — the loan is ready to hand over to the bank"
                : "Waiting for closing before the loan is handed over"
          }
        />
      </div>
      {!submission.transferredAt && closed ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Bank reference / loan number (optional)"
            className="min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={() => {
              save({
                transferredAt: new Date().toISOString(),
                transferredBy: user ? `${user.firstName} ${user.lastName}`.trim() : "Mortgage company",
                ...(reference.trim() ? { transferReference: reference.trim() } : {}),
              });
              toast("Loan transferred to the bank");
            }}
            className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft"
          >
            Mark as transferred
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function MortgageFileDetail({ lead }: { lead: MortgageLead }) {
  const { progressOf } = usePurchaseProgress();
  const progress = progressOf(lead.id);

  return (
    <div className="space-y-6 border-t border-border bg-background/50 p-6">
      <PreApprovalBlock lead={lead} />
      <ClientFileTransfer lead={lead} />
      <StatusBlock lead={lead} progress={progress} />
      <BankEligibilitySection lead={lead} />
      <LoanSubmissionBlock lead={lead} progress={progress} />
      <RequestsBlock lead={lead} />
      <TransferBlock lead={lead} progress={progress} />
    </div>
  );
}
