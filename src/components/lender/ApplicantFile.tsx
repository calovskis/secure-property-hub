import type { MortgageLead } from "@/lib/leads";
import { countryLabel } from "@/data/countries";
import { formatDate, formatDateTime, isoToUsMonth } from "@/lib/dates";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const date = (iso?: string) => formatDateTime(iso);

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right font-semibold text-foreground">{value}</strong>
    </div>
  );
}

export function ApplicantFile({ lead }: { lead: MortgageLead }) {
  const p = lead.profile;
  const annual = p.monthlyGross * 12;
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-foreground">Applicant</h3>
        <div className="mt-2 divide-y divide-border">
          <Row label="Name" value={lead.clientName} />
          <Row label="Email" value={lead.clientEmail} />
          <Row label="Date of birth" value={p.dateOfBirth ? formatDate(p.dateOfBirth) : "—"} />
          <Row
            label="US person"
            value={lead.usPerson ? "US citizen / green card holder" : "Non-US person"}
          />
          {lead.usPerson ? (
            <Row label="SSN" value={p.ssn ? `••• •• ${p.ssn.slice(-4)}` : "Not provided"} />
          ) : (
            <>
              <Row label="ITIN" value={p.hasItin ? p.itin || "Provided" : "No ITIN"} />
              <Row label="Country of residence" value={countryLabel(p.countryOfResidence) || "—"} />
              <Row
                label="Citizenship"
                value={
                  [countryLabel(p.citizenship), countryLabel(p.secondCitizenship)]
                    .filter(Boolean)
                    .join(" / ") || "—"
                }
              />
              <Row
                label="US visa"
                value={
                  p.usVisaActive
                    ? `Active · ${formatDate(p.visaIssued)} → ${formatDate(p.visaValidUntil)}`
                    : "Not active"
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
                  {isoToUsMonth(a.from) || "—"} → {isoToUsMonth(a.to) || "—"}
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
                  {isoToUsMonth(e.from) || "—"} →{" "}
                  {e.current ? "Present" : isoToUsMonth(e.to) || "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold text-foreground">Income</h3>
        <div className="mt-2 divide-y divide-border">
          <Row
            label="Monthly gross"
            value={p.monthlyGross ? money(p.monthlyGross) : "Not provided"}
          />
          <Row label="Annual gross" value={annual ? money(annual) : "Not provided"} />
        </div>
      </section>
    </div>
  );
}
