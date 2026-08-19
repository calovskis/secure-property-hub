import { useEffect, useMemo, useState } from "react";
import { CountryCombobox } from "@/components/form/CountryCombobox";
import { Typeahead } from "@/components/form/Typeahead";
import {
  citiesFor,
  hasSubdivisions,
  loadCities,
  regionTerm,
  subdivisionLabel,
  subdivisionsFor,
} from "@/lib/geo";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

export type AddressValue = {
  country?: string;
  state: string;
  city: string;
  street: string;
  zip: string;
};

/** Country → state/region → city, with a postal code. Works worldwide. */
export function AddressFields({
  value,
  onChange,
  streetPlaceholder = "Street address",
}: {
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
  streetPlaceholder?: string;
}) {
  const country = value.country || "US";
  const [cityMap, setCityMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    let alive = true;
    loadCities(country).then((m) => {
      if (alive) setCityMap(m);
    });
    return () => {
      alive = false;
    };
  }, [country]);

  const regionOptions = useMemo(
    () =>
      subdivisionsFor(country).map((s) => ({
        value: s.code,
        label: country === "US" ? `${s.code} — ${s.name}` : s.name,
      })),
    [country],
  );

  const cityOptions = useMemo(
    () => citiesFor(cityMap, value.state).map((c) => ({ value: c, label: c })),
    [cityMap, value.state],
  );

  const regionsKnown = hasSubdivisions(country);
  const term = regionTerm(country);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <CountryCombobox
          value={country}
          placeholder="Country"
          onChange={(code) => onChange({ country: code, state: "", city: "" })}
        />
      </div>

      {regionsKnown ? (
        <Typeahead
          value={value.state}
          displayValue={subdivisionLabel(country, value.state)}
          options={regionOptions}
          placeholder={term}
          onChange={(code) => onChange({ state: code, city: "" })}
          emptyHint={`No matching ${term.toLowerCase()}`}
        />
      ) : (
        <input
          placeholder={`${term} (optional)`}
          value={value.state}
          onChange={(e) => onChange({ state: e.target.value })}
          className={inputClass}
        />
      )}

      <Typeahead
        value={value.city}
        options={cityOptions}
        allowFreeText
        placeholder="City"
        onChange={(city) => onChange({ city })}
        emptyHint="No match — you can type your city as it is written locally."
      />

      <input
        placeholder={streetPlaceholder}
        value={value.street}
        onChange={(e) => onChange({ street: e.target.value })}
        className={`${inputClass} sm:col-span-2`}
      />

      <input
        placeholder={country === "US" ? "ZIP" : "Postal code"}
        value={value.zip}
        onChange={(e) => onChange({ zip: e.target.value })}
        className={inputClass}
      />
    </div>
  );
}
