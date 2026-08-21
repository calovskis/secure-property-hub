import { CountryCombobox } from "@/components/form/CountryCombobox";
import { CurrencyCombobox } from "@/components/form/CurrencyCombobox";
import { Field, InlineAddButton, Section, inputClass, money } from "@/components/mortgage/form-ui";
import type { StepProps } from "@/components/mortgage/questionnaire-state";
import {
  ASSET_TYPE_LABEL,
  emptyFinancialAsset,
  emptyPropertyAsset,
  totalAssets,
  totalLiabilities,
  uid,
  type AssetType,
  type Assets,
  type Liabilities,
} from "@/lib/mortgage-form";

const LIABILITY_ROWS: { key: keyof Liabilities; label: string }[] = [
  { key: "propertyLoans", label: "Property loans / rent" },
  { key: "vehicleLoans", label: "Vehicle loans & leases" },
  { key: "creditCards", label: "Credit cards (minimum payments)" },
  { key: "studentLoans", label: "Student loans" },
];

export function Step3Liabilities({ data, patch, usPerson }: StepProps) {
  const l = data.liabilities;
  const patchL = (p: Partial<Liabilities>) => patch({ liabilities: { ...l, ...p } });
  const assets = data.assets;
  const patchAssets = (p: Partial<Assets>) => patch({ assets: { ...assets, ...p } });
  const showLiabilities = usPerson || data.hasItin;

  return (
    <div className="space-y-6">
      <Section
        title="Assets"
        subtitle="Bank accounts, liquid funds, investments and other property available to you."
      >
        <div className="space-y-3">
          {assets.financial.map((asset) => (
            <div
              key={asset.id}
              className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2"
            >
              <Field label="Asset / account type" required>
                <select
                  value={asset.type}
                  onChange={(e) =>
                    patchAssets({
                      financial: assets.financial.map((x) =>
                        x.id === asset.id ? { ...x, type: e.target.value as AssetType } : x,
                      ),
                    })
                  }
                  className={inputClass}
                >
                  {(Object.keys(ASSET_TYPE_LABEL) as AssetType[]).map((type) => (
                    <option key={type} value={type}>
                      {ASSET_TYPE_LABEL[type]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Bank / financial institution">
                <input
                  value={asset.institution}
                  onChange={(e) =>
                    patchAssets({
                      financial: assets.financial.map((x) =>
                        x.id === asset.id ? { ...x, institution: e.target.value } : x,
                      ),
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Account country" required>
                <CountryCombobox
                  value={asset.country}
                  onChange={(country) =>
                    patchAssets({
                      financial: assets.financial.map((x) =>
                        x.id === asset.id ? { ...x, country } : x,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Currency" required>
                <CurrencyCombobox
                  value={asset.currency}
                  onChange={(currency) =>
                    patchAssets({
                      financial: assets.financial.map((x) =>
                        x.id === asset.id ? { ...x, currency } : x,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Current balance / value" required>
                <input
                  inputMode="decimal"
                  value={asset.value}
                  onChange={(e) =>
                    patchAssets({
                      financial: assets.financial.map((x) =>
                        x.id === asset.id ? { ...x, value: e.target.value } : x,
                      ),
                    })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Description">
                <input
                  value={asset.description}
                  onChange={(e) =>
                    patchAssets({
                      financial: assets.financial.map((x) =>
                        x.id === asset.id ? { ...x, description: e.target.value } : x,
                      ),
                    })
                  }
                  className={inputClass}
                />
              </Field>
              {assets.financial.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    patchAssets({ financial: assets.financial.filter((x) => x.id !== asset.id) })
                  }
                  className="text-left text-xs font-semibold text-destructive"
                >
                  Remove asset
                </button>
              ) : null}
            </div>
          ))}
        </div>
        <InlineAddButton
          label="+ Add another financial asset"
          onClick={() => patchAssets({ financial: [...assets.financial, emptyFinancialAsset()] })}
        />

        <div className="mt-5 text-xs font-semibold uppercase text-muted-foreground">
          Other real estate owned
        </div>
        {assets.properties.map((property) => (
          <div
            key={property.id}
            className="mt-3 grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2"
          >
            <Field label="Property address" required>
              <input
                value={property.address}
                onChange={(e) =>
                  patchAssets({
                    properties: assets.properties.map((x) =>
                      x.id === property.id ? { ...x, address: e.target.value } : x,
                    ),
                  })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Country" required>
              <CountryCombobox
                value={property.country}
                onChange={(country) =>
                  patchAssets({
                    properties: assets.properties.map((x) =>
                      x.id === property.id ? { ...x, country } : x,
                    ),
                  })
                }
              />
            </Field>
            <Field label="Estimated value" required>
              <input
                inputMode="decimal"
                value={property.estimatedValue}
                onChange={(e) =>
                  patchAssets({
                    properties: assets.properties.map((x) =>
                      x.id === property.id ? { ...x, estimatedValue: e.target.value } : x,
                    ),
                  })
                }
                className={inputClass}
              />
            </Field>
            <Field label="Currency" required>
              <CurrencyCombobox
                value={property.currency}
                onChange={(currency) =>
                  patchAssets({
                    properties: assets.properties.map((x) =>
                      x.id === property.id ? { ...x, currency } : x,
                    ),
                  })
                }
              />
            </Field>
            <button
              type="button"
              onClick={() =>
                patchAssets({ properties: assets.properties.filter((x) => x.id !== property.id) })
              }
              className="text-left text-xs font-semibold text-destructive"
            >
              Remove property
            </button>
          </div>
        ))}
        <InlineAddButton
          label="+ Add another property"
          onClick={() => patchAssets({ properties: [...assets.properties, emptyPropertyAsset()] })}
        />
        <div className="mt-4 flex items-center justify-between rounded-md bg-brand-tint/60 p-3">
          <span className="text-xs uppercase text-muted-foreground">Total declared assets</span>
          <strong className="text-lg text-brand">{money(totalAssets(assets))}</strong>
        </div>
      </Section>

      {showLiabilities ? (
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
      ) : (
        <p className="rounded-md bg-brand-tint/60 p-3 text-xs text-muted-foreground">
          Liability questions are not required for applicants without US citizenship, a green card,
          or an ITIN.
        </p>
      )}
    </div>
  );
}
