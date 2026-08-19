import type { MortgageLead } from "@/lib/leads";
import { countryLabel } from "@/data/countries";
import { currencyLabel } from "@/data/currencies";
import { formatDate, formatDateTime, isoToUsMonth } from "@/lib/dates";
import {
  INCOME_TYPE_LABEL,
  MARITAL_LABEL,
  RELATED_PARTY_LABEL,
  UNMARRIED_RELATIONSHIP_LABEL,
  monthlyForIncome,
  num,
  totalLiabilities,
  type Declarations,
  type IncomeSource,
} from "@/lib/mortgage-form";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const date = (iso?: string) => formatDateTime(iso);
const yesNo = (v?: boolean) => (v ? "Yes" : "No");

export function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className="text-right font-semibold text-foreground">{value}</strong>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-2 divide-y divide-border">{children}</div>
    </section>
  );
}

function addressLine(a: {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}) {
  return (
    [a.street, a.city, a.state, a.zip, a.country ? countryLabel(a.country) : ""]
      .filter(Boolean)
      .join(", ") || "—"
  );
}

function IncomeCard({ s }: { s: IncomeSource }) {
  const monthly = monthlyForIncome(s);
  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {s.employer || "—"} {s.title ? `· ${s.title}` : ""}
        </span>
        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand">
          {INCOME_TYPE_LABEL[s.type]}
        </span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{addressLine(s.address)}</div>
      <div className="text-xs text-muted-foreground">
        {isoToUsMonth(s.from) || "—"} → {s.current ? "Present" : isoToUsMonth(s.to) || "—"}
      </div>
      <div className="mt-2 divide-y divide-border">
        {s.type === "w2" ? (
          <>
            <Row label="Pay type" value={s.payType === "hourly" ? "Hourly" : "Salary"} />
            {s.payType === "hourly" ? (
              <Row
                label="Hourly rate × monthly hours"
                value={`$${s.hourlyRate || "—"} × ${s.monthlyHours || "—"} h`}
              />
            ) : (
              <Row label="Monthly salary (gross)" value={money(num(s.salaryMonthly))} />
            )}
            <Row
              label="Related party"
              value={`${RELATED_PARTY_LABEL[s.relatedParty]}${
                s.relatedPartyDetail ? ` — ${s.relatedPartyDetail}` : ""
              }`}
            />
          </>
        ) : null}
        {s.type === "self_employed" ? (
          <>
            <Row label="Ownership" value={s.ownershipPct ? `${s.ownershipPct}%` : "—"} />
            <Row label="Business type" value={s.businessType || "—"} />
            <Row label="Net income — year 1" value={money(num(s.netIncomeYear1))} />
            <Row label="Net income — year 2" value={money(num(s.netIncomeYear2))} />
          </>
        ) : null}
        {s.type === "seasonal" ? (
          <>
            <Row label="Gross per working month" value={money(num(s.seasonMonthlyGross))} />
            <Row label="Working months per year" value={s.monthsPerYear || "—"} />
          </>
        ) : null}
        {s.type === "foreign" ? (
          <>
            <Row label="Currency" value={s.currency ? currencyLabel(s.currency) : "—"} />
            <Row
              label="Monthly gross (local)"
              value={`${num(s.monthlyGrossForeign).toLocaleString()} ${s.currency}`}
            />
            <Row label="Rate applied to USD" value={s.fxRate || "—"} />
          </>
        ) : null}
        <Row label="Qualifying monthly (USD)" value={money(monthly)} />
      </div>
    </li>
  );
}

const DECLARATION_ROWS: [keyof Declarations, string][] = [
  ["primaryResidence", "Will occupy as primary residence"],
  ["ownershipInterestLast3Years", "Ownership interest in the last 3 years"],
  ["familyOrBusinessWithSeller", "Family or business affiliation with the seller"],
  ["borrowingOtherMoney", "Borrowing other money for this purchase"],
  ["applyingOtherMortgage", "Applying for another mortgage"],
  ["applyingNewCredit", "Applying for new credit"],
  ["priorityLien", "Property subject to a priority lien"],
  ["coSignerOrGuarantor", "Co-signer or guarantor on other debt"],
  ["outstandingJudgments", "Outstanding judgments"],
  ["delinquentFederalDebt", "Delinquent federal debt"],
  ["partyToLawsuit", "Party to a lawsuit"],
  ["conveyedTitleInLieu", "Conveyed title in lieu of foreclosure"],
  ["preForeclosureOrShortSale", "Pre-foreclosure or short sale"],
  ["propertyForeclosed", "Property foreclosed"],
  ["bankruptcy", "Bankruptcy"],
];

export function ApplicantFile({ lead }: { lead: MortgageLead }) {
  const p = lead.profile;
  const annual = p.monthlyGross * 12;
  const incomes = p.incomes ?? [];
  const liabilities = p.liabilities;
  const decl = p.declarations;
  const mil = p.military;
  const demo = p.demographics;

  return (
    <div className="space-y-6">
      <Block title="Applicant">
        <Row label="Name" value={lead.clientName} />
        <Row label="Email" value={lead.clientEmail} />
        <Row label="Date of birth" value={p.dateOfBirth ? formatDate(p.dateOfBirth) : "—"} />
        <Row
          label="Marital status"
          value={p.maritalStatus ? MARITAL_LABEL[p.maritalStatus] : "—"}
        />
        {p.unmarriedAddendum?.hasSpousalEquivalent ? (
          <Row
            label="Unmarried addendum"
            value={`${
              p.unmarriedAddendum.relationship
                ? UNMARRIED_RELATIONSHIP_LABEL[p.unmarriedAddendum.relationship]
                : "Spousal-equivalent rights"
            }${
              p.unmarriedAddendum.stateFormed ? ` · formed in ${p.unmarriedAddendum.stateFormed}` : ""
            }`}
          />
        ) : null}
        <Row
          label="Dependents"
          value={
            p.dependents && p.dependents.length
              ? `${p.dependents.length} (ages ${p.dependents.map((d) => d.age || "—").join(", ")})`
              : "None"
          }
        />
      </Block>

      <Block title="Citizenship & identification">
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
            <Row label="US bank account" value={yesNo(p.usBankAccount)} />
          </>
        )}
      </Block>

      <Block title="Subject property">
        <Row label="Property" value={lead.propertyLabel} />
        <Row label="Requested purchase price" value={money(lead.propertyPrice)} />
        <Row label="Submitted" value={date(lead.submittedAt)} />
      </Block>

      {p.addresses.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground">Address history (2 years)</h3>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {p.addresses.map((a) => (
              <li key={a.id} className="rounded-md border border-border bg-background p-3">
                <div className="font-semibold text-foreground">{addressLine(a)}</div>
                <div className="text-xs">
                  {isoToUsMonth(a.from) || "—"} →{" "}
                  {a.present ? "Present" : isoToUsMonth(a.to) || "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {incomes.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground">
            Income sources & employment (2 years)
          </h3>
          <ul className="mt-2 space-y-2">
            {incomes.map((s) => (
              <IncomeCard key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ) : p.employment.length > 0 ? (
        <section>
          <h3 className="text-sm font-semibold text-foreground">Employment history (2 years)</h3>
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            {p.employment.map((e) => (
              <li key={e.id} className="rounded-md border border-border bg-background p-3">
                <div className="font-semibold text-foreground">
                  {e.title} — {e.employer}
                </div>
                <div className="text-xs">
                  {isoToUsMonth(e.from) || "—"} → {e.current ? "Present" : isoToUsMonth(e.to) || "—"}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Block title="Income summary">
        <Row label="Monthly gross" value={p.monthlyGross ? money(p.monthlyGross) : "Not provided"} />
        <Row label="Annual gross" value={annual ? money(annual) : "Not provided"} />
      </Block>

      {liabilities ? (
        <Block title="Monthly liabilities">
          <Row label="Property loans" value={money(num(liabilities.propertyLoans))} />
          <Row label="Vehicle loans" value={money(num(liabilities.vehicleLoans))} />
          <Row label="Credit cards" value={money(num(liabilities.creditCards))} />
          <Row label="Student loans" value={money(num(liabilities.studentLoans))} />
          <Row label="Alimony / child support" value={money(num(liabilities.alimonyChildSupport))} />
          <Row label="Insurance" value={money(num(liabilities.insurance))} />
          {liabilities.other.map((o) => (
            <Row key={o.id} label={o.label || "Other obligation"} value={money(num(o.amount))} />
          ))}
          <Row label="Total monthly obligations" value={money(totalLiabilities(liabilities))} />
        </Block>
      ) : null}

      {mil ? (
        <Block title="Military service">
          <Row label="Served in the US Armed Forces" value={yesNo(mil.served)} />
          {mil.served ? (
            <>
              <Row
                label="Currently on active duty"
                value={
                  mil.activeDuty
                    ? `Yes${
                        mil.activeDutyExpiration
                          ? ` · until ${formatDate(mil.activeDutyExpiration)}`
                          : ""
                      }`
                    : "No"
                }
              />
              <Row label="Retired / discharged" value={yesNo(mil.retiredOrDischarged)} />
              <Row label="Reserve or National Guard only" value={yesNo(mil.reserveOrNationalGuardOnly)} />
              <Row label="Surviving spouse" value={yesNo(mil.survivingSpouse)} />
            </>
          ) : null}
        </Block>
      ) : null}

      {decl ? (
        <Block title="Declarations">
          {DECLARATION_ROWS.map(([key, label]) => (
            <Row key={key} label={label} value={yesNo(Boolean(decl[key]))} />
          ))}
          {decl.ownershipInterestLast3Years ? (
            <Row
              label="Prior property / title held"
              value={[decl.priorPropertyType, decl.priorTitleHeld].filter(Boolean).join(" · ") || "—"}
            />
          ) : null}
          {decl.borrowingOtherMoney ? (
            <Row label="Other borrowed amount" value={money(num(decl.borrowingOtherAmount))} />
          ) : null}
          {decl.bankruptcy && decl.bankruptcyChapters.length ? (
            <Row label="Bankruptcy chapters" value={decl.bankruptcyChapters.join(", ")} />
          ) : null}
        </Block>
      ) : null}

      {demo ? (
        <Block title="Demographic information (HMDA)">
          <Row
            label="Ethnicity"
            value={
              demo.ethnicityDeclined
                ? "Declined to provide"
                : [...demo.ethnicity, demo.ethnicityOther].filter(Boolean).join(", ") || "—"
            }
          />
          <Row
            label="Race"
            value={
              demo.raceDeclined
                ? "Declined to provide"
                : [...demo.race, demo.raceOther].filter(Boolean).join(", ") || "—"
            }
          />
          <Row
            label="Sex"
            value={
              demo.sex === "declined"
                ? "Declined to provide"
                : demo.sex
                  ? demo.sex[0]!.toUpperCase() + demo.sex.slice(1)
                  : "—"
            }
          />
        </Block>
      ) : null}
    </div>
  );
}
