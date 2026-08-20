import { Field, InlineAddButton, Section, inputClass, money } from "@/components/mortgage/form-ui";
import type { StepProps } from "@/components/mortgage/questionnaire-state";
import { totalLiabilities, uid, type Liabilities } from "@/lib/mortgage-form";

const LIABILITY_ROWS: { key: keyof Liabilities; label: string }[] = [
  { key: "propertyLoans", label: "Property loans / rent" },
  { key: "vehicleLoans", label: "Vehicle loans & leases" },
  { key: "creditCards", label: "Credit cards (minimum payments)" },
  { key: "studentLoans", label: "Student loans" },
];

export function Step3Liabilities({ data, patch }: StepProps) {
  const l = data.liabilities;
  const patchL = (p: Partial<Liabilities>) => patch({ liabilities: { ...l, ...p } });

  return (
    <div className="space-y-6">
      <Section
        title="Monthly existing liabilities"
        subtitle="Current monthly payments — used for your debt-to-income ratio."
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {LIABILITY_ROWS.map((row) => (
            <Field key={row.key} label={row.label}>
              <input
                inputMode="decimal"
                placeholder="0"
                value={l[row.key] as string}
                onChange={(e) => patchL({ [row.key]: e.target.value } as Partial<Liabilities>)}
                className={inputClass}
              />
            </Field>
          ))}
        </div>

        {l.other.length ? (
          <div className="mt-3 space-y-2">
            {l.other.map((o) => (
              <div key={o.id} className="flex gap-2">
                <input
                  placeholder="Obligation"
                  value={o.label}
                  onChange={(e) =>
                    patchL({
                      other: l.other.map((x) =>
                        x.id === o.id ? { ...x, label: e.target.value } : x,
                      ),
                    })
                  }
                  className={inputClass}
                />
                <input
                  inputMode="decimal"
                  placeholder="Monthly"
                  value={o.amount}
                  onChange={(e) =>
                    patchL({
                      other: l.other.map((x) =>
                        x.id === o.id ? { ...x, amount: e.target.value } : x,
                      ),
                    })
                  }
                  className={`${inputClass} max-w-[150px]`}
                />
                <button
                  type="button"
                  onClick={() => patchL({ other: l.other.filter((x) => x.id !== o.id) })}
                  className="shrink-0 rounded-md border border-border px-3 text-xs font-semibold text-destructive hover:bg-destructive/10"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <InlineAddButton
          label="+ Add another"
          onClick={() => patchL({ other: [...l.other, { id: uid(), label: "", amount: "" }] })}
        />

        <div className="mt-4 flex items-center justify-between rounded-md bg-brand-tint/60 p-3">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Total monthly obligations
          </span>
          <strong className="text-lg font-bold text-brand">{money(totalLiabilities(l))}</strong>
        </div>
      </Section>
    </div>
  );
}
