import { useActiveLeads } from "@/lib/leads";
import { useEffect, useMemo, useState } from "react";
import {
  MORTGAGE_STAGE_LABEL,
  hasPricedOffer,
  leadState,
  mortgageStage,
  type MortgageFileStage,
} from "@/lib/leads";
import { formatDate } from "@/lib/dates";
import { MortgageFileDetail } from "@/components/lender/MortgageFileDetail";
import { useLenderTeam } from "@/lib/lender-team";
import { clientDisplayForPartner } from "@/lib/user-id";
import {
  PURCHASE_STAGE_LABEL,
  PURCHASE_STAGE_TONE,
  usePurchaseProgress,
} from "@/lib/purchase-stage";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

const STAGE_TONE: Record<MortgageFileStage, string> = {
  awaiting_client: "bg-gold-tint text-gold",
  client_on_hold: "bg-warning/10 text-warning",
  client_declined: "bg-destructive/10 text-destructive",
  in_underwriting: "bg-success/10 text-success",
};

export function LenderMortgages({
  canManage,
  focusLeadId,
  onFocusHandled,
}: {
  canManage: boolean;
  focusLeadId?: string | null;
  onFocusHandled?: (() => void) | undefined;
}) {
  const { leads } = useActiveLeads();
  const { scopedStates } = useLenderTeam();
  const [openId, setOpenId] = useState<string | null>(null);
  const [state, setState] = useState("all");
  const [stage, setStage] = useState<MortgageFileStage | "all">("all");
  const { progressOf } = usePurchaseProgress();

  const files = useMemo(
    () =>
      leads
        .filter(hasPricedOffer)
        .filter((l) => (scopedStates ? scopedStates.includes(leadState(l)) : true)),
    [leads, scopedStates],
  );
  const states = useMemo(() => Array.from(new Set(files.map(leadState))).sort(), [files]);
  const visible = files
    .filter((l) => (state === "all" ? true : leadState(l) === state))
    .filter((l) => (stage === "all" ? true : mortgageStage(l) === stage));

  const counts = {
    in_underwriting: files.filter((l) => mortgageStage(l) === "in_underwriting").length,
    awaiting_client: files.filter((l) => mortgageStage(l) === "awaiting_client").length,
    client_on_hold: files.filter((l) => mortgageStage(l) === "client_on_hold").length,
    client_declined: files.filter((l) => mortgageStage(l) === "client_declined").length,
    signed: files.filter((l) => progressOf(l.id).stage === "agreement_signed").length,
    hardCheckOpen: files.filter((l) => progressOf(l.id).hardCheckOpen).length,
  };

  useEffect(() => {
    if (!focusLeadId || !files.some((lead) => lead.id === focusLeadId)) return;
    setState("all");
    setStage("all");
    setOpenId(focusLeadId);
    onFocusHandled?.();
  }, [files, focusLeadId, onFocusHandled]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground md:text-[30px]">Mortgages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every qualified pre-approval opens a mortgage file here. Files move into active work once
          the client confirms the issued terms, and are submitted to the bank after the purchase agreement is signed.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ["Open mortgage files", counts.in_underwriting, "Client confirmed — in work"],
            [
              "Signed purchase agreements",
              counts.signed,
              `${counts.hardCheckOpen} awaiting your loan submission and approval`,
            ],
            ["Awaiting client decision", counts.awaiting_client, "Terms delivered — reminders running"],
            ["On hold by client", counts.client_on_hold, "Client paused the process"],
          ] as const
        ).map(([label, value, note]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 text-3xl font-bold text-brand">{value}</div>
            <div className="mt-2 text-xs text-muted-foreground">{note}</div>
          </div>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", "All files"],
            ["in_underwriting", MORTGAGE_STAGE_LABEL.in_underwriting],
            ["awaiting_client", MORTGAGE_STAGE_LABEL.awaiting_client],
            ["client_on_hold", MORTGAGE_STAGE_LABEL.client_on_hold],
            ["client_declined", MORTGAGE_STAGE_LABEL.client_declined],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStage(id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              stage === id
                ? "bg-brand text-background"
                : "border border-border text-muted-foreground hover:bg-brand-tint"
            }`}
          >
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          State
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
          >
            <option value="all">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No mortgage files in this view. Qualify a pre-approval request and issue terms to see it
          here.
        </div>
      ) : (
        <ul className="space-y-4">
          {visible.map((l) => {
            const t = l.terms!;
            const loan = l.propertyPrice * (1 - t.downPaymentPct / 100);
            const st = mortgageStage(l);
            const open = openId === l.id;
            const prog = progressOf(l.id);
            return (
              <li key={l.id} className="overflow-hidden rounded-lg border border-border bg-card">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : l.id)}
                  className="flex w-full flex-wrap items-center gap-4 p-5 text-left hover:bg-brand-tint/30"
                >
                  <div className="min-w-[200px] flex-1">
                    <div className="text-sm font-semibold text-foreground">
                      {clientDisplayForPartner(l.clientName, l.clientEmail)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.propertyLabel} · {money(l.propertyPrice)}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div className="font-semibold text-foreground">{money(loan)}</div>
                    {t.ratePct}% · {t.termYears}y · {t.downPaymentPct}% down
                  </div>
                  <span className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand">
                    {leadState(l)}
                  </span>
                  {st === "in_underwriting" ? (
                    <span className="flex flex-col items-end gap-1">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${PURCHASE_STAGE_TONE[prog.stage]}`}
                      >
                        {PURCHASE_STAGE_LABEL[prog.stage]}
                      </span>
                      {prog.hardCheckOpen ? (
                        <span className="text-[11px] font-semibold text-destructive">
                          Loan submission due{" "}
                          {prog.approvalDueDate ? formatDate(prog.approvalDueDate) : "now"}
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${STAGE_TONE[st]}`}
                    >
                      {MORTGAGE_STAGE_LABEL[st]}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
                </button>
                {open ? <MortgageFileDetail lead={l} /> : null}
              </li>
            );
          })}
        </ul>
      )}

      {!canManage ? (
        <p className="text-xs text-muted-foreground">
          Your seat has read-only access to mortgage servicing actions.
        </p>
      ) : null}
    </div>
  );
}
