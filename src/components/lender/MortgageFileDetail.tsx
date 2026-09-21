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
import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  CircleAlert,
  ClipboardCheck,
  FileCheck2,
  FileText,
  ExternalLink,
  Landmark,
  MessageSquareText,
  SearchCheck,
  Send,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  CLIENT_DECISION_LABEL,
  MORTGAGE_STAGE_LABEL,
  mortgageStage,
  totalMonthlyObligations,
  useLeads,
  INFO_REQUEST_TYPE_LABEL,
  type InfoRequest,
  type InfoRequestType,
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InfoRequestDialog } from "@/components/lender/InfoRequestDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const { addInfoRequest, answerClientQuestion } = useLeads();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [requestOpen, setRequestOpen] = useState(false);
  const [thread, setThread] = useState<InfoRequest | null>(null);
  const requests = lead.infoRequests ?? [];
  const questions = lead.clientQuestions ?? [];
  const answered = requests.filter((r) => r.answeredAt).length;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Information requests</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {requests.length
              ? `${answered} answered of ${requests.length} raised on this file.`
              : "Nothing requested from the client on this file."}
            {lead.lenderNote ? ` Lender note: ${lead.lenderNote}` : ""}
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setRequestOpen(true)} className="gap-1.5">
          <MessageSquareText className="h-3.5 w-3.5" />
          New information request
        </Button>
      </div>

      {requests.length ? (
        <ul className="mt-3 space-y-2">
          {requests.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-3">
              <button type="button" onClick={() => setThread(r)} className="w-full text-left">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[10px] font-semibold text-brand">
                    {INFO_REQUEST_TYPE_LABEL[r.type ?? "information"]}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", r.answeredAt ? "bg-success/10 text-success" : "bg-gold-tint text-gold")}> 
                    {r.answeredAt ? "Answered" : "Awaiting client"}
                  </span>
                  {r.bankName ? <span className="text-[10px] text-muted-foreground">{r.bankName} · {r.programName}</span> : null}
                </div>
                <div className="mt-2 line-clamp-2 text-sm font-medium text-foreground">{r.question}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">Requested {formatDateTime(r.requestedAt)} · Open communication</div>
              </button>
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
      <InfoRequestDialog
        lead={lead}
        open={requestOpen}
        onOpenChange={setRequestOpen}
        onSend={(question, needsDocument, type) =>
          addInfoRequest(lead.id, question, needsDocument, { type })
        }
      />
      <RequestCommunicationDialog request={thread} onOpenChange={(open) => !open && setThread(null)} />
    </section>
  );
}

function RequestCommunicationDialog({
  request,
  onOpenChange,
}: {
  request: InfoRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        {request ? (
          <>
            <DialogHeader>
              <DialogTitle>{INFO_REQUEST_TYPE_LABEL[request.type ?? "information"]} request</DialogTitle>
              <DialogDescription>
                Sent {formatDateTime(request.requestedAt)}
                {request.bankName ? ` · ${request.bankName} — ${request.programName}` : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {request.recommendation ? (
                <div className="rounded-md border border-gold/35 bg-gold-tint/30 p-3 text-xs text-muted-foreground">
                  <strong className="text-foreground">Eligibility suggestion: </strong>{request.recommendation}
                </div>
              ) : null}
              <div className="rounded-md border border-border p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mortgage company requested</div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{request.question}</p>
              </div>
              {request.answeredAt ? (
                <div className="rounded-md border border-success/30 bg-success/5 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-success">Client replied · {formatDateTime(request.answeredAt)}</div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{request.answer || "No written response."}</p>
                  {request.documents.length ? (
                    <div className="mt-3 space-y-1">
                      {request.documents.map((document) => (
                        <div key={document.id} className="rounded-md border border-border bg-background px-3 py-2 text-xs text-brand">{document.name}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-md border border-gold/35 bg-gold-tint/30 p-3 text-sm font-medium text-gold">Awaiting the client’s response</div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  tone: "urgent" | "waiting" | "planned";
  tab?: CaseTab;
  icon: typeof CircleAlert;
};

function AttentionBlock({
  lead,
  progress,
  onOpenTab,
}: {
  lead: MortgageLead;
  progress: PurchaseProgress;
  onOpenTab: (tab: CaseTab) => void;
}) {
  const proc = useBuyerProcess();
  const { submission } = useLoanSubmission(lead.id);
  const openRequests = (lead.infoRequests ?? []).filter((request) => !request.answeredAt);
  const photo = proc.photos[lead.id];
  const inspections = Array.from(
    new Set([
      ...(photo?.inspectionsSuggested ?? []),
      ...((proc.actions[lead.id] ?? []).flatMap((action) => action.extraInspections ?? [])),
    ]),
  );
  const terms = progress.terms;
  const items: AttentionItem[] = [];

  if (openRequests.length) {
    items.push({
      id: "requests",
      title: `${openRequests.length} client ${openRequests.length === 1 ? "item" : "items"} outstanding`,
      detail: openRequests.map((request) => request.question).join(" · "),
      status: "Awaiting client",
      tone: "waiting",
      tab: "requests",
      icon: MessageSquareText,
    });
  }

  if (terms?.inspection) {
    items.push({
      id: "inspection",
      title: "Inspection contingency",
      detail: inspections.length
        ? `${inspections.join(", ")} · ${terms.inspectionDays}-day protection window.`
        : `Inspection protection is included for ${terms.inspectionDays} days. Coordinate reports with the buyer's agent.`,
      status: photo?.status === "delivered" ? "Reports available with agent" : "To coordinate",
      tone: photo?.status === "delivered" ? "planned" : "waiting",
      icon: SearchCheck,
    });
  }

  if (terms?.appraisal) {
    items.push({
      id: "appraisal",
      title: "Appraisal",
      detail: photo?.appraisalNote
        ? photo.appraisalNote
        : "Appraisal protection is included. Confirm the order and valuation before the contingency expires.",
      status: photo?.appraisalNote ? "Agent guidance received" : "Order or confirm",
      tone: photo?.appraisalNote ? "planned" : "waiting",
      icon: ClipboardCheck,
    });
  }

  if (progress.stage === "agreement_signed" && !submission?.bankProgramId) {
    items.push({
      id: "bank",
      title: "Select the bank programme",
      detail: "Choose the eligible bank programme before confirming the loan submission.",
      status: "Action required",
      tone: "urgent",
      tab: "eligibility",
      icon: Landmark,
    });
  }

  if (progress.hardCheckOpen) {
    items.push({
      id: "submission",
      title: "Confirm the loan submission",
      detail: `Mortgage approval is due ${progress.approvalDueDate ? formatDate(progress.approvalDueDate) : "now"}. Closing is ${progress.closingDate ? formatDate(progress.closingDate) : "not set"}.`,
      status: "Action required",
      tone: "urgent",
      tab: "submission",
      icon: FileCheck2,
    });
  }

  if (progress.stage === "agreement_signed" && !submission?.transferredAt) {
    const closed = Boolean(progress.closingDate && new Date(progress.closingDate) <= new Date());
    items.push({
      id: "closing",
      title: closed ? "Transfer the closed loan" : "Closing package",
      detail: closed
        ? "Closing has passed. Complete the handover to the selected bank and record its reference."
        : `Keep the signed agreement, title work, insurance evidence and final closing documents together for ${progress.closingDate ? formatDate(progress.closingDate) : "closing"}.`,
      status: closed ? "Action required" : "Monitor through closing",
      tone: closed ? "urgent" : "planned",
      ...(closed ? { tab: "transfer" as const } : {}),
      icon: closed ? Send : ShieldCheck,
    });
  }

  if (!items.length) {
    return (
      <section className="rounded-lg border border-success/30 bg-success/5 p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-success" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Items requiring attention</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">No outstanding case items at this stage.</p>
          </div>
        </div>
      </section>
    );
  }

  const toneClass = {
    urgent: "border-destructive/30 bg-destructive/5 text-destructive",
    waiting: "border-gold/40 bg-gold-tint/35 text-gold",
    planned: "border-brand/25 bg-brand-tint/35 text-brand",
  } as const;

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Items requiring attention</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Live milestones and outstanding work for this case.</p>
        </div>
        <span className="rounded-full bg-gold-tint px-2.5 py-1 text-[10px] font-bold text-gold">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.id} className="flex min-w-0 gap-3 rounded-md border border-border bg-background p-3">
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full border", toneClass[item.tone])}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", toneClass[item.tone])}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                {item.tab ? (
                  <Button type="button" size="sm" variant="outline" className="mt-2 h-7 text-[11px]" onClick={() => onOpenTab(item.tab ?? "overview")}>
                    Open section
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
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

type CaseTab = "overview" | "attention" | "preapproval" | "eligibility" | "submission" | "requests" | "transfer";

const CASE_TABS: Array<{ id: CaseTab; label: string; icon: typeof FileText }> = [
  { id: "overview", label: "Overview", icon: UserRound },
  { id: "attention", label: "Attention", icon: CircleAlert },
  { id: "preapproval", label: "Pre-approval", icon: FileText },
  { id: "eligibility", label: "Bank eligibility", icon: Landmark },
  { id: "submission", label: "Loan submission", icon: FileCheck2 },
  { id: "requests", label: "Requests", icon: MessageSquareText },
  { id: "transfer", label: "Bank transfer", icon: Send },
];

function SummaryTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-3 py-3 shadow-sm sm:px-4">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-base font-bold text-brand">{value}</div>
      {note ? <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{note}</div> : null}
    </div>
  );
}

function WorkspacePanel({ children }: { children: ReactNode }) {
  return <div className="case-workspace-panel">{children}</div>;
}

export function MortgageFileDetail({
  lead,
  standalone = false,
}: {
  lead: MortgageLead;
  standalone?: boolean;
}) {
  const { progressOf } = usePurchaseProgress();
  const progress = progressOf(lead.id);
  const [tab, setTab] = useState<CaseTab>("overview");
  const terms = lead.terms!;
  const price = progress.agreedPrice ?? lead.propertyPrice;
  const loan = price * (1 - terms.downPaymentPct / 100);
  const requests = lead.infoRequests ?? [];
  const openRequests = requests.filter((request) => !request.answeredAt).length;
  const purchaseLabel = PURCHASE_STAGE_LABEL[progress.stage];
  const attentionCount =
    openRequests +
    (progress.terms?.inspection ? 1 : 0) +
    (progress.terms?.appraisal ? 1 : 0) +
    (progress.stage === "agreement_signed" ? 1 : 0);

  return (
    <div className={cn("bg-background/60", standalone ? "p-0" : "border-t border-border p-3 sm:p-5")}>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="bg-brand px-4 py-4 text-primary-foreground sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wide text-gold">
                {loqalNumber(lead.clientEmail)} · Mortgage case
              </div>
              <div className="mt-1 truncate text-lg font-bold sm:text-xl">{lead.clientName}</div>
              <div className="mt-0.5 text-xs text-primary-foreground/75">
                {lead.propertyLabel} · {purchaseLabel}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!standalone ? (
                <Link
                  to="/lender/case/$leadId"
                  params={{ leadId: lead.id }}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${lead.clientName}'s mortgage case in a new tab`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-primary-foreground/25 bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-semibold text-primary-foreground hover:bg-primary-foreground/20"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open in new tab
                </Link>
              ) : null}
              <span className="rounded-full border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1 text-[11px] font-semibold">
                {MORTGAGE_STAGE_LABEL[mortgageStage(lead)]}
              </span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-foreground/20">
              <div
                className={cn("h-full rounded-full bg-gold", progress.stage === "agreement_signed" ? "w-full" : progress.stage === "with_seller" ? "w-2/3" : "w-1/3")}
              />
            </div>
            <span className="text-[11px] font-semibold text-gold">{purchaseLabel}</span>
          </div>
        </div>

        <div className="relative z-10 mx-3 -mt-3 grid grid-cols-2 gap-2 sm:mx-4 sm:grid-cols-4">
          <SummaryTile label="Loan amount" value={money(loan)} note={`${terms.downPaymentPct}% down`} />
          <SummaryTile label="Rate & term" value={`${terms.ratePct}% · ${terms.termYears}y`} note="Current terms" />
          <SummaryTile label="Purchase price" value={money(price)} note={progress.agreedPrice ? "Agreed" : "Requested"} />
          <SummaryTile label="Open requests" value={String(openRequests)} note={openRequests ? "Awaiting client" : "File is current"} />
        </div>

        <nav className="mt-3 flex gap-1 overflow-x-auto border-y border-border bg-muted/35 px-2 py-2" aria-label="Mortgage case sections">
          {CASE_TABS.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              size="sm"
              variant={tab === id ? "default" : "ghost"}
              onClick={() => setTab(id)}
              className={cn("shrink-0 gap-1.5", tab === id && "shadow-sm")}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {id === "requests" && openRequests ? (
                <span className="ml-0.5 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-foreground">{openRequests}</span>
              ) : null}
              {id === "attention" && attentionCount ? (
                <span className="ml-0.5 rounded-full bg-gold px-1.5 py-0.5 text-[9px] font-bold text-foreground">{attentionCount}</span>
              ) : null}
            </Button>
          ))}
        </nav>

        <div className="bg-background/45 p-3 sm:p-4">
          {tab === "overview" ? (
            <div className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
              <div className="xl:col-span-2"><WorkspacePanel><AttentionBlock lead={lead} progress={progress} onOpenTab={setTab} /></WorkspacePanel></div>
              <WorkspacePanel><StatusBlock lead={lead} progress={progress} /></WorkspacePanel>
              <WorkspacePanel><BankEligibilitySection lead={lead} /></WorkspacePanel>
              {progress.stage === "agreement_signed" ? (
                <WorkspacePanel><LoanSubmissionBlock lead={lead} progress={progress} /></WorkspacePanel>
              ) : null}
              <WorkspacePanel><RequestsBlock lead={lead} /></WorkspacePanel>
            </div>
          ) : null}
          {tab === "attention" ? <WorkspacePanel><AttentionBlock lead={lead} progress={progress} onOpenTab={setTab} /></WorkspacePanel> : null}
          {tab === "preapproval" ? (
            <div className="space-y-4">
              <WorkspacePanel><PreApprovalBlock lead={lead} /></WorkspacePanel>
              <WorkspacePanel><ClientFileTransfer lead={lead} /></WorkspacePanel>
            </div>
          ) : null}
          {tab === "eligibility" ? <WorkspacePanel><BankEligibilitySection lead={lead} /></WorkspacePanel> : null}
          {tab === "submission" ? <WorkspacePanel><LoanSubmissionBlock lead={lead} progress={progress} /></WorkspacePanel> : null}
          {tab === "requests" ? <WorkspacePanel><RequestsBlock lead={lead} /></WorkspacePanel> : null}
          {tab === "transfer" ? (
            <WorkspacePanel>
              {progress.stage === "agreement_signed" ? (
                <TransferBlock lead={lead} progress={progress} />
              ) : (
                <div className="rounded-lg border border-border bg-card p-6 text-center">
                  <Building2 className="mx-auto h-6 w-6 text-muted-foreground" />
                  <div className="mt-2 text-sm font-semibold text-foreground">Bank transfer is not open yet</div>
                  <div className="mt-1 text-xs text-muted-foreground">This section opens after the purchase agreement is signed and the loan submission is confirmed.</div>
                </div>
              )}
            </WorkspacePanel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
