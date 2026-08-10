import { hasPricedOffer, useLeads } from "@/lib/leads";
import { formatDate } from "@/lib/dates";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function LenderMortgages({ canManage }: { canManage: boolean }) {
  const { leads } = useLeads();
  const active = leads.filter(hasPricedOffer);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-[30px]">Mortgages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Files that received a priced offer — track pricing, conditions and closing progress.
        </p>
      </div>

      {active.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No priced mortgages yet. Qualify a pre-approval request and issue terms to see it here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Borrower</th>
                <th className="px-4 py-3 font-semibold">Property</th>
                <th className="px-4 py-3 font-semibold">Loan amount</th>
                <th className="px-4 py-3 font-semibold">Rate / term</th>
                <th className="px-4 py-3 font-semibold">Down</th>
                <th className="px-4 py-3 font-semibold">Score</th>
                <th className="px-4 py-3 font-semibold">Issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {active.map((l) => {
                const t = l.terms!;
                const loan = l.propertyPrice * (1 - t.downPaymentPct / 100);
                return (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-semibold text-foreground">{l.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{l.propertyLabel}</td>
                    <td className="px-4 py-3 text-foreground">{money(loan)}</td>
                    <td className="px-4 py-3 text-foreground">
                      {t.ratePct}% · {t.termYears}y
                    </td>
                    <td className="px-4 py-3 text-foreground">{t.downPaymentPct}%</td>
                    <td className="px-4 py-3 text-foreground">{l.creditScore ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(t.issuedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          Your seat has read-only access to mortgage servicing actions.
        </p>
      ) : null}
    </div>
  );
}
