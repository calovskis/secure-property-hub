/**
 * Loqal admin console sections: the platform-wide activity feed, employee
 * tracking derived from it, and the partner comparison with the agreement
 * countersignature queue and platform-fee invoicing.
 */
import { toast } from "sonner";
import { useActivity } from "@/lib/activity";
import { usePartnerRequests } from "@/lib/partner-requests";
import { useRealtors } from "@/lib/realtors";
import { useLeads } from "@/lib/leads";
import {
  LENDER_PLATFORM_FEE_USD,
  REALTOR_COMMISSION_PCT,
  REALTOR_PLATFORM_FEE_PCT,
  usd,
  useAccounting,
} from "@/lib/accounting";
import { logActivity } from "@/lib/activity";
import { PARTNER_LABEL } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";

/* ------------------------------- Activity -------------------------------- */

export function ActivityFeed() {
  const entries = useActivity();
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">Platform activity</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Every meaningful action across clients, partners and Loqal staff.
      </p>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No activity recorded yet — registrations, decisions and signatures appear here.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-foreground">
                  <strong>{e.actor}</strong> {e.action}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(e.at)}</span>
              </div>
              {e.details ? (
                <div className="mt-0.5 text-xs text-muted-foreground">{e.details}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ---------------------------- Employee tracking --------------------------- */

export function EmployeeTracking() {
  const entries = useActivity();
  const byActor = new Map<string, { count: number; last: string }>();
  for (const e of entries) {
    const cur = byActor.get(e.actor);
    if (cur) {
      cur.count += 1;
      if (e.at > cur.last) cur.last = e.at;
    } else {
      byActor.set(e.actor, { count: 1, last: e.at });
    }
  }
  const rows = [...byActor.entries()].sort((a, b) => b[1].count - a[1].count);

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">Employee tracking</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Actions per person across the platform — staff, partners and system actors.
      </p>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing tracked yet. Activity appears as people use the platform.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-4 font-semibold">Person</th>
                <th className="py-2 pr-4 font-semibold">Actions</th>
                <th className="py-2 font-semibold">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map(([actor, s]) => (
                <tr key={actor}>
                  <td className="py-2.5 pr-4 font-semibold text-foreground">{actor}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{s.count}</td>
                  <td className="py-2.5 text-muted-foreground">{formatDateTime(s.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/* ---------------------------- Partner comparison -------------------------- */

export function PartnerComparison() {
  const { requests, updateRequest } = usePartnerRequests();
  const { realtors } = useRealtors();
  const { leads } = useLeads();
  const { issueInvoice } = useAccounting();

  const approved = requests.filter((r) => r.status === "approved");
  const lenders = approved.filter((r) => r.partnerType === "lender");
  const issuedPreApprovals = leads.filter((l) => l.status === "qualified");
  const buyerFiles = leads.filter((l) => l.clientDecision === "accepted" && l.buyerAgent);

  const realtorFeeRevenue = buyerFiles.reduce(
    (s, l) => s + (l.propertyPrice * REALTOR_COMMISSION_PCT * REALTOR_PLATFORM_FEE_PCT) / 10000,
    0,
  );
  const lenderFeeRevenue = issuedPreApprovals.length * LENDER_PLATFORM_FEE_USD;

  const awaitingCountersign = approved.filter(
    (r) => r.agreementSignedAt && !r.agreementCountersignedAt,
  );

  function countersign(id: string, company: string) {
    updateRequest(id, { agreementCountersignedAt: new Date().toISOString() });
    logActivity("Loqal admin", "countersigned a partnership agreement", company);
    toast("Agreement countersigned", { description: `${company} is now fully active.` });
  }

  function invoiceRealtor(email: string, name: string) {
    const files = buyerFiles.filter((l) =>
      realtors.some((r) => r.email === email && l.buyerAgent?.agentId === r.id),
    );
    if (!files.length) return toast("Nothing to invoice", { description: "No active buyer files." });
    const amount = files.reduce(
      (s, l) => s + (l.propertyPrice * REALTOR_COMMISSION_PCT * REALTOR_PLATFORM_FEE_PCT) / 10000,
      0,
    );
    issueInvoice({
      fromParty: "Loqal",
      toParty: email,
      description: `Platform fee — ${files.length} buyer file${files.length === 1 ? "" : "s"} in closing`,
      amount,
      currency: "USD",
    });
    logActivity("Loqal admin", "issued a platform-fee invoice", `${name} · ${usd(amount)}`);
    toast("Invoice issued", { description: `${name} · ${usd(amount)}` });
  }

  function invoiceLender(email: string, company: string) {
    const amount = issuedPreApprovals.length * LENDER_PLATFORM_FEE_USD;
    if (!amount) return toast("Nothing to invoice", { description: "No pre-approvals issued yet." });
    issueInvoice({
      fromParty: "Loqal",
      toParty: email,
      description: `Platform fee — ${issuedPreApprovals.length} originated pre-approval${issuedPreApprovals.length === 1 ? "" : "s"}`,
      amount,
      currency: "USD",
    });
    logActivity("Loqal admin", "issued a platform-fee invoice", `${company} · ${usd(amount)}`);
    toast("Invoice issued", { description: `${company} · ${usd(amount)}` });
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Realtor partners" value={realtors.filter((r) => r.approvedAt).length} note="Approved" />
        <Stat label="Lender partners" value={lenders.length} note="Approved companies" />
        <Stat
          label="Platform fees — realtors"
          value={usd(realtorFeeRevenue)}
          note={`${REALTOR_PLATFORM_FEE_PCT}% of commissions on active files`}
        />
        <Stat
          label="Platform fees — lenders"
          value={usd(lenderFeeRevenue)}
          note={`${usd(LENDER_PLATFORM_FEE_USD)} per pre-approval`}
        />
      </section>

      {awaitingCountersign.length ? (
        <section className="rounded-lg border border-gold/40 bg-gold-tint/30 p-6">
          <h2 className="text-base font-semibold text-foreground">
            Agreements awaiting Loqal countersignature
          </h2>
          <ul className="mt-3 space-y-3">
            {awaitingCountersign.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card p-3"
              >
                <div className="text-sm">
                  <strong className="text-foreground">{r.companyName}</strong>
                  <span className="ml-2 text-xs text-muted-foreground">
                    signed by {r.agreementSignedBy} · {formatDateTime(r.agreementSignedAt!)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => countersign(r.id, r.companyName)}
                  className="rounded-md bg-success px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
                >
                  Countersign
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Approved partners</h2>
        {approved.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No approved partners yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">Company</th>
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 pr-4 font-semibold">KYB</th>
                  <th className="py-2 pr-4 font-semibold">Agreement</th>
                  <th className="py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {approved.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 pr-4">
                      <div className="font-semibold text-foreground">{r.companyName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.firstName} {r.lastName} · approved {formatDate(r.decidedAt ?? r.submittedAt)}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {r.kind === "partner" ? PARTNER_LABEL[r.partnerType ?? "other"] : "Corporate"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {r.kyc ? (
                        <span
                          className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success"
                          title={`Director: ${r.kyc.director.fullName} · ${r.kyc.shareholders.length} shareholder(s) ≥25%`}
                        >
                          Submitted
                        </span>
                      ) : (
                        <span className="rounded-full bg-gold-tint px-2.5 py-1 text-[11px] font-semibold text-gold">
                          Missing
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      {r.agreementCountersignedAt ? (
                        <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                          Active
                        </span>
                      ) : r.agreementSignedAt ? (
                        <span className="rounded-full bg-gold-tint px-2.5 py-1 text-[11px] font-semibold text-gold">
                          Countersign
                        </span>
                      ) : (
                        <span className="rounded-full bg-brand-tint px-2.5 py-1 text-[11px] font-semibold text-brand">
                          Awaiting partner
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <button
                        type="button"
                        onClick={() =>
                          r.partnerType === "lender"
                            ? invoiceLender(r.email, r.companyName)
                            : invoiceRealtor(r.email, `${r.firstName} ${r.lastName}`)
                        }
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
                      >
                        Issue platform-fee invoice
                      </button>
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
