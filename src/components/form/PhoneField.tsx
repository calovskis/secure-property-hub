import { useEffect, useMemo, useState } from "react";
import type { CountryCode } from "libphonenumber-js";
import {
  PHONE_COUNTRIES,
  digitsOnly,
  phoneError,
  splitPhone,
  toE164,
} from "@/lib/phone";

const base =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

type Props = {
  /** Stored value in E.164 form, e.g. "+15550100000". */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Show the error even before the field was touched (e.g. after submit). */
  showError?: boolean;
  disabled?: boolean;
  id?: string;
};

/**
 * Country picker + national number entry. The country supplies the dialling
 * code, and the number is validated against that country's digit rules.
 */
export function PhoneField({
  value,
  onChange,
  placeholder = "Phone number without country code",
  showError = false,
  disabled = false,
  id,
}: Props) {
  const initial = useMemo(() => splitPhone(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [country, setCountry] = useState<CountryCode>(initial.country);
  const [national, setNational] = useState(initial.national);
  const [touched, setTouched] = useState(false);

  // Adopt externally reset/replaced values (e.g. loading saved data).
  useEffect(() => {
    if (value !== toE164(country, national)) {
      const next = splitPhone(value);
      if (!value) {
        setNational("");
        return;
      }
      setCountry(next.country);
      setNational(next.national);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const error = phoneError(country, national);
  const visible = (touched || showError) && !!national && !!error;

  function update(nextCountry: CountryCode, nextNational: string) {
    setCountry(nextCountry);
    setNational(nextNational);
    onChange(toE164(nextCountry, nextNational));
  }

  const dial = PHONE_COUNTRIES.find((c) => c.code === country)?.dial ?? "";

  return (
    <div>
      <div className="flex gap-2">
        <select
          aria-label="Phone country"
          disabled={disabled}
          className={`${base} w-[45%] shrink-0`}
          value={country}
          onChange={(e) => update(e.target.value as CountryCode, national)}
        >
          {PHONE_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name} (+{c.dial})
            </option>
          ))}
        </select>
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            +{dial}
          </span>
          <input
            id={id}
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            disabled={disabled}
            className={`${base} pl-${dial.length > 2 ? "16" : "12"} ${
              visible ? "border-destructive focus:border-destructive" : ""
            }`}
            style={{ paddingLeft: `${2.2 + dial.length * 0.55}rem` }}
            placeholder={placeholder}
            value={national}
            onChange={(e) => update(country, digitsOnly(e.target.value))}
            onBlur={() => setTouched(true)}
          />
        </div>
      </div>
      {visible ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
