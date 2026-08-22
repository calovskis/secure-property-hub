/**
 * Realtor analytics: pipeline size, delivery speed on photo requests,
 * completed calls/visits and the expected commission pipeline — the monetary
 * KPIs a buyer's agent tracks on Loqal.
 */
import { KICKOFF_LABEL, type MortgageLead } from "@/lib/leads";
import { buyerAgentSummary, useBuyerProcess } from "@/lib/buyer-process";
import { REALTOR_COMMISSION_PCT, usd } from "@/lib/accounting";
import type { Realtor } from "@/lib/realtors";

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

export function RealtorAnalytics({ me, mine }: { me: Realtor; mine: MortgageLead[] }) {
  const { photos, bookings } = useBuyerProcess();

  const myPhotos = mine
    .map((l) => photos[l.id])
    .filter((p): p is NonNullable<typeof p> => !!p);
  const delivered = myPhotos.filter((p) => p.status === "delivered" && p.deliveredAt);
  const avgDeliveryHours =
    delivered.length > 0
      ? delivered.reduce(
          (s, p) =>
            s + (new Date(p.deliveredAt!).getTime() - new Date(p.requestedAt).getTime()) / 3600000,
          0,
        ) / delivered.length
      : null;

  const myBookings = bookings.filter((b) => b.realtorId === me.id);
  const completedCalls = myBookings.filter((b) => b.status === "confirmed" && b.endedAt).length;
  const upcoming = myBookings.filter((b) => b.status === "confirmed" && !b.endedAt).length;

  const pipeline = mine.reduce(
    (s, l) => s + (l.propertyPrice * REALTOR_COMMISSION_PCT) / 100,
    0,
  );

  const loqalRep = mine.filter((l) => l.buyerAgent?.representation === "loqal_rep").length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Active buyer files" value={mine.length} note={`${loqalRep} with Loqal advocate`} />
        <Stat
          label="Photo sets delivered"
          value={delivered.length}
          note={
            avgDeliveryHours !== null
              ? `Avg. ${avgDeliveryHours.toFixed(1)}h (target ≤ 72h)`
              : "None delivered yet"
          }
        />
        <Stat label="Calls & visits" value={completedCalls} note={`${upcoming} upcoming`} />
        <Stat
          label="Commission pipeline"
          value={usd(pipeline)}
          note={`${REALTOR_COMMISSION_PCT}% of purchase prices at closing`}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">File-by-file pipeline</h2>
        {mine.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No files yet — analytics appear once buyers are assigned to you.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Buyer</th>
                  <th className="py-2 pr-4 font-semibold">Property</th>
                  <th className="py-2 pr-4 font-semibold">Kickoff</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Expected commission</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mine.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5 pr-4 font-semibold text-foreground">{l.clientName}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{l.propertyLabel}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {l.buyerAgent?.kickoff ? KICKOFF_LABEL[l.buyerAgent.kickoff] : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {buyerAgentSummary(l, { photos, bookings, actions: {} }) ?? "—"}
                    </td>
                    <td className="py-2.5 font-semibold text-foreground">
                      {usd((l.propertyPrice * REALTOR_COMMISSION_PCT) / 100)}
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
