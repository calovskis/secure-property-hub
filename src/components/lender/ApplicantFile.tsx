import { useState } from "react";
import type { MortgageLead } from "@/lib/leads";
import { LEAD_STATUS_LABEL } from "@/lib/leads";
import { countryLabel } from "@/data/countries";
import { currencyLabel } from "@/data/currencies";
import { formatDate, formatDateTime, isoToUsMonth } from "@/lib/dates";
import {
  INCOME_TYPE_LABEL,
  MARITAL_LABEL,
  RELATED_PARTY_LABEL,
  UNMARRIED_RELATIONSHIP_LABEL,
  US_STATUS_LABEL,
  isForeignIncome,
  monthlyForIncome,
  monthlyNativeForIncome,
  num,
  totalLiabilities,
  totalAssets,
  totalMonthlyIncome,
  usStatusOf,
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

function Block({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {note ? <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p> : null}
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
  const foreign = isForeignIncome(s);
  const native = monthlyNativeForIncome(s);
  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">
          {s.employer || "—"} {s.title ? `· ${s.title}` : ""}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand">
            {INCOME_TYPE_LABEL[s.type]}
          </span>
          {foreign ? (
            <span className="rounded-full bg-gold-tint px-2 py-0.5 text-[11px] font-semibold text-gold">
              Foreign income
            </span>
          ) : null}
        </div>
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
              <Row label="Annual salary (gross)" value={money(num(s.annualSalary))} />
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
            <Row label="Annual income — last year" value={money(num(s.annualIncomeLastYear))} />
            <Row
              label="Estimated annual income — this year"
              value={money(num(s.estimatedAnnualIncome))}
            />
          </>
        ) : null}
        {s.type === "seasonal" ? (
          <>
            <Row label="Gross per working month" value={money(num(s.seasonMonthlyGross))} />
            <Row label="Working months per year" value={s.monthsPerYear || "—"} />
          </>
        ) : null}
        {foreign ? (
          <>
            <Row label="Currency" value={s.currency ? currencyLabel(s.currency) : "—"} />
            <Row
              label="Monthly gross (native currency)"
              value={`${Math.round(native).toLocaleString()} ${s.currency || ""}`.trim()}
            />
            <Row label="FX rate applied (USD per unit)" value={s.fxRate || "—"} />
          </>
        ) : null}
        <Row label="Qualifying monthly (USD)" value={money(monthly)} />
      </div>
    </li>
  );
}

const DECLARATION_ROWS: [keyof Declarations, string, boolean?][] = [
  ["primaryResidence", "Will occupy as primary residence", true],
  ["ownershipInterestLast3Years", "Ownership interest in the last 3 years"],
  ["familyOrBusinessWithSeller", "Family or business affiliation with the seller", true],
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

const TABS = [
  { id: "personal", label: "Personal & household" },
  { id: "addresses", label: "Addresses" },
  { id: "income", label: "Employment & income" },
  { id: "liabilities", label: "Assets & Liabilities" },
  { id: "declarations", label: "Declarations & military" },
  { id: "demographics", label: "Demographics" },
  { id: "documents", label: "Documents & requests" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ApplicantFile({ lead }: { lead: MortgageLead }) {
  const [tab, setTab] = useState<TabId>("personal");
  const p = lead.profile;
  const incomes = p.incomes ?? [];
  const monthlyIncome = incomes.length ? totalMonthlyIncome(incomes) : p.monthlyGross;
  const annual = monthlyIncome * 12;
  const liabilities = p.liabilities;
  const decl = p.declarations;
  const mil = p.military;
  const demo = p.demographics;
  const usStatus = usStatusOf(p, lead.usPerson);

  /** Derived — occupancy comes from the applicant's declared property use. */
  const derivedPrimaryResidence = !p.propertyUse;
  /** Derived — from any income source flagged as related to the seller/a family member. */
  const derivedFamilyOrBusinessWithSeller = incomes.some(
    (s) => s.relatedParty === "property_seller" || s.relatedParty === "family_member",
  );

  const documents: { id: string; label: string; when?: string; url?: string }[] = [];
  if (p.visaDocuments?.length) {
    for (const document of p.visaDocuments) {
      documents.push({
        id: document.id,
        label: `Visa document — ${document.name}`,
        when: document.uploadedAt,
        url: document.url,
      });
    }
  } else if (p.visaDocumentName) {
    documents.push({
      id: "visa",
      label: `Visa document — ${p.visaDocumentName}`,
      ...(p.visaDocumentUploadedAt ? { when: p.visaDocumentUploadedAt } : {}),
    });
  }
  for (const r of lead.infoRequests) {
    for (const d of r.documents) {
      documents.push({ id: d.id, label: d.name, when: d.uploadedAt });
    }
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 -mx-1 rounded-lg border border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground">{lead.clientName}</h2>
            <p className="text-xs text-muted-foreground">{lead.clientEmail}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
              {US_STATUS_LABEL[usStatus]}
            </span>
            <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
              {LEAD_STATUS_LABEL[lead.status]}
            </span>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            Requested purchase price:{" "}
            <strong className="text-foreground">{money(lead.propertyPrice)}</strong>
          </span>
          <span>{lead.propertyLabel}</span>
          {lead.assignedToName ? (
            <span>
              Assignee: <strong className="text-foreground">{lead.assignedToName}</strong>
            </span>
          ) : (
            <span>Unassigned</span>
          )}
          <span>Submitted {date(lead.submittedAt)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "bg-brand text-background"
                : "border border-border text-muted-foreground hover:bg-brand-tint"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "personal" ? (
        <div className="space-y-4">
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
                  p.unmarriedAddendum.stateFormed
                    ? ` · formed in ${p.unmarriedAddendum.stateFormed}`
                    : ""
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
            <Row label="US status" value={US_STATUS_LABEL[usStatus]} />
            {lead.usPerson ? (
              <Row label="SSN" value={p.ssn ? `••• •• ${p.ssn.slice(-4)}` : "Not provided"} />
            ) : (
              <>
                <Row label="ITIN" value={p.hasItin ? p.itin || "Provided" : "No ITIN"} />
                <Row
                  label="Country of residence"
                  value={countryLabel(p.countryOfResidence) || "—"}
                />
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
                <Row label="Intended use" value={p.propertyUse ?? "Primary residence"} />
                <Row label="US bank account" value={yesNo(p.usBankAccount)} />
              </>
            )}
          </Block>

          <Block title="Subject property">
            <Row label="Property" value={lead.propertyLabel} />
            <Row label="Requested purchase price" value={money(lead.propertyPrice)} />
            <Row label="Submitted" value={date(lead.submittedAt)} />
          </Block>
        </div>
      ) : null}

      {tab === "addresses" ? (
        <Block title="Address history (2 years)">
          {p.addresses.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No addresses provided.</p>
          ) : (
            <ul className="space-y-2 py-2">
              {p.addresses.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-border bg-background p-3 text-sm"
                >
                  <div className="font-semibold text-foreground">{addressLine(a)}</div>
                  <div className="text-xs text-muted-foreground">
                    {isoToUsMonth(a.from) || "—"} →{" "}
                    {a.present ? "Present" : isoToUsMonth(a.to) || "—"}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Block>
      ) : null}

      {tab === "income" ? (
        <div className="space-y-4">
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
              <h3 className="text-sm font-semibold text-foreground">
                Employment history (2 years)
              </h3>
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
          ) : (
            <p className="text-sm text-muted-foreground">No income or employment on file.</p>
          )}

          <Block title="Income summary">
            <Row
              label="Monthly gross (USD)"
              value={monthlyIncome ? money(monthlyIncome) : "Not provided"}
            />
            <Row label="Annual gross (USD)" value={annual ? money(annual) : "Not provided"} />
          </Block>
        </div>
      ) : null}

      {tab === "liabilities" ? (
        <Block title="Monthly liabilities">
          {liabilities ? (
            <>
              <Row label="Property loans" value={money(num(liabilities.propertyLoans))} />
              <Row label="Vehicle loans" value={money(num(liabilities.vehicleLoans))} />
              <Row label="Credit cards" value={money(num(liabilities.creditCards))} />
              <Row label="Student loans" value={money(num(liabilities.studentLoans))} />
              {liabilities.other.map((o) => (
                <Row
                  key={o.id}
                  label={o.label || "Other obligation"}
                  value={money(num(o.amount))}
                />
              ))}
              <Row label="Total monthly obligations" value={money(totalLiabilities(liabilities))} />
            </>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">No liabilities on file.</p>
          )}
        </Block>
      ) : null}

      {tab === "declarations" ? (
        <div className="space-y-4">
          {decl ? (
            <Block title="Declarations">
              {DECLARATION_ROWS.map(([key, label, derived]) => (
                <div key={key}>
                  <Row
                    label={derived ? `${label} *` : label}
                    value={yesNo(
                      key === "primaryResidence"
                        ? derivedPrimaryResidence
                        : key === "familyOrBusinessWithSeller"
                          ? derivedFamilyOrBusinessWithSeller
                          : Boolean(decl[key]),
                    )}
                  />
                </div>
              ))}
              <p className="pt-2 text-[11px] italic text-muted-foreground">
                * derived from applicant answers
              </p>
              {decl.ownershipInterestLast3Years ? (
                <Row
                  label="Prior property / title held"
                  value={
                    [decl.priorPropertyType, decl.priorTitleHeld].filter(Boolean).join(" · ") || "—"
                  }
                />
              ) : null}
              {decl.borrowingOtherMoney ? (
                <Row label="Other borrowed amount" value={money(num(decl.borrowingOtherAmount))} />
              ) : null}
              {decl.bankruptcy && decl.bankruptcyChapters.length ? (
                <Row label="Bankruptcy chapters" value={decl.bankruptcyChapters.join(", ")} />
              ) : null}
            </Block>
          ) : (
            <p className="text-sm text-muted-foreground">No declarations on file.</p>
          )}

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
                  <Row
                    label="Reserve or National Guard only"
                    value={yesNo(mil.reserveOrNationalGuardOnly)}
                  />
                  <Row label="Surviving spouse" value={yesNo(mil.survivingSpouse)} />
                </>
              ) : null}
            </Block>
          ) : null}
        </div>
      ) : null}

      {tab === "demographics" ? (
        <Block title="Demographic information (HMDA)">
          {demo ? (
            <>
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
            </>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              No demographic information on file.
            </p>
          )}
        </Block>
      ) : null}

      {tab === "documents" ? (
        <div className="space-y-4">
          <Block title="Documents on file">
            {documents.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="space-y-1 py-2">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <span className="text-brand">📎 {d.label}</span>
                    <span className="text-xs text-muted-foreground">{date(d.when)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          <section>
            <h3 className="text-sm font-semibold text-foreground">
              Information requests (case communication)
            </h3>
            {lead.infoRequests.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No information requests sent.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {lead.infoRequests.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-md border border-border bg-background p-3 text-sm"
                  >
                    <div className="font-semibold text-foreground">Lender asked</div>
                    <p className="text-muted-foreground">{r.question}</p>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {date(r.requestedAt)}
                    </div>
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
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {date(r.answeredAt)}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs font-semibold text-gold">
                        Awaiting client response
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
