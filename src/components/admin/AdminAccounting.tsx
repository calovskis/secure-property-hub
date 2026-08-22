/**
 * Loqal-level accounting: expected platform income (realtor platform fees,
 * lender pre-approval fees, Loqal personal advocate fees), every issued
 * invoice with paid/unpaid state, and per-partner balances owed to Loqal.
 */
import { toast } from "sonner";
import {
  ADVOCATE_FEE_PCT,
  LENDER_PLATFORM_FEE_USD,
  REALTOR_COMMISSION_PCT,
  REALTOR_PLATFORM_FEE_PCT,
  usd,
  useAccounting,
} from "@/lib/accounting";
import { useLeads } from "@/lib/leads";
import { usePartnerRequests } from "@/lib/partner-requests";
import { formatDate } from "@/lib/dates";
import { logActivity } from "@/lib/activity";

export function AdminAccounting() {
  const { invoices, markPaid } = useAccounting();
  const { leads } = useLeads();
  const { requests } = usePartnerRequests();

  const buyerFiles = leads.filter((l) => l.clientDecision === "accepted" && l.buyerAgent);
  const advocateFiles = buyerFiles.filter((l) => l.buyerAgent?.representation === "loqal_rep");
  const qualified = leads.filter((l) => l.status === "qualified");

  const expectedRealtorFees = buyerFiles.reduce(
    (s, l) => s + (l.propertyPrice * REALTOR_COMMISSION_PCT * REALTOR_PLATFORM_FEE_PCT) / 10000,
    0,
  );
  const expectedLenderFees = qualified.length * LENDER_PLATFORM_FEE_USD;
  const expectedAdvocateFees = advocateFiles.reduce(
    (s, l) => s + (l.propertyPrice * ADVOCATE_FEE_PCT) / 100,
    0,
  );

  const sent = invoices.filter((i) => i.status === "sent");
  const paid = invoices.filter((i) => i.status === "paid");
  const outstanding = sent.reduce((s, i) => s + i.amount, 0);
  const collected = paid.reduce((s, i) => s + i.amount, 0);

  // Per-partner balance = unpaid invoices addressed to them.
  const balances = new Map<string, number>();
  for (const inv of sent) {
    balances.set(inv.toParty, (balances.get(inv.toParty) ?? 0) + inv.amount);
  }
  const partnerName = (email: string) =>
    requests.find((r) => r.email.toLowerCase() === email.toLowerCase())?.companyName ?? email;

  function pay(id: string, label: string, amount: number) {
    markPaid(id);
    logActivity("Loqal admin", "marked an invoice as paid", `${label} · ${usd(amount)}`);
    toast("Invoice marked as paid", { description: `${label} · ${usd(amount)}` });
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card label="Expected — realtor fees" value={usd(expectedRealtorFees)} note={`${REALTOR_PLATFORM_FEE_PCT}% of buyer's agent commissions`} />
        <Card label="Expected — lender fees" value={usd(expectedLenderFees)} note={`${usd(LENDER_PLATFORM_FEE_USD)} per pre-approval`} />
        <Card label="Expected — advocate fees" value={usd(expectedAdvocateFees)} note={`${ADVOCATE_FEE_PCT}% on Loqal-advocate files`} />
        <Card label="Invoiced, awaiting payment" value={usd(outstanding)} note={`${usd(collected)} collected to date`} />
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Balances owed to Loqal</h2>
        {balances.size === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No outstanding balances — all issued invoices are paid.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {[...balances.entries()].map(([email, amount]) => (
              <li key={email} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-semibold text-foreground">{partnerName(email)}</span>
                <span className="font-bold text-destructive">{usd(amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Invoices</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Issue invoices from the Partners tab; mark them paid here when the money arrives.
        </p>
        {invoices.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No invoices issued yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">№</th>
                  <th className="py-2 pr-4 font-semibold">To</th>
                  <th className="py-2 pr-4 font-semibold">Description</th>
                  <th className="py-2 pr-4 font-semibold">Issued</th>
                  <th className="py-2 pr-4 font-semibold">Amount</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2.5 pr-4 font-semibold text-foreground">{inv.number}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{partnerName(inv.toParty)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{inv.description}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(inv.issuedAt)}</td>
                    <td className="py-2.5 pr-4 font-semibold text-foreground">{usd(inv.amount)}</td>
                    <td className="py-2.5">
                      {inv.status === "paid" ? (
                        <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                          Paid {inv.paidAt ? formatDate(inv.paidAt) : ""}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => pay(inv.id, inv.number, inv.amount)}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
                        >
                          Mark paid
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-brand">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}
