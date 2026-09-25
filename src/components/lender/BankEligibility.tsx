/**
 * Bank eligibility for one client file.
 *
 * Before the mortgage company confirms its terms for the loan submission it
 * needs to know which bank will buy the loan and on which matrix. This block
 * matches the client's own data against every bank matrix we hold and shows
 * what each bank would allow.
 */
import { useMemo, useState } from "react";
import { FileQuestion, Lightbulb } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLeads, type InfoRequestType, type MortgageLead } from "@/lib/leads";
import {
  ELIGIBILITY_LABEL,
  ELIGIBILITY_TONE,
  OCCUPANCY_LABEL,
  TRACK_LABEL,
  applicantSnapshot,
  matchBanks,
  sameTypeElsewhere,
  FAMILY_LABEL,
  trackOf,
  type ProgramMatch,
} from "@/lib/bank-matrix";
import { useLoanSubmission } from "@/lib/loan-submission";
import { InfoRequestDialog } from "@/components/lender/InfoRequestDialog";
import { Button } from "@/components/ui/button";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const RESULT_TONE: Record<string, string> = {
  pass: "text-success",
  fail: "text-destructive",
  review: "text-gold",
};
const RESULT_MARK: Record<string, string> = { pass: "✓", fail: "✕", review: "!" };

function MatchCard({
  match,
  alsoAt,
  chosen,
  onChoose,
  onRequest,
  openRequestKeys,
}: {
  match: ProgramMatch;
  alsoAt: string[];
  chosen: boolean;
  onChoose: () => void;
  onRequest: (match: ProgramMatch, recommendation: string) => void;
  openRequestKeys: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const p = match.program;
  return (
    <li
      className={`rounded-lg border p-4 ${
        chosen ? "border-brand bg-brand-tint/30" : "border-border bg-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[200px] flex-1">
          <div className="text-sm font-semibold text-foreground">
            {p.bank} — {p.program}
          </div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
            {FAMILY_LABEL[p.family] ?? p.family}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{p.blurb}</div>
          {alsoAt.length ? (
            <div className="mt-1.5 inline-flex rounded-full bg-gold-tint px-2.5 py-0.5 text-[11px] font-medium text-gold">
              Same loan type also at {alsoAt.join(", ")} — you can choose the bank
            </div>
          ) : null}
        </div>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${ELIGIBILITY_TONE[match.eligibility]}`}
        >
          {ELIGIBILITY_LABEL[match.eligibility]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
        <div>
          <div className="font-semibold text-foreground">{match.maxLtv}%</div>
          max LTV at this loan size
        </div>
        <div>
          <div className="font-semibold text-foreground">{money(match.maxLoanForFile)}</div>
          max loan on this price
        </div>
        <div>
          <div className="font-semibold text-foreground">
            {p.minFico ? p.minFico : "AUS"}
            {p.noScoreAllowed ? " / no score" : ""}
          </div>
          credit score
        </div>
        <div>
          <div className="font-semibold text-foreground">
            {p.incomeNotRequired ? "DSCR" : p.maxDti ? `${p.maxDti}%` : "AUS"}
          </div>
          {p.incomeNotRequired ? "qualifies on rent" : "max DTI"}
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {match.checks.map((c) => (
          <li key={c.label} className="flex gap-2 text-[11px]">
            <span className={`font-bold ${RESULT_TONE[c.result]}`}>{RESULT_MARK[c.result]}</span>
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{c.label}: </span>
              {c.detail}
            </span>
          </li>
        ))}
      </ul>

      {match.eligibility !== "eligible" && match.recommendations.length ? (
        <div className="mt-3 rounded-md border border-gold/35 bg-gold-tint/30 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Lightbulb className="h-3.5 w-3.5 text-gold" />
            What could make this programme eligible
          </div>
          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] leading-5 text-muted-foreground">
            {match.recommendations.map((recommendation) => (
              <li key={recommendation} className="flex items-start justify-between gap-3">
                <span>{recommendation}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={openRequestKeys.has(`${p.id}:${recommendation}`)}
                  onClick={() => onRequest(match, recommendation)}
                  className="h-7 shrink-0 gap-1 px-2 text-[10px]"
                >
                  <FileQuestion className="h-3 w-3" />
                  {openRequestKeys.has(`${p.id}:${recommendation}`) ? "Requested" : "Request"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-md border border-border px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
        >
          {open ? "Hide the matrix terms" : "Matrix terms"}
        </button>
        {match.eligibility === "ineligible" ? null : (
          <button
            type="button"
            onClick={onChoose}
            className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${
              chosen
                ? "border border-brand text-brand"
                : "bg-brand text-background hover:bg-brand-soft"
            }`}
          >
            {chosen ? "Selected for the loan submission" : "Sell this loan to this bank"}
          </button>
        )}
      </div>

      {open ? (
        <ul className="mt-3 list-disc space-y-1 rounded-md bg-background/60 p-3 pl-6 text-[11px] text-muted-foreground">
          {p.terms.map((t) => (
            <li key={t}>{t}</li>
          ))}
          <li className="list-none pt-1 text-[10px] italic">Source: {p.source}</li>
        </ul>
      ) : null}
    </li>
  );
}

export function BankEligibilitySection({ lead }: { lead: MortgageLead }) {
  const [open, setOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState<{
    match: ProgramMatch;
    recommendation: string;
    type: InfoRequestType;
    wording: string;
    needsDocument: boolean;
  } | null>(null);
  const { addInfoRequest } = useLeads();
  const { submission, save } = useLoanSubmission(lead.id);
  const snap = useMemo(() => applicantSnapshot(lead), [lead]);
  const matches = useMemo(() => matchBanks(snap), [snap]);
  const track = trackOf(snap);
  const eligible = matches.filter((m) => m.eligibility === "eligible");
  const conditional = matches.filter((m) => m.eligibility === "review");
  const openRequestKeys = new Set(
    (lead.infoRequests ?? [])
      .filter((request) => !request.answeredAt && request.bankProgramId && request.recommendation)
      .map((request) => `${request.bankProgramId}:${request.recommendation}`),
  );

  const prepareRequest = (match: ProgramMatch, recommendation: string) => {
    const lower = recommendation.toLowerCase();
    const visa = lower.includes("visa") || lower.includes("i-797") || lower.includes("i-94");
    const evidence = /document|statement|report|evidence|proof|discharge|completion/.test(lower);
    const type: InfoRequestType = visa ? "visa_support" : evidence ? "evidence" : "information";
    const intro = visa
      ? "To continue checking your eligibility, please provide a valid, unexpired US visa or qualifying I-797/I-94 evidence. If you need Loqal visa support, please say so in your reply."
      : evidence
        ? `To continue checking your eligibility for ${match.program.bank} — ${match.program.program}, please provide the following evidence: ${recommendation}`
        : `To continue checking your eligibility for ${match.program.bank} — ${match.program.program}, please confirm the following: ${recommendation}`;
    setOpen(false);
    setRequestDraft({ match, recommendation, type, wording: intro, needsDocument: visa || evidence });
  };

  const choose = (m: ProgramMatch) =>
    save({
      bankProgramId: m.program.id,
      bankName: m.program.bank,
      programName: m.program.program,
    });

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Bank eligibility</h3>
          <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
            Which bank this loan can be sold to, matched from the client's own file:{" "}
            {TRACK_LABEL[track].toLowerCase()} track, {OCCUPANCY_LABEL[snap.occupancy].toLowerCase()},{" "}
            {money(snap.loanAmount)} at {snap.ltv}% LTV.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
        >
          Open bank eligibility
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-md border border-success/40 bg-success/5 p-3">
          <div className="text-lg font-bold text-success">{eligible.length}</div>
          banks eligible now
        </div>
        <div className="rounded-md border border-gold/40 bg-gold-tint/40 p-3">
          <div className="text-lg font-bold text-gold">{conditional.length}</div>
          eligible with conditions
        </div>
        <div className="rounded-md border border-border p-3">
          <div className="text-sm font-semibold text-foreground">
            {submission?.bankName ? `${submission.bankName}` : "Not chosen yet"}
          </div>
          {submission?.programName ?? "bank for the loan submission"}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Bank eligibility — {lead.clientName}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Only relevant programmes are shown, grouped by bank. US citizens and green card holders with
            an SSN see conventional, FHA and non-QM matrices; ITIN borrowers see ITIN matrices plus
            foreign-national ones; other borrowers see foreign-national matrices. A vacation home is
            sorted as a primary residence. Programmes blocked
            by a permanent borrower or matrix restriction are hidden. Pick the bank before confirming
            the loan submission.
          </p>
          <div className="mt-2 space-y-5">
            {Array.from(new Set(matches.map((m) => m.program.bank))).map((bank) => {
              const bankMatches = matches.filter((m) => m.program.bank === bank);
              return (
                <div key={bank}>
                  <div className="mb-2 flex items-baseline justify-between border-b border-border pb-1">
                    <h4 className="text-sm font-semibold text-foreground">{bank}</h4>
                    <span className="text-[11px] text-muted-foreground">
                      {bankMatches.length} programme{bankMatches.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="space-y-3">
                    {bankMatches.map((m) => (
                      <MatchCard
                        key={m.program.id}
                        match={m}
                        alsoAt={Array.from(
                          new Set(sameTypeElsewhere(m.program, matches).map((o) => o.program.bank)),
                        )}
                        chosen={submission?.bankProgramId === m.program.id}
                        onChoose={() => choose(m)}
                        onRequest={prepareRequest}
                        openRequestKeys={openRequestKeys}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
      <InfoRequestDialog
        lead={lead}
        open={Boolean(requestDraft)}
        onOpenChange={(next) => {
          if (!next) setRequestDraft(null);
        }}
        initialQuestion={requestDraft?.wording ?? ""}
        initialNeedsDocument={requestDraft?.needsDocument}
        initialType={requestDraft?.type ?? "information"}
        contextLabel={requestDraft ? `${requestDraft.match.program.bank} — ${requestDraft.match.program.program}` : undefined}
        onSend={(question, needsDocument, type) => {
          if (!requestDraft) return;
          addInfoRequest(lead.id, question, needsDocument, {
            type,
            bankProgramId: requestDraft.match.program.id,
            bankName: requestDraft.match.program.bank,
            programName: requestDraft.match.program.program,
            recommendation: requestDraft.recommendation,
          });
          setRequestDraft(null);
        }}
      />
    </section>
  );
}
