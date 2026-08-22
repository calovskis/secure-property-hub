import { useEffect, useMemo, useRef, useState } from "react";
import { CountryCombobox } from "@/components/form/CountryCombobox";
import { Typeahead } from "@/components/form/Typeahead";
import {
  citiesFor,
  hasSubdivisions,
  loadCities,
  lookupZip,
  regionTerm,
  searchAddress,
  subdivisionLabel,
  subdivisionsFor,
  type AddressSuggestion,
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

const SEARCH_DEBOUNCE_MS = 350;

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

  const regionName = useMemo(
    () => subdivisionsFor(country).find((s) => s.code === value.state)?.name,
    [country, value.state],
  );

  const cityList = useMemo(
    () => citiesFor(cityMap, value.state, regionName),
    [cityMap, value.state, regionName],
  );
  const cityOptions = useMemo(() => cityList.map((c) => ({ value: c, label: c })), [cityList]);

  const regionsKnown = hasSubdivisions(country);
  const term = regionTerm(country);

  const cityEmptyHint =
    value.state && cityList.length === 0
      ? "No listed cities for this region yet — type your city as it is written locally."
      : "No match — you can type your city as it is written locally.";

  /* --------------------------- address autocomplete --------------------------- */
  const [addressQuery, setAddressQuery] = useState(value.street);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAddressQuery(value.street);
  }, [value.street]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setShowSuggestions(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function handleStreetChange(text: string) {
    setAddressQuery(text);
    onChange({ street: text });
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    const query = text.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      searchAddress(query, country, controller.signal).then((results) => {
        if (!controller.signal.aborted) setSuggestions(results);
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  function resolveStateCode(stateName: string): string {
    if (!stateName) return "";
    const bare = stateName.trim().toLowerCase();
    const hit = subdivisionsFor(country).find(
      (sub) => sub.name.toLowerCase() === bare || sub.name.toLowerCase().startsWith(bare),
    );
    return hit ? hit.code : stateName;
  }

  function pickSuggestion(s: AddressSuggestion) {
    setAddressQuery(s.street || s.label);
    setSuggestions([]);
    setShowSuggestions(false);
    onChange({
      street: s.street || s.label,
      ...(s.city ? { city: s.city } : {}),
      ...(s.state ? { state: resolveStateCode(s.state) } : {}),
      ...(s.zip ? { zip: s.zip } : {}),
    });

    // The geocoder often omits the postcode on the first hit — run a
    // follow-up lookup (reverse-geocoding the picked coordinates first) and
    // patch the ZIP once it resolves.
    if (!s.zip) {
      lookupZip({
        street: s.street || s.label,
        city: s.city,
        state: s.state,
        country,
        ...(s.lat ? { lat: s.lat } : {}),
        ...(s.lon ? { lon: s.lon } : {}),
      }).then((zip) => {
        if (zip) onChange({ zip });
      });
    }
  }

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
        emptyHint={cityEmptyHint}
      />

      <div ref={wrapRef} className="relative sm:col-span-2">
        <input
          placeholder={streetPlaceholder}
          value={addressQuery}
          autoComplete="off"
          onFocus={() => setShowSuggestions(true)}
          onChange={(e) => handleStreetChange(e.target.value)}
          className={inputClass}
        />

        {showSuggestions && suggestions.length ? (
          <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-lg">
            {suggestions.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickSuggestion(s)}
                  className="flex w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-brand-tint"
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <input
        placeholder={country === "US" ? "ZIP" : "Postal code"}
        value={value.zip}
        onChange={(e) => onChange({ zip: e.target.value })}
        className={inputClass}
      />
    </div>
  );
}
