/**
 * Financial analytics for realtor partners: the monetary view of the buyer
 * pipeline — gross buyer's-agent commissions, Loqal's platform fee and the
 * expected net payout per file.
 */
import { type MortgageLead } from "@/lib/leads";
import { REALTOR_COMMISSION_PCT, REALTOR_PLATFORM_FEE_PCT, usd } from "@/lib/accounting";

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

export function RealtorFinancialAnalytics({ mine }: { mine: MortgageLead[] }) {
  const rows = mine.map((lead) => {
    const gross = (lead.propertyPrice * REALTOR_COMMISSION_PCT) / 100;
    const fee = (gross * REALTOR_PLATFORM_FEE_PCT) / 100;
    return { lead, gross, fee, net: gross - fee };
  });
  const totals = rows.reduce(
    (acc, r) => ({ gross: acc.gross + r.gross, fee: acc.fee + r.fee, net: acc.net + r.net }),
    { gross: 0, fee: 0, net: 0 },
  );
  const avg = rows.length ? totals.gross / rows.length : 0;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat
          label="Gross commission pipeline"
          value={usd(totals.gross)}
          note={`${REALTOR_COMMISSION_PCT}% of purchase prices`}
        />
        <Stat
          label="Loqal platform fee"
          value={usd(totals.fee)}
          note={`${REALTOR_PLATFORM_FEE_PCT}% of commission`}
        />
        <Stat label="Expected net payout" value={usd(totals.net)} note="After the platform fee" />
        <Stat
          label="Avg. commission per file"
          value={usd(avg)}
          note={`${rows.length} active file${rows.length === 1 ? "" : "s"}`}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Commission per file</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Commissions are paid at closing; Loqal invoices its {REALTOR_PLATFORM_FEE_PCT}% platform
          fee at that point.
        </p>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No files yet — monetary KPIs appear once buyers are assigned to you.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Buyer</th>
                  <th className="py-2 pr-4 font-semibold">Property</th>
                  <th className="py-2 pr-4 font-semibold">Purchase price</th>
                  <th className="py-2 pr-4 font-semibold">Gross ({REALTOR_COMMISSION_PCT}%)</th>
                  <th className="py-2 pr-4 font-semibold">Platform fee</th>
                  <th className="py-2 font-semibold">Net payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ lead, gross, fee, net }) => (
                  <tr key={lead.id}>
                    <td className="py-2.5 pr-4 font-semibold text-foreground">{lead.clientName}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{lead.propertyLabel}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{usd(lead.propertyPrice)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{usd(gross)}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{usd(fee)}</td>
                    <td className="py-2.5 font-semibold text-foreground">{usd(net)}</td>
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
