/**
 * Loan submission — the terms the mortgage company confirms once the purchase
 * agreement is signed, and the bank the loan will be sold to afterwards.
 *
 * The record starts as a copy of the pre-approval terms (so nothing is retyped)
 * and the lender may change any figure before confirming. After closing the
 * file stays in the lender portal as pending transfer to the chosen bank.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

export type LoanSubmission = {
  leadId: string;
  ratePct: number;
  termYears: number;
  downPaymentPct: number;
  closingCostPct: number;
  /** Annual taxes + insurance, USD. */
  taxInsuranceAnnual: number;
  /** Bank (investor) the loan is sold to. */
  bankProgramId?: string | undefined;
  bankName?: string | undefined;
  programName?: string | undefined;
  note?: string | undefined;
  confirmedAt?: string | undefined;
  confirmedBy?: string | undefined;
  /** File handed over to the bank after closing. */
  transferredAt?: string | undefined;
  transferredBy?: string | undefined;
  transferReference?: string | undefined;
  createdAt: string;
  updatedAt: string;
};

type State = { submissions: LoanSubmission[] };

const STORAGE_KEY = "loqal.loanSubmissions.v1";
const EMPTY: State = { submissions: [] };

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  let next = EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { submissions: (JSON.parse(raw) as Partial<State>).submissions ?? [] };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export type LoanSubmissionPatch = {
  [K in keyof Omit<LoanSubmission, "leadId" | "createdAt" | "updatedAt">]?:
    | LoanSubmission[K]
    | undefined;
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLoanSubmission(leadId: string) {
  const snapshot = useSyncExternalStore(subscribe, () => load(), () => EMPTY);
  const submission = useMemo(
    () => snapshot.submissions.find((s) => s.leadId === leadId),
    [snapshot.submissions, leadId],
  );

  const save = useCallback(
    (patch: LoanSubmissionPatch) => {
      const cur = load();
      const now = new Date().toISOString();
      const existing = cur.submissions.find((s) => s.leadId === leadId);
      const next: LoanSubmission = existing
        ? { ...existing, ...clean(patch), updatedAt: now }

        : {
            leadId,
            ...patch,
            ratePct: patch.ratePct ?? 0,
            termYears: patch.termYears ?? 30,
            downPaymentPct: patch.downPaymentPct ?? 20,
            closingCostPct: patch.closingCostPct ?? 0,
            taxInsuranceAnnual: patch.taxInsuranceAnnual ?? 0,
            createdAt: now,
            updatedAt: now,
          };
      commit({
        submissions: existing
          ? cur.submissions.map((s) => (s.leadId === leadId ? next : s))
          : [...cur.submissions, next],
      });
      return next;
    },
    [leadId],
  );

  return { submission, save };
}

/** All submissions — for dashboards that show several files at once. */
export function useLoanSubmissions() {
  const snapshot = useSyncExternalStore(subscribe, () => load(), () => EMPTY);
  return { submissions: snapshot.submissions };
}
