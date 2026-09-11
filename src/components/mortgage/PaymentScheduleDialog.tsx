import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/dates";
import type { MortgageLead } from "@/lib/leads";

const money = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;

type YearRow = {
  year: number;
  interest: number;
  principal: number;
  taxesInsurance: number;
  balance: number;
};

export function buildSchedule(lead: MortgageLead) {
  const t = lead.terms!;
  const price = lead.propertyPrice;
  const downPayment = (price * t.downPaymentPct) / 100;
  const closingCosts = (price * t.closingCostPct) / 100;
  const loan = price - downPayment;
  const taxInsYear = (price * t.taxInsurancePct) / 100;
  const taxInsMonth = taxInsYear / 12;
  const months = Math.round(t.termYears * 12);
  const r = t.ratePct / 100 / 12;
  const pi =
    r === 0 ? loan / months : (loan * r) / (1 - Math.pow(1 + r, -months));

  const years: YearRow[] = [];
  let balance = loan;
  let totalInterest = 0;
  for (let y = 1; y <= t.termYears; y += 1) {
    let interestY = 0;
    let principalY = 0;
    for (let m = 0; m < 12 && balance > 0.01; m += 1) {
      const interest = balance * r;
      const principal = Math.min(pi - interest, balance);
      balance -= principal;
      interestY += interest;
      principalY += principal;
    }
    totalInterest += interestY;
    years.push({
      year: y,
      interest: interestY,
      principal: principalY,
      taxesInsurance: taxInsYear,
      balance: Math.max(balance, 0),
    });
  }

  return {
    price,
    loan,
    downPayment,
    closingCosts,
    cashToClose: downPayment + closingCosts,
    pi,
    taxInsMonth,
    taxInsYear,
    monthlyTotal: pi + taxInsMonth,
    months,
    totalInterest,
    totalPaid: pi * months + taxInsYear * t.termYears,
    years,
    terms: t,
  };
}

export function PaymentScheduleDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: MortgageLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const s = useMemo(() => (lead.terms ? buildSchedule(lead) : null), [lead]);
  if (!s) return null;

  const rows = showAll ? s.years : s.years.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="bg-brand-tint/30 px-6 py-5">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold text-foreground">
              Payment schedule
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {lead.propertyLabel} · terms issued {formatDate(s.terms.issuedAt)}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-6 px-6 pb-6 pt-5">
          <div className="rounded-xl border border-brand/25 bg-brand-tint/30 p-5 text-center">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estimated monthly payment
            </div>
            <div className="mt-1 text-4xl font-bold text-brand">{money(s.monthlyTotal)}</div>
            <div className="mt-1 text-xs text-muted-foreground">per month for {s.terms.termYears} years</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Loan (principal + interest)
                </div>
                <div className="text-sm font-semibold text-foreground">{money(s.pi)} / mo</div>
              </div>
              <div className="rounded-lg border border-border bg-card px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Taxes + insurance
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {money(s.taxInsMonth)} / mo
                </div>
              </div>
            </div>
          </div>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What you pay upfront
            </h4>
            <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
              <Row label="Purchase price" value={money(s.price)} />
              <Row
                label={`Down payment (${s.terms.downPaymentPct}%)`}
                value={money(s.downPayment)}
              />
              <Row
                label={`Closing costs (${s.terms.closingCostPct}%)`}
                value={money(s.closingCosts)}
              />
              <Row label="Cash needed at closing" value={money(s.cashToClose)} strong />
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Over the full term
            </h4>
            <div className="divide-y divide-border rounded-xl border border-border bg-card px-4">
              <Row label="Loan amount" value={money(s.loan)} />
              <Row label={`Interest rate`} value={`${s.terms.ratePct}%`} />
              <Row label="Total interest paid" value={money(s.totalInterest)} />
              <Row
                label="Total taxes + insurance"
                value={money(s.taxInsYear * s.terms.termYears)}
              />
              <Row label="Total paid over the term" value={money(s.totalPaid)} strong />
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Year by year
            </h4>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Year</th>
                    <th className="px-3 py-2 text-right font-semibold">Principal</th>
                    <th className="px-3 py-2 text-right font-semibold">Interest</th>
                    <th className="px-3 py-2 text-right font-semibold">Taxes + ins.</th>
                    <th className="px-3 py-2 text-right font-semibold">Balance left</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((y) => (
                    <tr key={y.year} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 text-muted-foreground">{y.year}</td>
                      <td className="px-3 py-2 text-right text-foreground">{money(y.principal)}</td>
                      <td className="px-3 py-2 text-right text-foreground">{money(y.interest)}</td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {money(y.taxesInsurance)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-foreground">
                        {money(y.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {s.years.length > 5 ? (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="mt-2 text-xs font-semibold text-brand hover:underline"
              >
                {showAll ? "Show first 5 years" : `Show all ${s.years.length} years`}
              </button>
            ) : null}
          </section>

          <p className="rounded-md border border-border bg-background/70 p-3 text-[11px] leading-relaxed text-muted-foreground">
            This schedule is an estimate based on the preliminary terms issued for this property.
            Taxes and insurance are spread evenly across the year and can change. The final numbers
            come with the mortgage proposal issued after the Purchase Agreement is signed.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className={strong ? "font-bold text-brand" : "font-semibold text-foreground"}>
        {value}
      </strong>
    </div>
  );
}

export function PaymentScheduleButton({
  lead,
  className,
}: {
  lead: MortgageLead;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!lead.terms) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-background px-3 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand-tint/40"
        }
      >
        See payment schedule
      </button>
      <PaymentScheduleDialog lead={lead} open={open} onOpenChange={setOpen} />
    </>
  );
}
