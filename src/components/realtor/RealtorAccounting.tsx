/**
 * Realtor accounting: expected commission per buyer file (3% at closing),
 * the Loqal platform fee share (20% of commission) and invoices between the
 * agent and Loqal with payment recording.
 */
import { toast } from "sonner";
import { type MortgageLead } from "@/lib/leads";
import {
  REALTOR_COMMISSION_PCT,
  REALTOR_PLATFORM_FEE_PCT,
  usd,
  useAccounting,
} from "@/lib/accounting";
import { formatDate } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import type { Realtor } from "@/lib/realtors";
import { fullName } from "@/lib/auth";

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

export function RealtorAccounting({ me, mine }: { me: Realtor; mine: MortgageLead[] }) {
  const { invoices, markPaid } = useAccounting();

  const rows = mine.map((l) => {
    const gross = (l.propertyPrice * REALTOR_COMMISSION_PCT) / 100;
    const fee = (gross * REALTOR_PLATFORM_FEE_PCT) / 100;
    return { lead: l, gross, fee, net: gross - fee };
  });
  const totals = rows.reduce(
    (s, r) => ({ gross: s.gross + r.gross, fee: s.fee + r.fee, net: s.net + r.net }),
    { gross: 0, fee: 0, net: 0 },
  );

  const myInvoices = invoices.filter(
    (i) => i.toParty === me.email || i.fromParty === me.email,
  );
  const outstanding = myInvoices
    .filter((i) => i.status === "sent" && i.toParty === me.email)
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Expected gross" value={usd(totals.gross)} note="3% commission at closing" />
        <Stat
          label="Loqal platform fee"
          value={usd(totals.fee)}
          note={`${REALTOR_PLATFORM_FEE_PCT}% of commission`}
        />
        <Stat label="Net to you" value={usd(totals.net)} note="After the platform fee" />
        <Stat label="Invoiced & unpaid" value={usd(outstanding)} note="Owed to Loqal" />
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Commission per file</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Commissions are paid at closing; Loqal invoices its {REALTOR_PLATFORM_FEE_PCT}% platform
          fee per file.
        </p>
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No active buyer files — expected commissions appear here.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Property</th>
                  <th className="py-2 pr-4 font-semibold">Buyer</th>
                  <th className="py-2 pr-4 font-semibold">Price</th>
                  <th className="py-2 pr-4 font-semibold">Gross 3%</th>
                  <th className="py-2 pr-4 font-semibold">Loqal fee</th>
                  <th className="py-2 font-semibold">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(({ lead, gross, fee, net }) => (
                  <tr key={lead.id}>
                    <td className="py-2.5 pr-4 font-semibold text-foreground">
                      {lead.propertyLabel}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{lead.clientName}</td>
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

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Invoices</h2>
        {myInvoices.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No invoices yet — Loqal issues the platform-fee invoice when a file reaches closing.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {myInvoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {i.number} · {usd(i.amount)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {i.description} · issued {formatDate(i.issuedAt)}
                  </div>
                </div>
                {i.status === "paid" ? (
                  <span className="rounded-full bg-success/10 px-3 py-1 text-[11px] font-semibold text-success">
                    Paid {i.paidAt ? formatDate(i.paidAt) : ""}
                  </span>
                ) : i.toParty === me.email ? (
                  <button
                    type="button"
                    onClick={() => {
                      markPaid(i.id);
                      logActivity(
                        `${me.firstName} ${me.lastName}`.trim(),
                        "paid a Loqal invoice",
                        `${i.number} · ${usd(i.amount)}`,
                      );
                      toast("Payment recorded", { description: `${i.number} marked as paid.` });
                    }}
                    className="rounded-md bg-brand px-3.5 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
                  >
                    Record payment
                  </button>
                ) : (
                  <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
                    Sent
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
