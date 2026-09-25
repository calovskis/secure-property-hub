/** Loqal → client: guided, pre-saved entity recommendation (mirrors the realtor purchase-terms pop-up). */
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Building2, Check, Landmark, Plus, Scale, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEntityRequests, type EntityRecommendation, type EntitySetupRequest } from "@/lib/entity-setup";
import {
  emptyRecommendation,
  ENTITY_TYPES,
  FORMATION_STATES,
  LEGAL_ITEMS,
  recommendationComplete,
  recommendationRows,
  TAX_ITEMS,
} from "@/lib/entity-recommendation";

const STEPS = [
  { id: 1, title: "Entity & state", icon: Building2 },
  { id: 2, title: "Agent & ownership", icon: Users },
  { id: 3, title: "Holding & title", icon: Landmark },
  { id: 4, title: "Tax & legal", icon: Scale },
  { id: 5, title: "Review & send", icon: Check },
] as const;
const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";
const draftKey = (id: string) => `loqal.entityRecDraft.v1.${id}`;

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block rounded-md border border-border bg-background p-3">
      <span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>
      {hint ? <span className="mb-2 block text-[11px] text-muted-foreground">{hint}</span> : null}
      {children}
    </label>
  );
}

function Choice({ active, onClick, title, hint }: { active: boolean; onClick: () => void; title: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border p-2.5 text-left text-xs transition-colors ${active ? "border-brand bg-brand-tint/60" : "border-border bg-background hover:border-brand/40"}`}
    >
      <span className="flex items-center gap-1.5 font-semibold text-foreground">
        {active ? <Check className="size-3.5 text-brand" aria-hidden /> : null}
        {title}
      </span>
      {hint ? <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </button>
  );
}

export function EntityRecommendationDialog({
  open,
  onOpenChange,
  request,
  by,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: EntitySetupRequest;
  by: string;
}) {
  const { sendRecommendation } = useEntityRequests();
  const [rec, setRec] = useState<EntityRecommendation>(emptyRecommendation);
  const [step, setStep] = useState(1);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const changes = request.response?.decision === "changes" ? request.response : null;

  useEffect(() => {
    if (!open) return;
    let draft: { rec: EntityRecommendation; step: number } | null = null;
    try {
      const raw = localStorage.getItem(draftKey(request.id));
      if (raw) draft = JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const { version: _v, sentAt: _s, sentBy: _b, ...last } = request.recommendation ?? ({} as never);
    setRec({ ...emptyRecommendation(), ...(request.recommendation ? last : {}), ...(draft?.rec ?? {}) });
    setStep(draft?.step ?? (changes ? 5 : 1));
    setReviewed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = (next: EntityRecommendation, s = step) => {
    try {
      localStorage.setItem(draftKey(request.id), JSON.stringify({ rec: next, step: s }));
    } catch {
      /* ignore */
    }
  };
  const patch = (p: Partial<EntityRecommendation>) =>
    setRec((cur) => {
      const next = { ...cur, ...p };
      save(next);
      return next;
    });
  const goTo = (n: number) => {
    const b = Math.min(5, Math.max(1, n));
    setStep(b);
    save(rec, b);
  };
  const toggle = (key: "tax" | "legal", item: string) =>
    patch({ [key]: rec[key].includes(item) ? rec[key].filter((x) => x !== item) : [...rec[key], item] });

  const missing = recommendationComplete(rec);
  const totalPct = rec.owners.reduce((s, o) => s + (Number(o.percent) || 0), 0);
  const first = request.clientName.split(" ")[0] ?? "the client";

  async function send() {
    if (missing.length) {
      toast("Complete the recommendation first", { description: `Missing: ${missing.join(", ")}` });
      return;
    }
    setBusy(true);
    try {
      await sendRecommendation(request, rec, by);
      localStorage.removeItem(draftKey(request.id));
      toast.success(`Recommendation sent — ${first} will review and confirm it`);
      onOpenChange(false);
    } catch {
      toast.error("Could not send the recommendation. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Entity recommendation for {request.clientName}</DialogTitle>
          <DialogDescription>
            Saved as you go. {first} sees the summary, and confirms it or asks for changes before formation starts.
          </DialogDescription>
        </DialogHeader>

        <ol className="grid grid-cols-5 gap-1.5">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => goTo(s.id)}
                  className={`flex w-full flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-semibold ${
                    step === s.id ? "border-brand bg-brand-tint text-brand" : step > s.id ? "border-success/40 text-success" : "border-border text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                  {s.title}
                </button>
              </li>
            );
          })}
        </ol>

        {changes ? (
          <div className="rounded-lg border border-gold/50 bg-gold-tint/40 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-foreground">{first} asked for changes</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {(changes.items ?? []).map((i) => (
                <li key={i.key} className="rounded-md border border-gold/40 bg-background px-3 py-2">
                  <span className="font-semibold text-foreground">{i.label}:</span> <span className="text-foreground">{i.note}</span>
                </li>
              ))}
              {changes.note ? <li className="italic text-muted-foreground">“{changes.note}”</li> : null}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">Adjust the terms in the steps above, then send the revised version.</p>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <Field label="Entity type">
              <div className="grid gap-2 sm:grid-cols-2">
                {ENTITY_TYPES.map((t) => (
                  <Choice key={t.id} active={rec.entityType === t.id} onClick={() => patch({ entityType: t.id })} title={t.id} hint={t.hint} />
                ))}
              </div>
            </Field>
            <Field label="State of formation">
              <div className="grid gap-2 sm:grid-cols-2">
                {FORMATION_STATES.map((t) => (
                  <Choice key={t.id} active={rec.formationState === t.id} onClick={() => patch({ formationState: t.id })} title={t.id} hint={t.hint} />
                ))}
              </div>
            </Field>
            <Field label="Proposed entity name (optional)" hint="Must include 'LLC' / 'L.L.C.' and be available in the state — Loqal checks availability.">
              <input className={field} value={rec.entityName} onChange={(e) => patch({ entityName: e.target.value })} placeholder="e.g. Maple Street Holdings LLC" />
            </Field>
            <Field label="Registration in the property state" hint="If the entity is formed outside the state where the property is, it usually has to register there as a 'foreign' entity.">
              <div className="flex flex-wrap items-center gap-2">
                <Choice active={!rec.foreignQualification} onClick={() => patch({ foreignQualification: false })} title="Not needed" />
                <Choice active={rec.foreignQualification} onClick={() => patch({ foreignQualification: true })} title="Needed" />
                {rec.foreignQualification ? (
                  <input className={`${field} max-w-48`} value={rec.foreignQualificationState} onChange={(e) => patch({ foreignQualificationState: e.target.value })} placeholder="Property state" />
                ) : null}
              </div>
            </Field>
            <Field label="Why this structure (shown to the client)">
              <textarea className={field} rows={3} value={rec.whyThisStructure} onChange={(e) => patch({ whyThisStructure: e.target.value })} placeholder="Explain in plain words why this fits the client's goals, liability protection, taxes and privacy." />
            </Field>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-3">
            <Field label="Registered agent" hint="Every US entity needs a registered agent with a physical address in the state to receive official and legal mail.">
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={field} value={rec.registeredAgent} onChange={(e) => patch({ registeredAgent: e.target.value })} placeholder="Provider, e.g. Loqal partner agent" />
                <input className={field} value={rec.registeredAgentState} onChange={(e) => patch({ registeredAgentState: e.target.value })} placeholder="State" />
                <input className={field} value={rec.registeredAgentFee} onChange={(e) => patch({ registeredAgentFee: e.target.value })} placeholder="Yearly fee, e.g. 125 USD" />
              </div>
            </Field>
            <Field label="Ownership" hint="Banks and lenders identify every owner of 25% or more. Total should be 100%.">
              <div className="space-y-2">
                {rec.owners.map((o, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5rem_8rem_auto] gap-2">
                    <input className={field} value={o.name} onChange={(e) => patch({ owners: rec.owners.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Owner name or entity" />
                    <input className={field} inputMode="decimal" value={o.percent} onChange={(e) => patch({ owners: rec.owners.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)) })} aria-label="Percent" />
                    <input className={field} value={o.role} onChange={(e) => patch({ owners: rec.owners.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)) })} placeholder="Member" />
                    <button type="button" aria-label="Remove owner" className="px-1 text-muted-foreground hover:text-destructive" onClick={() => patch({ owners: rec.owners.filter((_, j) => j !== i) })}>
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <Button type="button" size="sm" variant="outline" onClick={() => patch({ owners: [...rec.owners, { name: "", percent: "", role: "Member" }] })}>
                    <Plus /> Add owner
                  </Button>
                  <span className={`text-xs font-semibold ${totalPct === 100 ? "text-success" : "text-warning"}`}>Total {totalPct}%</span>
                </div>
              </div>
            </Field>
            <Field label="Manager structure">
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice active={rec.management === "member_managed"} onClick={() => patch({ management: "member_managed" })} title="Member-managed" hint="The owners run the company and sign for it." />
                <Choice active={rec.management === "manager_managed"} onClick={() => patch({ management: "manager_managed" })} title="Manager-managed" hint="An appointed manager signs — keeps passive owners out of daily decisions and public filings." />
              </div>
              <input className={`${field} mt-2`} value={rec.managers} onChange={(e) => patch({ managers: e.target.value })} placeholder="Manager(s) / authorised signatories" />
            </Field>
            <Field label="Operating agreement notes (optional)">
              <textarea className={field} rows={2} value={rec.operatingAgreement} onChange={(e) => patch({ operatingAgreement: e.target.value })} placeholder="e.g. Transfer restrictions, successor manager, distribution rules" />
            </Field>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            <Field label="Is a separate property-holding entity appropriate?">
              <div className="grid gap-2 sm:grid-cols-2">
                <Choice active={rec.separateHolding === "yes"} onClick={() => patch({ separateHolding: "yes" })} title="Yes — separate holding entity" hint="Parent / holding company plus one entity per property." />
                <Choice active={rec.separateHolding === "no"} onClick={() => patch({ separateHolding: "no" })} title="No — one entity is enough" hint="One property or a simple ownership picture." />
              </div>
              {rec.separateHolding === "yes" ? (
                <input className={`${field} mt-2`} value={rec.holdingStructure} onChange={(e) => patch({ holdingStructure: e.target.value })} placeholder="e.g. Wyoming holding LLC owning a Florida property LLC" />
              ) : null}
            </Field>
            <Field label="Reasoning">
              <textarea className={field} rows={2} value={rec.holdingReason} onChange={(e) => patch({ holdingReason: e.target.value })} placeholder="Liability ring-fencing, future properties, privacy, estate planning…" />
            </Field>
            <Field label="How title is taken at closing">
              <input className={field} value={rec.vesting} onChange={(e) => patch({ vesting: e.target.value })} placeholder="e.g. Deed vested in Maple Street Holdings LLC at closing" />
            </Field>
            <Field label="Mortgage lender coordination" hint="Many lenders only lend to an LLC under DSCR / non-QM programs and ask for a personal guarantee.">
              <input className={field} value={rec.lenderNote} onChange={(e) => patch({ lenderNote: e.target.value })} placeholder="e.g. Lender confirmed LLC vesting with a personal guarantee" />
            </Field>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3">
            <Field label="Tax coordination suggestions">
              <div className="grid gap-1.5">
                {TAX_ITEMS.map((t) => (
                  <label key={t} className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs ${rec.tax.includes(t) ? "border-brand bg-brand-tint/50" : "border-border"}`}>
                    <input type="checkbox" className="mt-0.5" checked={rec.tax.includes(t)} onChange={() => toggle("tax", t)} />
                    <span className="text-foreground">{t}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Legal coordination">
              <div className="grid gap-1.5">
                {LEGAL_ITEMS.map((t) => (
                  <label key={t} className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-xs ${rec.legal.includes(t) ? "border-brand bg-brand-tint/50" : "border-border"}`}>
                    <input type="checkbox" className="mt-0.5" checked={rec.legal.includes(t)} onChange={() => toggle("legal", t)} />
                    <span className="text-foreground">{t}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Notes from the tax / legal advisor (optional)">
              <textarea className={field} rows={2} value={rec.taxNotes} onChange={(e) => patch({ taxNotes: e.target.value })} placeholder="e.g. Coordinate with the client's home-country advisor on treaty relief" />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="One-time formation costs">
                <input className={field} value={rec.formationCost} onChange={(e) => patch({ formationCost: e.target.value })} placeholder="State fee + agent + EIN, e.g. ~650 USD" />
              </Field>
              <Field label="Yearly running costs">
                <input className={field} value={rec.annualCost} onChange={(e) => patch({ annualCost: e.target.value })} placeholder="Annual report, agent, tax filings" />
              </Field>
              <Field label="Timeline">
                <input className={field} value={rec.timeline} onChange={(e) => patch({ timeline: e.target.value })} placeholder="e.g. Formed in 5–7 business days, EIN 2–4 weeks" />
              </Field>
              <Field label="What we need from the client">
                <input className={field} value={rec.documentsNeeded} onChange={(e) => patch({ documentsNeeded: e.target.value })} placeholder="Passport, proof of address, signed SS-4" />
              </Field>
            </div>
            <Field label="Additional notes (optional)">
              <textarea className={field} rows={2} value={rec.additionalNotes} onChange={(e) => patch({ additionalNotes: e.target.value })} />
            </Field>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-3">
            {missing.length ? (
              <p className="rounded-md border border-warning/60 bg-warning/10 px-3 py-2 text-xs text-foreground">Still missing: {missing.join(", ")}.</p>
            ) : null}
            <div className="overflow-hidden rounded-lg border border-border">
              {recommendationRows(rec).map((r) => (
                <div key={r.key} className="grid grid-cols-[11rem_1fr] gap-3 border-b border-border px-3 py-2 text-sm last:border-0">
                  <span className="text-xs font-semibold text-muted-foreground">{r.label}</span>
                  <span className="whitespace-pre-wrap text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input type="checkbox" className="mt-1" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
              I reviewed the recommendation and it can be shared with {first}.
            </label>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
          <Button type="button" variant="ghost" disabled={step === 1} onClick={() => goTo(step - 1)}>
            <ArrowLeft /> Back
          </Button>
          {step < 5 ? (
            <Button type="button" onClick={() => goTo(step + 1)}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button type="button" disabled={!reviewed || busy} onClick={send}>
              {request.recommendation ? "Send revised recommendation" : "Confirm and send to client"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
