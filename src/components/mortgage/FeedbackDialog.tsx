/**
 * Client-facing view of the mortgage lender's pre-approval feedback, opened
 * as a modal from My Profile / the case card. Shows the terms issued by the
 * lending company (with its NMLS number), hides soft credit score and DTI
 * ceiling for applicants without an SSN, and renders taxes + insurance as a
 * dollar amount (percentages stay lender/admin-side).
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CLIENT_DECISION_LABEL,
  LEAD_STATUS_LABEL,
  hasPricedOffer,
  offerReminders,
  type MortgageLead,
} from "@/lib/leads";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  Home,
  MessageSquare,
} from "lucide-react";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function StatusBadge({ lead }: { lead: MortgageLead }) {
  const tone =
    lead.status === "qualified"
      ? "bg-success/10 text-success border-success/20"
      : lead.status === "not_qualified"
        ? "bg-destructive/10 text-destructive border-destructive/20"
        : lead.status === "info_required"
          ? "bg-gold-tint/60 text-gold border-gold/30"
          : "bg-brand-tint text-brand border-brand/20";

  const icon =
    lead.status === "qualified" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : lead.status === "not_qualified" ? (
      <AlertCircle className="h-3.5 w-3.5" />
    ) : lead.status === "info_required" ? (
      <HelpCircle className="h-3.5 w-3.5" />
    ) : (
      <Clock className="h-3.5 w-3.5" />
    );

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${tone}`}
    >
      {icon}
      {LEAD_STATUS_LABEL[lead.status]}
    </span>
  );
}

function Term({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {children}
    </div>
  );
}

export function FeedbackDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: MortgageLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const terms = lead.terms;
  const taxesInsuranceYear = terms
    ? Math.round((lead.propertyPrice * terms.taxInsurancePct) / 100)
    : null;

  const answered = lead.infoRequests.filter((r) => r.answeredAt);
  const openRequests = lead.infoRequests.filter((r) => !r.answeredAt);
  const reminders = offerReminders(lead);
  const nextReminder = reminders.find((r) => !r.due);
  const pastReminders = reminders.filter((r) => r.due);
  const priced = hasPricedOffer(lead);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">
        <div className="bg-brand-tint/30 px-6 py-5">
          <DialogHeader className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <DialogTitle className="text-lg font-semibold text-foreground">
                  Lender feedback
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {lead.propertyLabel}
                </DialogDescription>
              </div>
              <StatusBadge lead={lead} />
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" />
                Purchase price {money(lead.propertyPrice)}
              </span>
              {lead.decidedAt ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Issued {formatDate(lead.decidedAt)}
                </span>
              ) : null}
            </div>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 pb-6">
          {terms?.lenderName ? (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint/50">
                <Building2 className="h-4 w-4 text-brand" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{terms.lenderName}</div>
                <div className="text-xs text-muted-foreground">
                  {terms.lenderNmls ? `NMLS ${terms.lenderNmls}` : "Lending partner"}
                </div>
              </div>
            </div>
          ) : null}

          {lead.creditScore ? (
            <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
              <span className="text-sm text-muted-foreground">Soft credit report score</span>
              <strong className="text-2xl font-bold text-brand">{lead.creditScore}</strong>
            </div>
          ) : null}

          {priced && terms ? (
            <Section icon={CheckCircle2} title="Priced pre-approval terms">
              <div className="grid grid-cols-2 gap-3">
                <Term label="Interest rate" value={`${terms.ratePct}%`} />
                <Term label="Loan term" value={`${terms.termYears} years`} />
                <Term label="Down payment" value={`${terms.downPaymentPct}%`} />
                <Term label="Closing costs" value={`${terms.closingCostPct}%`} />
                {taxesInsuranceYear !== null ? (
                  <Term
                    label="Taxes + insurance"
                    value={money(taxesInsuranceYear)}
                    sub="estimated per year"
                  />
                ) : null}
              </div>
            </Section>
          ) : null}

          {lead.status === "qualified" ? (
            <Section icon={MessageSquare} title="Your decision">
              <div className="rounded-xl border border-border bg-card p-4">
                {lead.clientDecision ? (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">
                      {CLIENT_DECISION_LABEL[lead.clientDecision]}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Answered {formatDateTime(lead.clientDecisionAt)}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">Awaiting your response</div>
                    <div className="text-xs text-muted-foreground">
                      Use the buttons at the bottom of this window to accept, place on hold,
                      decline, or request information from the lender.
                    </div>
                    {nextReminder ? (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Next reminder: {formatDateTime(nextReminder.dueAt)}
                        {nextReminder.email ? " · also by e-mail" : ""}
                      </div>
                    ) : null}
                    {pastReminders.length > 0 ? (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {pastReminders.length} reminder{pastReminders.length > 1 ? "s" : ""} already sent
                        {pastReminders.some((r) => r.email) ? " · including e-mail" : ""}.
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </Section>
          ) : null}

          {lead.lenderNote ? (
            <Section icon={MessageSquare} title="Note from the lender">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-foreground">{lead.lenderNote}</p>
              </div>
            </Section>
          ) : null}

          {openRequests.length ? (
            <Section icon={HelpCircle} title="Open requests from the lender">
              <div className="space-y-2">
                {openRequests.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-gold/30 bg-gold-tint/40 p-4"
                  >
                    <div className="text-sm font-medium text-foreground">{r.question}</div>
                    {r.needsDocument ? (
                      <div className="mt-1 text-xs text-gold">A document upload is required.</div>
                    ) : null}
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Requested {formatDateTime(r.requestedAt)}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Open the property page to reply to these requests.
              </p>
            </Section>
          ) : null}

          {answered.length ? (
            <Section icon={CheckCircle2} title="Answered requests">
              <div className="space-y-2">
                {answered.map((r) => (
                  <div key={r.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-sm font-medium text-foreground">{r.question}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{r.answer}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Answered {formatDateTime(r.answeredAt)}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {(lead.clientQuestions ?? []).length ? (
            <Section icon={MessageSquare} title="Your questions to the lender">
              <div className="space-y-2">
                {(lead.clientQuestions ?? []).map((q) => (
                  <div key={q.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="text-sm font-medium text-foreground">{q.text}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {q.answer ?? "Waiting for the lender's answer…"}
                    </div>
                    {q.answeredAt ? (
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        Answered {formatDateTime(q.answeredAt)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {lead.status === "qualified" ? (
            <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Preliminary terms.</strong> These estimated terms
              can change in the final mortgage proposal, which is issued after the Purchase Agreement
              is signed. If you agree now, you remain free to change the property within 3 months
              under the same pre-approval and purchase price; the lender will still recheck
              qualification and terms for any new property.
            </div>
          ) : null}
        </div>

        {priced ? (
          <div className="sticky bottom-0 space-y-3 border-t border-border bg-card/95 px-6 py-4 backdrop-blur">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lead.clientDecision ? "Change your answer" : "Your answer to these terms"}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAgentOpen(true)}
                className="rounded-md bg-success px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90"
              >
                Accept the terms
              </button>
              <button
                type="button"
                onClick={() => setClientDecision(lead.id, "hold")}
                disabled={lead.clientDecision === "hold"}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-gold-tint disabled:opacity-50"
              >
                Place on hold
              </button>
              <button
                type="button"
                onClick={() => setAskOpen((v) => !v)}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-brand-tint"
              >
                Request information
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Decline these pre-approval terms? You can still proceed later.",
                    )
                  )
                    setClientDecision(lead.id, "declined");
                }}
                disabled={lead.clientDecision === "declined"}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                Decline
              </button>
            </div>

            {askOpen ? (
              <div className="rounded-md border border-border bg-background p-3">
                <textarea
                  rows={3}
                  autoFocus
                  placeholder="What would you like to ask your lender about these terms?"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={!question.trim()}
                    onClick={() => {
                      const text = question.trim();
                      if (!text) return;
                      askClientQuestion(lead.id, text);
                      setQuestion("");
                      setAskOpen(false);
                    }}
                    className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
                  >
                    Send request
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
          </div>
        ) : null}

        <BuyerAgentDialog
          lead={lead}
          open={agentOpen}
          onOpenChange={(v) => {
            setAgentOpen(v);
            if (!v) onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
