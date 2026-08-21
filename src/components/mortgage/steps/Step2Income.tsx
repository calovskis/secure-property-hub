import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { AddressFields } from "@/components/form/AddressFields";
import { useFxRates, usdPerUnit } from "@/lib/fx";
import { currencyForCountry } from "@/components/mortgage/country-currency";
import { hasTwoYearCoverage } from "@/components/mortgage/history-coverage";

import { MonthInput } from "@/components/form/DateInput";
import {
  Field,
  HistoryWarning,
  InlineAddButton,
  Section,
  inputClass,
  money,
} from "@/components/mortgage/form-ui";
import type { StepProps } from "@/components/mortgage/questionnaire-state";
import {
  INCOME_TYPE_LABEL,
  RELATED_PARTY_LABEL,
  emptyIncome,
  isForeignIncome,
  monthlyForIncome,
  num,
  totalMonthlyIncome,
  type IncomeSource,
  type IncomeType,
  type PayType,
  type RelatedParty,
} from "@/lib/mortgage-form";

export function Step2Income({ data, patch, usPerson }: StepProps) {
  const patchIncome = (id: string, p: Partial<IncomeSource>) =>
    patch({ incomes: data.incomes.map((s) => (s.id === id ? { ...s, ...p } : s)) });

  const total = totalMonthlyIncome(data.incomes);
  const { fx, loading: fxLoading } = useFxRates();

  useEffect(() => {
    const next = data.incomes.map((source) => {
      if (!isForeignIncome(source) || !source.currency) return source;
      const rate = usdPerUnit(fx, source.currency);
      return rate && source.fxRate !== rate.toFixed(6)
        ? { ...source, fxRate: rate.toFixed(6) }
        : source;
    });
    if (next.some((source, index) => source !== data.incomes[index])) patch({ incomes: next });
  }, [fx, data.incomes, patch]);

  // Annual income — last year is only asked of US persons, green card holders and ITIN holders.
  const canAskLastYearIncome = usPerson || data.hasItin;

  const coverage = hasTwoYearCoverage(
    data.incomes.map((s) => ({ from: s.from, to: s.to, current: s.current })),
  );

  return (
    <div className="space-y-6">
      {usPerson ? (
        <Section title="Identification">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Social Security Number">
              <input
                inputMode="numeric"
                placeholder="123-45-6789"
                value={data.ssn}
                onChange={(e) => patch({ ssn: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <label className="mt-3 flex items-start gap-2 rounded-md bg-brand-tint/60 p-3 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={data.ssnAccepted}
              onChange={(e) => patch({ ssnAccepted: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              By providing my Social Security Number I confirm that I have read and accept the{" "}
              <Link to="/ssn-terms" className="font-semibold text-brand underline">
                SSN processing terms
              </Link>
              .
            </span>
          </label>
        </Section>
      ) : null}

      <Section
        title="Income sources — 2 year history"
        subtitle="Pick the income type first; we then ask only what that type needs."
      >
        <div className="space-y-4">
          {data.incomes.map((s, i) => {
            const monthlyNativeSalary = num(s.annualSalary) / 12;
            const monthly = monthlyForIncome(s);
            const foreign = isForeignIncome(s);
            const usdRate = s.currency ? usdPerUnit(fx, s.currency) : null;
            return (
              <div key={s.id} className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Income source {i + 1}</span>
                  {data.incomes.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => patch({ incomes: data.incomes.filter((x) => x.id !== s.id) })}
                      className="text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Income type" required>
                    <select
                      value={s.type}
                      onChange={(e) => patchIncome(s.id, { type: e.target.value as IncomeType })}
                      className={inputClass}
                    >
                      {(Object.keys(INCOME_TYPE_LABEL) as IncomeType[]).map((k) => (
                        <option key={k} value={k}>
                          {INCOME_TYPE_LABEL[k]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label={s.type === "self_employed" ? "Business name" : "Employer name"}
                    required
                  >
                    <input
                      value={s.employer}
                      onChange={(e) => patchIncome(s.id, { employer: e.target.value })}
                      className={inputClass}
                    />
                  </Field>

                  <Field label={s.type === "self_employed" ? "Your role" : "Job title"} required>
                    <input
                      value={s.title}
                      onChange={(e) => patchIncome(s.id, { title: e.target.value })}
                      className={inputClass}
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-[11px] text-muted-foreground">
                      From
                      <MonthInput
                        value={s.from}
                        onChange={(v) => patchIncome(s.id, { from: v })}
                        className={inputClass}
                      />
                    </label>
                    <label className="text-[11px] text-muted-foreground">
                      To
                      <MonthInput
                        value={s.to}
                        disabled={s.current}
                        onChange={(v) => patchIncome(s.id, { to: v })}
                        className={`${inputClass} disabled:opacity-50`}
                      />
                    </label>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={s.current}
                      onChange={(e) =>
                        patchIncome(s.id, {
                          current: e.target.checked,
                          ...(e.target.checked ? { to: "" } : {}),
                        })
                      }
                    />
                    This is current / ongoing
                  </label>
                </div>

                {/* Employer / business address */}
                <div className="mt-4 rounded-md border border-border/70 bg-brand-tint/20 p-3">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {s.type === "self_employed" ? "Business address" : "Employer address"}
                  </div>
                  <AddressFields
                    value={{
                      country: s.address.country || "US",
                      state: s.address.state,
                      city: s.address.city,
                      street: s.address.street,
                      zip: s.address.zip,
                    }}
                    onChange={(p) =>
                      patchIncome(s.id, {
                        address: {
                          ...s.address,
                          ...p,
                          ...(p.country !== undefined ? { country: p.country } : {}),
                        },
                        ...(p.country !== undefined && p.country !== "US"
                          ? { currency: currencyForCountry(p.country), fxRate: "" }
                          : {}),
                        ...(p.country === "US" ? { currency: "", fxRate: "" } : {}),
                      })
                    }
                  />
                  {foreign ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 rounded-md bg-card p-3 sm:grid-cols-2">
                      <Field
                        label="Currency"
                        required
                        hint="Automatically set from the employer address country."
                      >
                        <div className={`${inputClass} bg-muted/40`}>{s.currency || "—"}</div>
                      </Field>
                      <Field
                        label="Exchange rate to USD"
                        hint={
                          s.currency
                            ? `Today's rate: 1 ${s.currency} = ${(usdRate ?? 0).toFixed(4)} USD`
                            : "1 unit = ? USD"
                        }
                      >
                        <div className={`${inputClass} bg-muted/40`}>
                          {s.fxRate || (fxLoading ? "Updating…" : "Unavailable")}
                        </div>
                      </Field>
                      <p className="text-xs text-muted-foreground sm:col-span-2">
                        Amounts below are entered in {s.currency || "the local currency"}. Rates
                        update daily {fxLoading ? "(refreshing…)" : `(last update: ${fx.updatedAt})`}.
                        Converted
                        monthly income: <strong className="text-brand">{money(monthly)}</strong> USD.
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* Type-specific questions */}
                {s.type === "w2" ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Pay type" required>
                      <select
                        value={s.payType}
                        onChange={(e) => patchIncome(s.id, { payType: e.target.value as PayType })}
                        className={inputClass}
                      >
                        <option value="salary">Salary</option>
                        <option value="hourly">Hourly</option>
                      </select>
                    </Field>
                    {s.payType === "salary" ? (
                      <Field
                        label={`Annual gross salary${foreign ? ` (${s.currency || "local currency"})` : ""}`}
                        required
                        hint={`Derived monthly: ${money(monthlyNativeSalary)}${foreign ? ` ${s.currency}` : ""}`}
                      >
                        <input
                          inputMode="decimal"
                          placeholder="102,000"
                          value={s.annualSalary}
                          onChange={(e) => patchIncome(s.id, { annualSalary: e.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    ) : (
                      <>
                        <Field label="Hourly rate" required>
                          <input
                            inputMode="decimal"
                            placeholder="42"
                            value={s.hourlyRate}
                            onChange={(e) => patchIncome(s.id, { hourlyRate: e.target.value })}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Estimated monthly hours" required>
                          <input
                            inputMode="decimal"
                            placeholder="160"
                            value={s.monthlyHours}
                            onChange={(e) => patchIncome(s.id, { monthlyHours: e.target.value })}
                            className={inputClass}
                          />
                        </Field>
                      </>
                    )}
                    <Field
                      label="Are you employed by a party to the transaction?"
                      required
                      hint="Family member, property seller, real estate agent or other party."
                    >
                      <select
                        value={s.relatedParty}
                        onChange={(e) =>
                          patchIncome(s.id, { relatedParty: e.target.value as RelatedParty })
                        }
                        className={inputClass}
                      >
                        {(Object.keys(RELATED_PARTY_LABEL) as RelatedParty[]).map((k) => (
                          <option key={k} value={k}>
                            {RELATED_PARTY_LABEL[k]}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {s.relatedParty !== "none" ? (
                      <Field label="Describe the relationship" required>
                        <input
                          value={s.relatedPartyDetail}
                          onChange={(e) =>
                            patchIncome(s.id, { relatedPartyDetail: e.target.value })
                          }
                          className={inputClass}
                        />
                      </Field>
                    ) : null}
                  </div>
                ) : null}

                {s.type === "self_employed" ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Ownership share (%)" required>
                      <input
                        inputMode="decimal"
                        placeholder="100"
                        value={s.ownershipPct}
                        onChange={(e) => patchIncome(s.id, { ownershipPct: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Business type" required hint="LLC, S-Corp, sole proprietor…">
                      <input
                        value={s.businessType}
                        onChange={(e) => patchIncome(s.id, { businessType: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    {canAskLastYearIncome ? (
                      <Field
                        label="Annual income — last year"
                        hint="Optional — for US persons, green card holders and ITIN holders."
                      >
                        <input
                          inputMode="decimal"
                          placeholder="140,000"
                          value={s.annualIncomeLastYear}
                          onChange={(e) => patchIncome(s.id, { annualIncomeLastYear: e.target.value })}
                          className={inputClass}
                        />
                      </Field>
                    ) : null}
                    <Field label="Estimated annual income" required>
                      <input
                        inputMode="decimal"
                        placeholder="150,000"
                        value={s.estimatedAnnualIncome}
                        onChange={(e) => patchIncome(s.id, { estimatedAnnualIncome: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                ) : null}

                {s.type === "seasonal" ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Gross income per working month" required>
                      <input
                        inputMode="decimal"
                        placeholder="12,000"
                        value={s.seasonMonthlyGross}
                        onChange={(e) => patchIncome(s.id, { seasonMonthlyGross: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Working months per year" required>
                      <input
                        inputMode="decimal"
                        placeholder="7"
                        value={s.monthsPerYear}
                        onChange={(e) => patchIncome(s.id, { monthsPerYear: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-card p-3 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Average monthly (USD)
                    </div>
                    <strong className="text-brand">{money(monthly)}</strong>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Estimated annual (USD)
                    </div>
                    <strong className="text-brand">{money(monthly * 12)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <InlineAddButton
          label="+ Add another income source"
          onClick={() => patch({ incomes: [...data.incomes, emptyIncome("w2")] })}
        />

        {!coverage ? (
          <div className="mt-3">
            <HistoryWarning message="Less than 2 years of employment/income history provided — please add earlier income sources covering at least the last 2 years." />
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between rounded-md bg-brand-tint/60 p-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Total qualifying income
          </span>
          <strong className="text-lg font-bold text-brand">
            {money(total)} / mo · {money(total * 12)} / yr
          </strong>
        </div>
      </Section>
    </div>
  );
}
