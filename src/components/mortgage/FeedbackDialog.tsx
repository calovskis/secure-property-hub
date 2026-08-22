/**
 * Client-facing view of the mortgage lender's pre-approval feedback, opened
 * as a modal from My Profile / the case card. Shows the terms issued by the
 * lending company (with its NMLS number), hides soft credit score and DTI
 * ceiling for applicants without an SSN, and renders taxes + insurance as a
 * dollar amount (percentages stay lender/admin-side).
 */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LEAD_STATUS_LABEL, type MortgageLead } from "@/lib/leads";
import { formatDate } from "@/lib/dates";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-foreground">{value}</div>
    </div>
  );
}

export function FeedbackDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: MortgageLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const terms = lead.terms;
  const taxesInsuranceYear = terms
    ? Math.round((lead.propertyPrice * terms.taxInsurancePct) / 100)
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Lender feedback — {lead.propertyLabel}
          </DialogTitle>
          <DialogDescription>
            {LEAD_STATUS_LABEL[lead.status]}
            {lead.decidedAt ? ` · issued ${formatDate(lead.decidedAt)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {terms?.lenderName ? (
          <p className="rounded-md bg-brand-tint/50 px-3 py-2 text-xs text-muted-foreground">
            Terms provided by{" "}
            <strong className="text-foreground">{terms.lenderName}</strong>
            {terms.lenderNmls ? ` · ${terms.lenderNmls}` : ""}.
          </p>
        ) : null}

        {lead.creditScore ? (
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
            <span className="text-sm text-muted-foreground">Soft credit report score</span>
            <strong className="text-xl font-bold text-brand">{lead.creditScore}</strong>
          </div>
        ) : null}

        {terms ? (
          <div className="grid grid-cols-2 gap-3">
            <Term label="Interest rate" value={`${terms.ratePct}%`} />
            <Term label="Loan term" value={`${terms.termYears} years`} />
            <Term label="Down payment" value={`${terms.downPaymentPct}%`} />
            <Term label="Closing costs" value={`${terms.closingCostPct}%`} />
            {taxesInsuranceYear !== null ? (
              <Term
                label="Taxes + insurance (est.)"
                value={`${money(taxesInsuranceYear)} / year`}
              />
            ) : null}
          </div>
        ) : null}

        {lead.lenderNote ? (
          <div className="rounded-lg border border-border bg-background p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Note from the lender
            </div>
            <p className="mt-1 text-sm text-foreground">{lead.lenderNote}</p>
          </div>
        ) : null}

        {lead.status === "qualified" ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            These are preliminary estimated terms and can change in the final mortgage proposal,
            which is issued after the Purchase Agreement is signed.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
