/**
 * Bank eligibility for one client file.
 *
 * Before the mortgage company confirms its terms for the loan submission it
 * needs to know which bank will buy the loan and on which matrix. This block
 * matches the client's own data against every bank matrix we hold and shows
 * what each bank would allow.
 */
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MortgageLead } from "@/lib/leads";
import {
  ELIGIBILITY_LABEL,
  ELIGIBILITY_TONE,
  OCCUPANCY_LABEL,
  TRACK_LABEL,
  applicantSnapshot,
  matchBanks,
  trackOf,
  type ProgramMatch,
} from "@/lib/bank-matrix";
import { useLoanSubmission } from "@/lib/loan-submission";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const RESULT_TONE: Record<string, string> = {
  pass: "text-success",
  fail: "text-destructive",
  review: "text-gold",
};
const RESULT_MARK: Record<string, string> = { pass: "✓", fail: "✕", review: "!" };

function MatchCard({
  match,
  chosen,
  onChoose,
}: {
  match: ProgramMatch;
  chosen: boolean;
  onChoose: () => void;
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
          <div className="mt-0.5 text-xs text-muted-foreground">{p.blurb}</div>
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
  const { submission, save } = useLoanSubmission(lead.id);
  const snap = useMemo(() => applicantSnapshot(lead), [lead]);
  const matches = useMemo(() => matchBanks(snap), [snap]);
  const track = trackOf(snap);
  const eligible = matches.filter((m) => m.eligibility === "eligible");
  const conditional = matches.filter((m) => m.eligibility === "review");

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
            Every matrix we hold, checked against this file. Conventional matrices apply to
            borrowers with an SSN (US citizens and green card holders); everybody else is matched on
            the foreign national matrices. Pick the bank you will sell the loan to before you
            confirm the terms for the loan submission.
          </p>
          <ul className="mt-2 space-y-3">
            {matches.map((m) => (
              <MatchCard
                key={m.program.id}
                match={m}
                chosen={submission?.bankProgramId === m.program.id}
                onChoose={() => choose(m)}
              />
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}
