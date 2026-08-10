import { useMemo, useState } from "react";
import {
  computeDti,
  totalMonthlyObligations,
  LEAD_STATUS_LABEL,
  useLeads,
  type LeadStatus,
  type MortgageLead,
} from "@/lib/leads";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const date = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "bg-gold-tint text-gold",
  info_required: "bg-brand-tint text-brand",
  not_qualified: "bg-destructive/10 text-destructive",
  qualified: "bg-success/10 text-success",
};

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

function StatusPill({ status }: { status: LeadStatus }) {
  return (
    <span
      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ${STATUS_TONE[status]}`}
    >
      {LEAD_STATUS_LABEL[status]}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right font-semibold text-foreground">{value}</strong>
    </div>
  );
}

function ApplicantFile({ lead }: { lead: MortgageLead }) {
  const p = lead.profile;
  const annual = p.monthlyGross * 12;
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-foreground">Applicant</h3>
        <div className="mt-2 divide-y divide-border">
          <Row label="Name" value={lead.clientName} />
          <Row label="Email" value={lead.clientEmail} />
          <Row label="Date of birth" value={p.dateOfBirth || "—"} />
          <Row
            label="US person"
            value={lead.usPerson ? "US citizen / green card holder" : "Non-US person"}
          />
          {lead.usPerson ? (
            <Row label="SSN" value={p.ssn ? `••• •• ${p.ssn.slice(-4)}` : "Not provided"} />
          ) : (
            <>
              <Row label="ITIN" value={p.hasItin ? p.itin || "Provided" : "No ITIN"} />
              <Row label="Country of residence" value={p.countryOfResidence || "—"} />
              <Row
                label="Citizenship"
                value={[p.citizenship, p.secondCitizenship].filter(Boolean).join(" / ") || "—"}
              />
              <Row
                label="US visa"
                value={
                  p.usVisaActive ? `Active · ${p.visaIssued} → ${p.visaValidUntil}` : "Not active"
                }
              />
              <Row label="Intended use" value={p.propertyUse ?? "—"} />
              <Row label="US bank account" value={p.usBankAccount ? "Yes" : "No"} />
            </>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground">Subject property</h3>
        <div className="mt-2 divide-y divide-border">
          <Row label="Property" value={lead.propertyLabel} />
          <Row label="List price" value={money(lead.propertyPrice)} />
          <Row label="Submitted" value={date(lead.submittedAt)} />
        </div>
      </section>

      {p.addresses.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground">Address history (2 years)</h3>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {p.addresses.map((a) => (
              <li key={a.id} className="rounded-md border border-border bg-background p-3">
                <div className="font-semibold text-foreground">
                  {a.street}, {a.city} {a.state} {a.zip}
                </div>
                <div className="text-xs">
                  {a.from} → {a.to}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.employment.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground">Employment history (2 years)</h3>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {p.employment.map((e) => (
              <li key={e.id} className="rounded-md border border-border bg-background p-3">
                <div className="font-semibold text-foreground">
                  {e.title} — {e.employer}
                </div>
                <div className="text-xs">
                  {e.from} → {e.current ? "Present" : e.to}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-foreground">Income</h3>
        <div className="mt-2 divide-y divide-border">
          <Row label="Monthly gross" value={p.monthlyGross ? money(p.monthlyGross) : "Not provided"} />
          <Row label="Annual gross" value={annual ? money(annual) : "Not provided"} />
        </div>
      </section>
    </div>
  );
}

function Step2Summary({ lead }: { lead: MortgageLead }) {
  if (!lead.debts) return null;
  const obligations = totalMonthlyObligations(lead.debts);
  const dti = computeDti({
    monthlyIncome: lead.profile.monthlyGross,
    obligations,
    dtiLimit: lead.dtiLimit,
    listPrice: lead.propertyPrice,
  });
  return (
    <section className="rounded-lg border border-border bg-brand-tint/30 p-4">
      <h3 className="text-sm font-semibold text-foreground">
        Step 2 — affordability (client submitted)
      </h3>
      <div className="mt-2 divide-y divide-border">
        <Row label="Property loan payments" value={money(lead.debts.propertyLoans)} />
        <Row label="Vehicle loan payments" value={money(lead.debts.vehicleLoans)} />
        <Row label="Insurance costs" value={money(lead.debts.insurance)} />
        {lead.debts.other.map((o) => (
          <Row key={o.id} label={o.label || "Other obligation"} value={money(o.amount)} />
        ))}
        <Row label="Total monthly obligations" value={money(obligations)} />
        <Row label="DTI ceiling applied" value={`${Math.round(dti.dtiLimit * 100)}%`} />
        <Row label="Max purchase price" value={money(dti.maxPurchasePrice)} />
        <Row
          label="DTI at list price"
          value={`${Math.round(dti.dtiAtListPrice * 100)}% · ${
            dti.qualifiesAtListPrice ? "within policy" : "over policy"
          }`}
        />
      </div>
    </section>
  );
}

function DecisionPanel({ lead }: { lead: MortgageLead }) {
  const { updateLead, addInfoRequest } = useLeads();
  const [score, setScore] = useState(lead.creditScore ? String(lead.creditScore) : "");
  const [note, setNote] = useState(lead.lenderNote ?? "");
  const [dtiLimit, setDtiLimit] = useState(String(Math.round(lead.dtiLimit * 100)));
  const [question, setQuestion] = useState("");
  const [needsDoc, setNeedsDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function decide(status: LeadStatus) {
    const parsed = Number(score);
    if (!parsed || parsed < 300 || parsed > 850) {
      setError("A soft credit report score between 300 and 850 is required with every decision.");
      return;
    }
    if (status === "info_required" && !question.trim()) {
      setError("Describe what the client must answer or upload.");
      return;
    }
    setError(null);
    const limit = Math.min(Math.max(Number(dtiLimit) || 50, 20), 60) / 100;
    updateLead(lead.id, {
      status,
      creditScore: parsed,
      lenderNote: note.trim(),
      dtiLimit: limit,
      decidedAt: new Date().toISOString(),
    });
    if (status === "info_required") {
      addInfoRequest(lead.id, question.trim(), needsDoc);
      setQuestion("");
      setNeedsDoc(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Pre-qualification feedback</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Soft credit report score <span className="text-destructive">*</span>
          </span>
          <input
            inputMode="numeric"
            placeholder="720"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            DTI ceiling for this applicant (%)
          </span>
          <input
            inputMode="numeric"
            value={dtiLimit}
            onChange={(e) => setDtiLimit(e.target.value)}
            className={inputClass}
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Default policy is 50%; adjust for applicant-specific criteria.
          </span>
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Note to Loqal / client
        </span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="rounded-md border border-border bg-brand-tint/30 p-3">
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Information request (used with “More information required”)
        </span>
        <textarea
          rows={2}
          placeholder="e.g. Please upload your last two pay stubs and confirm your bonus structure."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className={inputClass}
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={needsDoc}
            onChange={(e) => setNeedsDoc(e.target.checked)}
          />
          A document upload is required
        </label>
      </div>

      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => decide("qualified")}
          className="rounded-md bg-success px-4 py-2.5 text-sm font-semibold text-background hover:opacity-90"
        >
          Qualified
        </button>
        <button
          type="button"
          onClick={() => decide("info_required")}
          className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
        >
          More information required
        </button>
        <button
          type="button"
          onClick={() => decide("not_qualified")}
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/20"
        >
          Not qualified
        </button>
      </div>
    </div>
  );
}

function Thread({ lead }: { lead: MortgageLead }) {
  if (lead.infoRequests.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">
        Case communication (saved under this property)
      </h3>
      <ul className="mt-2 space-y-3">
        {lead.infoRequests.map((r) => (
          <li key={r.id} className="rounded-md border border-border bg-background p-3 text-sm">
            <div className="font-semibold text-foreground">You asked</div>
            <p className="text-muted-foreground">{r.question}</p>
            <div className="mt-1 text-[11px] text-muted-foreground">{date(r.requestedAt)}</div>
            {r.answeredAt ? (
              <div className="mt-3 rounded-md bg-brand-tint/40 p-3">
                <div className="font-semibold text-foreground">Client replied</div>
                <p className="text-muted-foreground">{r.answer || "(no written answer)"}</p>
                {r.documents.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {r.documents.map((d) => (
                      <li key={d.id} className="text-xs text-brand">
                        📎 {d.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-1 text-[11px] text-muted-foreground">{date(r.answeredAt)}</div>
              </div>
            ) : (
              <div className="mt-2 text-xs font-semibold text-gold">Awaiting client response</div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LenderPortal({ lenderName }: { lenderName: string }) {
  const { leads } = useLeads();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");

  const visible = useMemo(
    () => (filter === "all" ? leads : leads.filter((l) => l.status === filter)),
    [leads, filter],
  );
  const selected = leads.find((l) => l.id === selectedId) ?? visible[0];

  const counts = useMemo(
    () => ({
      new: leads.filter((l) => l.status === "new").length,
      info: leads.filter((l) => l.status === "info_required").length,
      qualified: leads.filter((l) => l.status === "qualified").length,
    }),
    [leads],
  );

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
      <div className="mb-6">
        <span className="rounded-full bg-gold-tint px-3 py-1 text-xs font-semibold text-gold">
          Mortgage lender portal
        </span>
        <h1 className="mt-3 text-2xl font-bold text-foreground md:text-[32px]">
          Pre-approval inbox
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {lenderName} · Every Loqal client pre-approval application lands here. Review the file,
          run your own underwriting, then return a decision with the soft credit score.
        </p>
      </div>

      {counts.new > 0 ? (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-gold/40 bg-gold-tint px-4 py-3">
          <span className="text-lg">🔔</span>
          <p className="text-sm font-semibold text-foreground">
            {counts.new} new incoming {counts.new === 1 ? "inquiry" : "inquiries"} awaiting your
            pre-qualification feedback.
          </p>
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          ["New inquiries", String(counts.new), "Pinned for immediate review"],
          ["Awaiting client info", String(counts.info), "Documents or answers requested"],
          ["Qualified", String(counts.qualified), "Moved to Step 2 affordability"],
        ].map(([label, value, note]) => (
          <div key={label} className="rounded-lg border border-border bg-card p-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 text-3xl font-bold text-brand">{value}</div>
            <div className="mt-2 text-xs text-muted-foreground">{note}</div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(["all", "new", "info_required", "qualified", "not_qualified"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  filter === f
                    ? "bg-brand text-background"
                    : "border border-border text-muted-foreground hover:bg-brand-tint"
                }`}
              >
                {f === "all" ? "All" : LEAD_STATUS_LABEL[f]}
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No applications in this view yet.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {visible.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full py-3 text-left ${
                      selected?.id === l.id ? "opacity-100" : "opacity-80 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{l.clientName}</span>
                      <StatusPill status={l.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {l.propertyLabel} · {money(l.propertyPrice)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{date(l.submittedAt)}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          {!selected ? (
            <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              Select an application to review the full client file.
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">
                      Pre-approval application — {selected.clientName}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {selected.propertyLabel}
                      {selected.creditScore ? ` · soft score ${selected.creditScore}` : ""}
                    </p>
                  </div>
                  <StatusPill status={selected.status} />
                </div>
                <ApplicantFile lead={selected} />
              </div>

              {selected.debts ? <Step2Summary lead={selected} /> : null}
              <Thread lead={selected} />
              {selected.status === "not_qualified" ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  Marked not qualified{selected.creditScore ? ` (score ${selected.creditScore})` : ""}.
                  This decision is final for this application.
                </div>
              ) : (
                <DecisionPanel key={selected.id} lead={selected} />
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
