/**
 * Lender accounting: what the company earns from clients (estimated
 * origination revenue on issued pre-approvals), the platform fees owed to
 * Loqal (with payment recording), and the bank accounts payouts land on.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLeads } from "@/lib/leads";
import {
  LENDER_PLATFORM_FEE_USD,
  usd,
  useAccounting,
} from "@/lib/accounting";
import { formatDate } from "@/lib/dates";
import { logActivity } from "@/lib/activity";

/** Estimated loan = purchase price minus the standard 20% down payment. */
const LOAN_PCT = 0.8;
/** Estimated lender origination revenue, % of the loan amount. */
const ORIGINATION_PCT = 0.01;

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

type BankAccount = { id: string; bankName: string; accountLabel: string; currency: string };

const BANKS_KEY = "loqal.lender.banks.v1";

function loadBanks(): BankAccount[] {
  try {
    const raw = window.localStorage.getItem(BANKS_KEY);
    return raw ? (JSON.parse(raw) as BankAccount[]) : [];
  } catch {
    return [];
  }
}

export function LenderAccounting({ lenderName }: { lenderName: string }) {
  const { leads } = useLeads();
  const { invoices, issueInvoice, markPaid } = useAccounting();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [bankName, setBankName] = useState("");
  const [accountLabel, setAccountLabel] = useState("");

  useEffect(() => {
    setBanks(loadBanks());
  }, []);

  function saveBanks(next: BankAccount[]) {
    setBanks(next);
    try {
      window.localStorage.setItem(BANKS_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }

  const issued = leads.filter((l) => l.status === "qualified");
  const estRevenue = issued.reduce((s, l) => s + l.propertyPrice * LOAN_PCT * ORIGINATION_PCT, 0);
  const feesDue = issued.length * LENDER_PLATFORM_FEE_USD;

  const loqalInvoices = invoices.filter((i) => i.toParty === "Loqal" && i.fromParty === lenderName);
  const paidFees = loqalInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount, 0);
  const invoicedLeadIds = new Set(
    loqalInvoices.map((i) => i.leadId).filter((x): x is string => !!x),
  );

  function recordFee(leadId: string, propertyLabel: string) {
    const id = issueInvoice({
      fromParty: lenderName,
      toParty: "Loqal",
      description: `Platform fee — pre-approval for ${propertyLabel}`,
      amount: LENDER_PLATFORM_FEE_USD,
      currency: "USD",
      leadId,
      propertyLabel,
    });
    markPaid(id);
    logActivity(lenderName, "paid a Loqal platform fee", `${propertyLabel} · ${usd(LENDER_PLATFORM_FEE_USD)}`);
    toast("Payment recorded", { description: `Platform fee for ${propertyLabel} marked as paid.` });
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Pre-approvals issued" value={issued.length} note="Billable files" />
        <Stat label="Est. origination revenue" value={usd(estRevenue)} note="1% of est. loan amount" />
        <Stat
          label="Loqal fees due"
          value={usd(Math.max(0, feesDue - paidFees))}
          note={`${usd(LENDER_PLATFORM_FEE_USD)} per pre-approval`}
        />
        <Stat label="Paid to Loqal" value={usd(paidFees)} note={`${loqalInvoices.length} payments`} />
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Clients — originated business</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Estimated origination revenue per issued pre-approval (1% of the estimated loan amount).
        </p>
        {issued.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No pre-approvals issued yet — qualified files appear here.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Client</th>
                  <th className="py-2 pr-4 font-semibold">Property</th>
                  <th className="py-2 pr-4 font-semibold">Purchase price</th>
                  <th className="py-2 pr-4 font-semibold">Est. loan</th>
                  <th className="py-2 font-semibold">Est. revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {issued.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 pr-4 font-semibold text-foreground">{l.clientName}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{l.propertyLabel}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{usd(l.propertyPrice)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {usd(l.propertyPrice * LOAN_PCT)}
                    </td>
                    <td className="py-2.5 font-semibold text-foreground">
                      {usd(l.propertyPrice * LOAN_PCT * ORIGINATION_PCT)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Loqal — platform fees</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {usd(LENDER_PLATFORM_FEE_USD)} per originated pre-approval. Record each payment once sent.
        </p>
        {issued.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing owed yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {issued.map((l) => {
              const paid = invoicedLeadIds.has(l.id);
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {l.clientName} — {l.propertyLabel}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {usd(LENDER_PLATFORM_FEE_USD)} · pre-approval issued
                    </div>
                  </div>
                  {paid ? (
                    <span className="rounded-full bg-success/10 px-3 py-1 text-[11px] font-semibold text-success">
                      Paid
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => recordFee(l.id, l.propertyLabel)}
                      className="rounded-md bg-brand px-3.5 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
                    >
                      Record payment
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {loqalInvoices.length ? (
          <div className="mt-4 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Payment history
            </h3>
            <ul className="mt-2 space-y-1.5">
              {loqalInvoices.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {i.number} · {formatDate(i.issuedAt)} · {i.description}
                  </span>
                  <span className="font-semibold text-foreground">{usd(i.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Banks — payout accounts</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Accounts where your origination revenue and Loqal settlements land.
        </p>
        {banks.length ? (
          <ul className="mt-3 divide-y divide-border">
            {banks.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-semibold text-foreground">{b.bankName}</span>
                <span className="text-muted-foreground">{b.accountLabel}</span>
                <button
                  type="button"
                  onClick={() => saveBanks(banks.filter((x) => x.id !== b.id))}
                  className="text-xs font-semibold text-destructive hover:underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No payout accounts added yet.</p>
        )}
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bank name
            </span>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className={`${inputClass} w-52`}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Account (e.g. checking ··4821)
            </span>
            <input
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              className={`${inputClass} w-52`}
            />
          </label>
          <button
            type="button"
            disabled={!bankName.trim() || !accountLabel.trim()}
            onClick={() => {
              saveBanks([
                ...banks,
                {
                  id: Math.random().toString(36).slice(2, 8),
                  bankName: bankName.trim(),
                  accountLabel: accountLabel.trim(),
                  currency: "USD",
                },
              ]);
              setBankName("");
              setAccountLabel("");
            }}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
          >
            Add account
          </button>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-brand">{value}</div>
      {note ? <div className="mt-1 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  );
}
