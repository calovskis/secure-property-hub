import { CountryCombobox } from "@/components/form/CountryCombobox";
import { CurrencyCombobox } from "@/components/form/CurrencyCombobox";
import { Field, InlineAddButton, Section, inputClass, money } from "@/components/mortgage/form-ui";
import type { StepProps } from "@/components/mortgage/questionnaire-state";
import {
  ASSET_TYPE_LABEL,
  BANK_ACCOUNT_KIND_LABEL,
  emptyAsset,
  normalizeAssets,
  totalAssets,
  totalLiabilities,
  uid,
  type AssetEntry,
  type AssetType,
  type Liabilities,
} from "@/lib/mortgage-form";

const LIABILITY_ROWS: { key: keyof Liabilities; label: string }[] = [
  { key: "propertyLoans", label: "Property loans / rent" },
  { key: "vehicleLoans", label: "Vehicle loans & leases" },
  { key: "creditCards", label: "Credit cards (minimum payments)" },
  { key: "studentLoans", label: "Student loans" },
];

function AssetCard({
  asset,
  canRemove,
  onPatch,
  onRemove,
}: {
  asset: AssetEntry;
  canRemove: boolean;
  onPatch: (p: Partial<AssetEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
      <Field label="Asset type" required>
        <select
          value={asset.type}
          onChange={(e) => {
            const type = e.target.value as AssetType;
            onPatch({ type, kind: type === "bank_account" ? asset.kind || "checking" : "" });
          }}
          className={inputClass}
        >
          {(Object.keys(ASSET_TYPE_LABEL) as AssetType[]).map((type) => (
            <option key={type} value={type}>
              {ASSET_TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </Field>

      {asset.type === "bank_account" ? (
        <Field label="Account type" required>
          <select
            value={asset.kind || "checking"}
            onChange={(e) => onPatch({ kind: e.target.value })}
            className={inputClass}
          >
            {Object.entries(BANK_ACCOUNT_KIND_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {asset.type === "bank_account" || asset.type === "investment_account" ? (
        <Field
          label={asset.type === "bank_account" ? "Bank / financial institution" : "Platform / institution"}
          required
        >
          <input
            value={asset.institution}
            onChange={(e) => onPatch({ institution: e.target.value })}
            className={inputClass}
          />
        </Field>
      ) : null}

      {asset.type === "real_estate" ? (
        <Field label="Property address" required>
          <input
            value={asset.address}
            onChange={(e) => onPatch({ address: e.target.value })}
            className={inputClass}
          />
        </Field>
      ) : null}

      {asset.type === "other" ? (
        <Field label="Description" required hint="What is the asset?">
          <input
            value={asset.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            className={inputClass}
          />
        </Field>
      ) : null}

      <Field label={asset.type === "real_estate" ? "Property country" : "Account country"} required>
        <CountryCombobox value={asset.country} onChange={(country) => onPatch({ country })} />
      </Field>

      <Field label="Currency" required>
        <CurrencyCombobox value={asset.currency} onChange={(currency) => onPatch({ currency })} />
      </Field>

      <Field
        label={
          asset.type === "real_estate"
            ? "Estimated value"
            : asset.type === "other"
              ? "Amount"
              : "Current balance / value"
        }
        required
      >
        <input
          inputMode="decimal"
          value={asset.value}
          onChange={(e) => onPatch({ value: e.target.value })}
          className={inputClass}
        />
      </Field>

      {asset.type === "real_estate" ? (
        <Field label="Existing lien amount" hint="Optional — mortgage or other lien on this property.">
          <input
            inputMode="decimal"
            value={asset.lien}
            onChange={(e) => onPatch({ lien: e.target.value })}
            className={inputClass}
          />
        </Field>
      ) : null}

      {asset.type !== "other" ? (
        <Field label="Notes">
          <input
            value={asset.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            className={inputClass}
          />
        </Field>
      ) : null}

      {canRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="text-left text-xs font-semibold text-destructive"
        >
          Remove asset
        </button>
      ) : null}
    </div>
  );
}

export function Step3Liabilities({ data, patch, usPerson }: StepProps) {
  const l = data.liabilities;
  const patchL = (p: Partial<Liabilities>) => patch({ liabilities: { ...l, ...p } });
  const assets = normalizeAssets(data.assets);
  const patchEntries = (entries: AssetEntry[]) => patch({ assets: { entries } });
  const showLiabilities = usPerson || data.hasItin;

  return (
    <div className="space-y-6">
      <Section
        title="Assets"
        subtitle="Bank accounts, investments, real estate and other assets available to you — in any country."
      >
        <div className="space-y-3">
          {assets.entries.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              canRemove={assets.entries.length > 1}
              onPatch={(p) =>
                patchEntries(
                  assets.entries.map((x) => (x.id === asset.id ? { ...x, ...p } : x)),
                )
              }
              onRemove={() => patchEntries(assets.entries.filter((x) => x.id !== asset.id))}
            />
          ))}
        </div>
        <InlineAddButton
          label="+ Add another asset"
          onClick={() => patchEntries([...assets.entries, emptyAsset()])}
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
