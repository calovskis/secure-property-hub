import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js";
import { COUNTRY_NAME } from "@/data/countries";

export type PhoneCountry = { code: CountryCode; name: string; dial: string };

/** Every country libphonenumber knows about, labelled with its ISO name. */
export const PHONE_COUNTRIES: PhoneCountry[] = getCountries()
  .map((code) => ({
    code,
    name: COUNTRY_NAME[code] ?? code,
    dial: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_PHONE_COUNTRY: CountryCode = "US";

export function digitsOnly(value: string) {
  return value.replace(/\D+/g, "");
}

/** Combine a country and a national number into E.164 (`+15550100000`). */
export function toE164(country: CountryCode, national: string) {
  const digits = digitsOnly(national);
  if (!digits) return "";
  return `+${getCountryCallingCode(country)}${digits}`;
}

/** Split a stored phone value back into country + national digits. */
export function splitPhone(value: string): { country: CountryCode; national: string } {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  if (parsed?.country) {
    return { country: parsed.country, national: parsed.nationalNumber };
  }
  return { country: DEFAULT_PHONE_COUNTRY, national: digitsOnly(value) };
}

/**
 * Validation message for a national number in a given country, or "" when the
 * number has exactly the right amount of digits for that country.
 */
export function phoneError(country: CountryCode, national: string): string {
  const digits = digitsOnly(national);
  if (!digits) return "";
  const result = validatePhoneNumberLength(digits, country);
  const countryName = COUNTRY_NAME[country] ?? country;
  if (result === "TOO_SHORT" || result === "INVALID_LENGTH")
    return `Too few digits for a ${countryName} phone number.`;
  if (result === "TOO_LONG") return `Too many digits for a ${countryName} phone number.`;
  if (result) return `Invalid phone number for ${countryName}.`;
  return "";
}

/** True when a complete, stored phone value is a valid number. */
export function isValidPhone(value: string): boolean {
  const { country, national } = splitPhone(value);
  if (!digitsOnly(national)) return false;
  return phoneError(country, national) === "";
}

/** Pretty international formatting for display. */
export function formatPhone(value: string): string {
  const parsed = value ? parsePhoneNumberFromString(value) : undefined;
  return parsed ? parsed.formatInternational() : value;
}
