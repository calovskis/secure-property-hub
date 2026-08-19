import { Typeahead } from "@/components/form/Typeahead";
import { CURRENCY_OPTIONS, currencyLabel } from "@/data/currencies";

/**
 * Type-ahead currency picker limited to the supported currency list, so income
 * is always stored with a valid ISO 4217 code we can convert automatically.
 */
export function CurrencyCombobox({
  value,
  onChange,
  placeholder = "Start typing a currency…",
  disabled,
}: {
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <Typeahead
      value={value}
      displayValue={value ? currencyLabel(value) : ""}
      options={CURRENCY_OPTIONS}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      emptyHint="No matching currency. We support the currencies listed here."
    />
  );
}
