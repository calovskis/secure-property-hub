/**
 * Lightweight accounting for the platform: partners (realtors, lenders) and
 * the Loqal admin see expected income, issued invoices and what is owed to
 * Loqal. Expected amounts are derived from live files; issued/paid invoices
 * persist here.
 */
import { useCallback, useSyncExternalStore } from "react";

export type InvoiceStatus = "sent" | "paid";

export type Invoice = {
  id: string;
  /** e.g. "INV-2026-0007" */
  number: string;
  /** Who bills whom, e.g. "Sofia Marino (Buyer's agent)" → "Loqal". */
  fromParty: string;
  toParty: string;
  description: string;
  amount: number;
  currency: "USD";
  status: InvoiceStatus;
  issuedAt: string;
  paidAt?: string;
  /** Linked file, when the invoice relates to one. */
  leadId?: string;
  propertyLabel?: string;
};

type AccountingState = { invoices: Invoice[] };

const STORAGE_KEY = "loqal.accounting.v1";
const uid = () => Math.random().toString(36).slice(2, 8);

let state: AccountingState | null = null;
const listeners = new Set<() => void>();

function load(): AccountingState {
  if (state) return state;
  let next: AccountingState = { invoices: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { invoices: (JSON.parse(raw) as Partial<AccountingState>).invoices ?? [] };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: AccountingState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const SERVER_SNAPSHOT: AccountingState = { invoices: [] };

export function useAccounting() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );

  const issueInvoice = useCallback(
    (input: Omit<Invoice, "id" | "number" | "status" | "issuedAt">) => {
      const cur = load();
      const number = `INV-${new Date().getFullYear()}-${String(cur.invoices.length + 1).padStart(4, "0")}`;
      commit({
        invoices: [
          {
            ...input,
            id: uid(),
            number,
            status: "sent",
            issuedAt: new Date().toISOString(),
          },
          ...cur.invoices,
        ],
      });
    },
    [],
  );

  const markPaid = useCallback((id: string) => {
    const cur = load();
    commit({
      invoices: cur.invoices.map((i) =>
        i.id === id ? { ...i, status: "paid", paidAt: new Date().toISOString() } : i,
      ),
    });
  }, []);

  return { invoices: snapshot.invoices, issueInvoice, markPaid };
}

/** Buyer's agent commission on a file, % of the purchase price at closing. */
export const REALTOR_COMMISSION_PCT = 3;
/** Loqal personal advocate fee, % of the purchase price at closing. */
export const ADVOCATE_FEE_PCT = 1;
/** Share of the agent's commission invoiced to Loqal as a platform fee. */
export const REALTOR_PLATFORM_FEE_PCT = 20;
/** Lender platform fee per originated pre-approval, invoiced to Loqal. */
export const LENDER_PLATFORM_FEE_USD = 250;

export const usd = (n: number) => `$${Math.round(n).toLocaleString()}`;
