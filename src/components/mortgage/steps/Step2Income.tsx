import { Link } from "@tanstack/react-router";
import { CountryCombobox } from "@/components/form/CountryCombobox";
import { AddressFields } from "@/components/form/AddressFields";
import { MonthInput } from "@/components/form/DateInput";
import { Field, Section, inputClass, money } from "@/components/mortgage/form-ui";
import type { StepProps } from "@/components/mortgage/questionnaire-state";
import {
  INCOME_TYPE_LABEL,
  RELATED_PARTY_LABEL,
  emptyIncome,
  monthlyForIncome,
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
        action={
          <button
            type="button"
            onClick={() => patch({ incomes: [...data.incomes, emptyIncome("w2")] })}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint"
          >
            + Add income source
          </button>
        }
      >
        <div className="space-y-4">
          {data.incomes.map((s, i) => {
            const monthly = monthlyForIncome(s);
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
                    label={
                      s.type === "self_employed"
                        ? "Business name"
                        : s.type === "foreign"
                          ? "Employer / payer name"
                          : "Employer name"
                    }
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
                      })
                    }
                  />
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
                      <Field label="Monthly gross salary" required>
                        <input
                          inputMode="decimal"
                          placeholder="8,500"
                          value={s.salaryMonthly}
                          onChange={(e) => patchIncome(s.id, { salaryMonthly: e.target.value })}
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
                    <Field label="Net income — last tax year" required>
                      <input
                        inputMode="decimal"
                        placeholder="140,000"
                        value={s.netIncomeYear1}
                        onChange={(e) => patchIncome(s.id, { netIncomeYear1: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Net income — prior tax year">
                      <input
                        inputMode="decimal"
                        placeholder="120,000"
                        value={s.netIncomeYear2}
                        onChange={(e) => patchIncome(s.id, { netIncomeYear2: e.target.value })}
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

                {s.type === "foreign" ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Currency" required hint="e.g. EUR, GBP, AED">
                      <input
                        value={s.currency}
                        onChange={(e) => patchIncome(s.id, { currency: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Monthly gross (in that currency)" required>
                      <input
                        inputMode="decimal"
                        value={s.monthlyGrossForeign}
                        onChange={(e) => patchIncome(s.id, { monthlyGrossForeign: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Exchange rate to USD" required hint="1 unit = ? USD">
                      <input
                        inputMode="decimal"
                        placeholder="1.08"
                        value={s.fxRate}
                        onChange={(e) => patchIncome(s.id, { fxRate: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-md bg-card p-3 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Average monthly
                    </div>
                    <strong className="text-brand">{money(monthly)}</strong>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Estimated annual
                    </div>
                    <strong className="text-brand">{money(monthly * 12)}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

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
