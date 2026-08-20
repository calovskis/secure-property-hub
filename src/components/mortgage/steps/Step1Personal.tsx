import { CountryCombobox } from "@/components/form/CountryCombobox";
import { StateCombobox } from "@/components/form/StateCombobox";
import { AddressFields } from "@/components/form/AddressFields";
import { DateInput, MonthInput } from "@/components/form/DateInput";
import {
  Field,
  HistoryWarning,
  InlineAddButton,
  Section,
  YesNo,
  inputClass,
} from "@/components/mortgage/form-ui";
import { hasTwoYearCoverage } from "@/components/mortgage/history-coverage";
import { emptyAddress, type StepProps } from "@/components/mortgage/questionnaire-state";
import {
  MARITAL_LABEL,
  UNMARRIED_RELATIONSHIP_LABEL,
  US_STATUS_LABEL,
  VISA_STATUS_OPTIONS,
  uid,
  type MaritalStatus,
  type UnmarriedRelationship,
  type UsStatus,
} from "@/lib/mortgage-form";
import type { AddressEntry } from "@/lib/auth";

export function Step1Personal({ data, patch, usPerson }: StepProps) {
  const patchAddress = (id: string, p: Partial<AddressEntry>) =>
    patch({ addresses: data.addresses.map((a) => (a.id === id ? { ...a, ...p } : a)) });

  const dependentCount = data.dependents.length;
  const setDependentCount = (n: number) => {
    const count = Math.max(0, Math.min(12, n));
    const next = [...data.dependents];
    while (next.length < count) next.push({ id: uid(), age: "" });
    patch({ dependents: next.slice(0, count) });
  };

  const addressCoverage = hasTwoYearCoverage(
    data.addresses.map((a) => ({ from: a.from, to: a.to, current: Boolean(a.present) })),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date of birth" required hint="mm/dd/yyyy">
          <DateInput value={data.dob} onChange={(v) => patch({ dob: v })} className={inputClass} />
        </Field>

        <Field label="Marital status" required>
          <select
            value={data.maritalStatus}
            onChange={(e) => patch({ maritalStatus: e.target.value as MaritalStatus | "" })}
            className={inputClass}
          >
            <option value="">Select…</option>
            {(Object.keys(MARITAL_LABEL) as MaritalStatus[]).map((k) => (
              <option key={k} value={k}>
                {MARITAL_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {data.maritalStatus === "unmarried" ? (
        <Section
          title="Unmarried addendum"
          subtitle="Required when the applicant is unmarried."
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <p className="max-w-2xl text-sm text-foreground">
                Is there a person who is not your legal spouse but who currently has real property
                rights similar to those of a legal spouse?
              </p>
              <div className="shrink-0">
                <YesNo
                  name="spousalEquivalent"
                  value={data.unmarried.hasSpousalEquivalent}
                  onChange={(v) =>
                    patch({
                      unmarried: v
                        ? { ...data.unmarried, hasSpousalEquivalent: true }
                        : { hasSpousalEquivalent: false },
                    })
                  }
                />
              </div>
            </div>

            {data.unmarried.hasSpousalEquivalent ? (
              <div className="grid grid-cols-1 gap-4 rounded-md bg-brand-tint/40 p-4 sm:grid-cols-2">
                <Field label="Type of relationship" required>
                  <select
                    value={data.unmarried.relationship ?? ""}
                    onChange={(e) => {
                      const { relationship: _drop, ...rest } = data.unmarried;
                      const v = e.target.value as UnmarriedRelationship | "";
                      patch({
                        unmarried: v ? { ...rest, relationship: v } : rest,
                      });
                    }}

                    className={inputClass}
                  >
                    <option value="">Select…</option>
                    {(
                      Object.keys(UNMARRIED_RELATIONSHIP_LABEL) as UnmarriedRelationship[]
                    ).map((k) => (
                      <option key={k} value={k}>
                        {UNMARRIED_RELATIONSHIP_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="State the relationship was formed in" required>
                  <StateCombobox
                    value={data.unmarried.stateFormed ?? ""}
                    placeholder="Start typing a state…"
                    onChange={(code) =>
                      patch({ unmarried: { ...data.unmarried, stateFormed: code } })
                    }
                  />
                </Field>

                {data.unmarried.relationship === "other" ? (
                  <Field label="Describe the relationship" required>
                    <input
                      value={data.unmarried.otherRelationship ?? ""}
                      onChange={(e) =>
                        patch({
                          unmarried: { ...data.unmarried, otherRelationship: e.target.value },
                        })
                      }
                      className={inputClass}
                    />
                  </Field>
                ) : null}
              </div>
            ) : null}
          </div>
        </Section>
      ) : null}

      <Section title="Dependents" subtitle="Number of dependents and the age of each.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Number of dependents" required>
            <input
              inputMode="numeric"
              value={String(dependentCount)}
              onChange={(e) => setDependentCount(Number(e.target.value.replace(/\D/g, "")) || 0)}
              className={inputClass}
            />
          </Field>
        </div>
        {dependentCount > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.dependents.map((d, i) => (
              <label key={d.id} className="block text-[11px] text-muted-foreground">
                Dependent {i + 1} — age
                <input
                  inputMode="numeric"
                  value={d.age}
                  onChange={(e) =>
                    patch({
                      dependents: data.dependents.map((x) =>
                        x.id === d.id ? { ...x, age: e.target.value.replace(/\D/g, "") } : x,
                      ),
                    })
                  }
                  className={inputClass}
                />
              </label>
            ))}
          </div>
        ) : null}
      </Section>

      {!usPerson ? (
        <Section title="Non-US resident details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Do you have an ITIN?" required>
              <YesNo
                name="hasItin"
                value={data.hasItin}
                onChange={(v) => patch({ hasItin: v, ...(v ? {} : { itin: "" }) })}
              />
            </Field>
            {data.hasItin ? (
              <Field label="ITIN number" required>
                <input
                  inputMode="numeric"
                  placeholder="9XX-XX-XXXX"
                  value={data.itin}
                  onChange={(e) => patch({ itin: e.target.value })}
                  className={inputClass}
                />
              </Field>
            ) : null}
            <Field label="Country of residence" required>
              <CountryCombobox
                value={data.countryOfResidence}
                onChange={(v) => patch({ countryOfResidence: v })}
                placeholder="Start typing a country…"
              />
            </Field>
            <Field label="Citizenship" required>
              <CountryCombobox
                value={data.citizenship}
                onChange={(v) => patch({ citizenship: v })}
                placeholder="Start typing a citizenship country…"
              />
            </Field>
            <Field label="Double citizenship">
              <CountryCombobox
                value={data.secondCitizenship}
                onChange={(v) => patch({ secondCitizenship: v })}
                placeholder="None"
                allowClear
              />
            </Field>
            <Field label="Do you hold an active US visa or status?" required>
              <YesNo
                name="visaActive"
                value={data.visaActive}
                onChange={(v) =>
                  patch({
                    visaActive: v,
                    ...(v ? {} : { visaType: "", visaIssued: "", visaValidUntil: "" }),
                  })
                }
              />
            </Field>
            {data.visaActive ? (
              <>
                <Field label="Which visa / status?" required>
                  <select
                    value={data.visaType}
                    onChange={(e) => patch({ visaType: e.target.value as UsStatus | "" })}
                    className={inputClass}
                  >
                    <option value="">Select…</option>
                    {VISA_STATUS_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {US_STATUS_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Visa issued on" required>
                  <DateInput
                    value={data.visaIssued}
                    onChange={(v) => patch({ visaIssued: v })}
                    className={inputClass}
                  />
                </Field>
                <Field label="Visa valid until" required>
                  <DateInput
                    value={data.visaValidUntil}
                    onChange={(v) => patch({ visaValidUntil: v })}
                    className={inputClass}
                  />
                </Field>
              </>
            ) : null}
            <Field label="How will you use the property?" required>
              <select
                value={data.propertyUse}
                onChange={(e) =>
                  patch({ propertyUse: e.target.value as "vacation" | "investment" | "" })
                }
                className={inputClass}
              >
                <option value="">Select…</option>
                <option value="vacation">Vacation home</option>
                <option value="investment">Investment property</option>
              </select>
            </Field>
            <Field label="Do you have a US bank account?" required>
              <YesNo
                name="usBank"
                value={data.usBankAccount}
                onChange={(v) => patch({ usBankAccount: v })}
              />
            </Field>
          </div>
        </Section>
      ) : null}

      <Section
        title="2 years of address history"
        subtitle="Tick “This is my present address” instead of entering an end date."
      >
        <div className="space-y-4">
          {data.addresses.map((a, i) => (
            <div key={a.id} className="rounded-lg border border-border p-4">
              <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>{a.present ? "Present address" : i === 0 ? "Address" : `Address ${i + 1}`}</span>
                {data.addresses.length > 1 ? (
                  <button
                    type="button"
                    onClick={() =>
                      patch({ addresses: data.addresses.filter((x) => x.id !== a.id) })
                    }
                    className="text-destructive hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <AddressFields
                    value={{
                      country: a.country ?? "US",
                      state: a.state,
                      city: a.city,
                      street: a.street,
                      zip: a.zip,
                    }}
                    onChange={(p) => patchAddress(a.id, p)}
                  />
                </div>
                <label className="text-[11px] text-muted-foreground">
                  From
                  <MonthInput
                    value={a.from}
                    onChange={(v) => patchAddress(a.id, { from: v })}
                    className={inputClass}
                  />
                </label>
                <label className="text-[11px] text-muted-foreground">
                  To
                  <MonthInput
                    value={a.to}
                    disabled={Boolean(a.present)}
                    onChange={(v) => patchAddress(a.id, { to: v })}
                    className={`${inputClass} disabled:opacity-50`}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(a.present)}
                    onChange={(e) =>
                      patch({
                        addresses: data.addresses.map((x) =>
                          x.id === a.id
                            ? { ...x, present: e.target.checked, to: e.target.checked ? "" : x.to }
                            : { ...x, present: e.target.checked ? false : Boolean(x.present) },
                        ),
                      })
                    }
                  />
                  This is my present address
                </label>
              </div>
            </div>
          ))}
        </div>
        <InlineAddButton
          label="+ Add another address"
          onClick={() => patch({ addresses: [...data.addresses, emptyAddress()] })}
        />
        {!addressCoverage ? (
          <div className="mt-3">
            <HistoryWarning message="Less than 2 years of address history provided — please add earlier addresses covering at least the last 2 years." />
          </div>
        ) : null}
      </Section>
    </div>
  );
}
