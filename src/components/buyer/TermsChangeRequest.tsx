/**
 * Buyer-side "ask my agent to change something": the buyer ticks the exact
 * terms they want different and sets the new value with the same kind of
 * inputs the agent used when preparing them.
 */
import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { DateInput } from "@/components/form/DateInput";
import { formatDate } from "@/lib/dates";
import { formatPrice, getProperty } from "@/data/properties";
import {
  HOME_WARRANTY_LABEL,
  INSPECTION_TYPES,
  POSSESSION_LABEL,
  commissionText,
  completeTerms,
  depositAmount,
  propertyCategory,
  type AgreementTerms,
  type CommissionPayer,
  type HomeWarrantyMode,
  type PossessionMode,
} from "@/lib/purchase-agreement";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";
const chip = (on: boolean) =>
  `rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
    on ? "border-brand bg-brand text-background" : "border-border bg-background text-foreground hover:bg-brand-tint"
  }`;

type Key =
  | "closing"
  | "deposit"
  | "possession"
  | "inspection"
  | "appraisal"
  | "financing"
  | "attorney"
  | "commission"
  | "concessions"
  | "warranty"
  | "items"
  | "expiry"
  | "other";

const plural = (n: number, w = "day") => `${n} ${w}${n === 1 ? "" : "s"}`;

export type TermsChange = { label: string; from: string; to: string };

export function TermsChangeRequest({
  price,
  terms: raw,
  propertyId,
  agentName,
  onSend,
  onCancel,
}: {
  price: number;
  terms: AgreementTerms;
  propertyId: number;
  agentName: string;
  onSend: (changes: TermsChange[], note: string) => void;
  onCancel: () => void;
}) {
  const terms = useMemo(() => completeTerms(raw, raw.paymentMode === "financed"), [raw]);
  const [draft, setDraft] = useState<AgreementTerms>(terms);
  const [picked, setPicked] = useState<Key[]>([]);
  const [note, setNote] = useState("");
  const [otherText, setOtherText] = useState("");
  const inspectionOptions = INSPECTION_TYPES[propertyCategory(getProperty(propertyId)?.type)];
  const set = (p: Partial<AgreementTerms>) => setDraft((d) => ({ ...d, ...p }));

  const describe: Record<Key, { label: string; show: boolean; text: (t: AgreementTerms) => string }> = {
    closing: { label: "Target closing date", show: true, text: (t) => formatDate(t.closingDate) },
    deposit: {
      label: "Deposit (earnest money)",
      show: true,
      text: (t) =>
        `${formatPrice(depositAmount(price, t))}${t.depositMode === "custom" ? " (custom)" : ` (${t.depositPct}%)`}, within ${plural(t.depositDays, "business day")}`,
    },
    possession: { label: "Possession / key handover", show: true, text: (t) => POSSESSION_LABEL[t.possession] },
    inspection: {
      label: "Inspections",
      show: true,
      text: (t) =>
        t.inspection
          ? `Within ${plural(t.inspectionDeadlineDays)}${t.inspectionTypes.length ? `: ${t.inspectionTypes.join(", ")}` : ""}`
          : "Not included",
    },
    appraisal: {
      label: "Appraisal",
      show: true,
      text: (t) => (t.appraisal ? `Within ${plural(t.appraisalDeadlineDays)}` : "Not included"),
    },
    financing: {
      label: "Financing protection",
      show: t0(terms).paymentMode === "financed",
      text: (t) =>
        t.financing
          ? `Submission in ${plural(t.mortgageSubmissionDays)}, approval in ${plural(t.finalLoanApprovalDays)}`
          : "Not included",
    },
    attorney: {
      label: "Attorney review",
      show: terms.attorneyApplicable,
      text: (t) => plural(t.attorneyReviewDays, "business day"),
    },
    commission: { label: "Buyer's agent commission", show: true, text: (t) => commissionText(t) },
    concessions: { label: "Seller credits", show: true, text: (t) => t.sellerConcessions || "None" },
    warranty: { label: "Home warranty", show: true, text: (t) => HOME_WARRANTY_LABEL[t.homeWarranty] },
    items: {
      label: "Included / excluded items",
      show: true,
      text: (t) => `Included: ${t.includedItems || "as listed"} · Excluded: ${t.excludedItems || "none"}`,
    },
    expiry: { label: "Offer expires", show: true, text: (t) => `${plural(t.offerExpiresDays)} from signing` },
    other: { label: "Something else", show: true, text: () => otherText.trim() || "—" },
  };
  const keys = (Object.keys(describe) as Key[]).filter((k) => describe[k].show);

  function toggle(k: Key) {
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  }

  const changes: TermsChange[] = picked
    .map((k) => ({
      label: describe[k].label,
      from: k === "other" ? "" : describe[k].text(terms),
      to: describe[k].text(draft),
    }))
    .filter((c) => c.from !== c.to && c.to !== "—");
  const invalid =
    (picked.includes("deposit") && draft.depositMode === "custom" && !(draft.depositAmount > 0)) ||
    (picked.includes("inspection") && draft.inspection && draft.inspectionTypes.length === 0);

  const num = (value: number, onChange: (n: number) => void, suffix: string, min = 0, max = 365) => (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))}
        className={`${inputClass} w-24`}
      />
      {suffix}
    </label>
  );
  const toggleRow = (on: boolean, onChange: (v: boolean) => void, yes = "Include", no = "Remove") => (
    <div className="flex gap-2">
      <button type="button" className={chip(on)} onClick={() => onChange(true)}>{yes}</button>
      <button type="button" className={chip(!on)} onClick={() => onChange(false)}>{no}</button>
    </div>
  );

  function editor(k: Key) {
    switch (k) {
      case "closing":
        return <DateInput value={draft.closingDate} onChange={(v) => set({ closingDate: v })} className={inputClass} />;
      case "deposit":
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {[5, 10, 15].map((p) => (
                <button key={p} type="button" className={chip(draft.depositMode === "pct" && draft.depositPct === p)} onClick={() => set({ depositMode: "pct", depositPct: p })}>
                  {p}%
                </button>
              ))}
              <button type="button" className={chip(draft.depositMode === "custom")} onClick={() => set({ depositMode: "custom" })}>
                Custom amount
              </button>
            </div>
            {draft.depositMode === "custom" ? num(draft.depositAmount, (n) => set({ depositAmount: n }), "USD", 0, 100_000_000) : null}
            {num(draft.depositDays, (n) => set({ depositDays: n }), "business days to pay", 1, 30)}
          </div>
        );
      case "possession":
        return (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(POSSESSION_LABEL) as PossessionMode[]).map((m) => (
              <button key={m} type="button" className={chip(draft.possession === m)} onClick={() => set({ possession: m })}>
                {POSSESSION_LABEL[m]}
              </button>
            ))}
          </div>
        );
      case "inspection":
        return (
          <div className="space-y-2">
            {toggleRow(draft.inspection, (v) => set({ inspection: v }))}
            {draft.inspection ? (
              <>
                {num(draft.inspectionDeadlineDays, (n) => set({ inspectionDeadlineDays: n }), "days from signing", 1, 90)}
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {inspectionOptions.map((o) => {
                    const on = draft.inspectionTypes.includes(o);
                    return (
                      <label key={o} className="flex items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            set({ inspectionTypes: on ? draft.inspectionTypes.filter((x) => x !== o) : [...draft.inspectionTypes, o] })
                          }
                        />
                        {o}
                      </label>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>
        );
      case "appraisal":
        return (
          <div className="space-y-2">
            {toggleRow(draft.appraisal, (v) => set({ appraisal: v }))}
            {draft.appraisal ? num(draft.appraisalDeadlineDays, (n) => set({ appraisalDeadlineDays: n }), "days from signing", 1, 90) : null}
          </div>
        );
      case "financing":
        return (
          <div className="space-y-2">
            {toggleRow(draft.financing, (v) => set({ financing: v }))}
            {draft.financing ? (
              <>
                {num(draft.mortgageSubmissionDays, (n) => set({ mortgageSubmissionDays: n }), "days to submit the mortgage", 1, 90)}
                {num(draft.finalLoanApprovalDays, (n) => set({ finalLoanApprovalDays: n }), "days to final loan approval", 1, 180)}
              </>
            ) : null}
          </div>
        );
      case "attorney":
        return num(draft.attorneyReviewDays, (n) => set({ attorneyReviewDays: n }), "business days", 1, 30);
      case "commission":
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(["seller", "buyer", "split"] as CommissionPayer[]).map((p) => (
                <button key={p} type="button" className={chip(draft.commissionPayer === p)} onClick={() => set({ commissionPayer: p })}>
                  {p === "seller" ? "Seller pays" : p === "buyer" ? "I pay" : "Split"}
                </button>
              ))}
            </div>
            {draft.commissionPayer === "split" ? (
              <label className="block text-xs text-muted-foreground">
                Seller {draft.commissionSellerSharePct}% / buyer {100 - draft.commissionSellerSharePct}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={draft.commissionSellerSharePct}
                  onChange={(e) => set({ commissionSellerSharePct: Number(e.target.value) })}
                  className="mt-1 w-full accent-brand"
                />
              </label>
            ) : null}
          </div>
        );
      case "concessions":
        return (
          <input
            value={draft.sellerConcessions}
            onChange={(e) => set({ sellerConcessions: e.target.value })}
            placeholder="e.g. $5,000 toward closing costs"
            className={inputClass}
          />
        );
      case "warranty":
        return (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(HOME_WARRANTY_LABEL) as HomeWarrantyMode[]).map((m) => (
              <button key={m} type="button" className={chip(draft.homeWarranty === m)} onClick={() => set({ homeWarranty: m })}>
                {HOME_WARRANTY_LABEL[m]}
              </button>
            ))}
          </div>
        );
      case "items":
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <input value={draft.includedItems} onChange={(e) => set({ includedItems: e.target.value })} placeholder="Included (e.g. appliances)" className={inputClass} />
            <input value={draft.excludedItems} onChange={(e) => set({ excludedItems: e.target.value })} placeholder="Excluded" className={inputClass} />
          </div>
        );
      case "expiry":
        return num(draft.offerExpiresDays, (n) => set({ offerExpiresDays: n }), "days", 1, 30);
      case "other":
        return (
          <textarea rows={2} value={otherText} onChange={(e) => setOtherText(e.target.value)} placeholder="Describe what should be different" className={inputClass} />
        );
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">What would you like to change?</p>
        <p className="text-xs text-muted-foreground">Tick the terms you want different, then set what you'd prefer.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {keys.map((k) => {
          const on = picked.includes(k);
          return (
            <button key={k} type="button" onClick={() => toggle(k)} className={`inline-flex items-center gap-1 ${chip(on)}`} aria-pressed={on}>
              {on ? <Check className="h-3 w-3" aria-hidden /> : null}
              {describe[k].label}
            </button>
          );
        })}
      </div>

      {picked.map((k) => (
        <div key={k} className="space-y-2 rounded-md border border-brand/30 bg-brand-tint/30 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-brand">{describe[k].label}</span>
            {k !== "other" ? (
              <span className="text-[11px] text-muted-foreground">Now: {describe[k].text(terms)}</span>
            ) : null}
          </div>
          {editor(k)}
        </div>
      ))}

      {changes.length ? (
        <div className="rounded-md border border-border p-3 text-xs">
          <p className="font-semibold text-foreground">Your request to {agentName}</p>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {changes.map((c) => (
              <li key={c.label}>
                <strong className="text-foreground">{c.label}:</strong>{" "}
                {c.from ? <><span className="line-through">{c.from}</span> → </> : null}
                <span className="text-foreground">{c.to}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to add for your agent (optional)" className={inputClass} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={(!changes.length && !note.trim()) || invalid}
          onClick={() => onSend(changes, note.trim())}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
        >
          Send to {agentName}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint">
          Cancel
        </button>
      </div>
    </div>
  );
}

function t0(t: AgreementTerms) {
  return t;
}
