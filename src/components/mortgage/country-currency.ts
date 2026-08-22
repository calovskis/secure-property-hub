/**
 * Best-effort ISO 3166-1 alpha-2 country -> ISO 4217 currency code map, used
 * to auto-assign the currency for a non-US employer/business address. Falls
 * back to USD when a country isn't in the map (the client can still change
 * the currency manually).
 */
export const COUNTRY_CURRENCY: Record<string, string> = {
  US: "USD", CA: "CAD", MX: "MXN", GB: "GBP", IE: "EUR",
  DE: "EUR", FR: "EUR", ES: "EUR", PT: "EUR", IT: "EUR", NL: "EUR", BE: "EUR",
  AT: "EUR", FI: "EUR", GR: "EUR", LU: "EUR", MT: "EUR", CY: "EUR", SK: "EUR",
  SI: "EUR", EE: "EUR", LV: "EUR", LT: "EUR", HR: "EUR", AD: "EUR", MC: "EUR",
  CH: "CHF", LI: "CHF", NO: "NOK", SE: "SEK", DK: "DKK", IS: "ISK",
  PL: "PLN", CZ: "CZK", HU: "HUF", RO: "RON", BG: "BGN", RS: "RSD",
  MK: "MKD", AL: "ALL", BA: "BAM", MD: "MDL", UA: "UAH", RU: "RUB", GE: "GEL",
  AM: "AMD", AZ: "AZN", KZ: "KZT", UZ: "UZS", TR: "TRY",
  IL: "ILS", AE: "AED", SA: "SAR", QA: "QAR", KW: "KWD", BH: "BHD",
  OM: "OMR", JO: "JOD", EG: "EGP", MA: "MAD", TN: "TND",
  ZA: "ZAR", NG: "NGN", KE: "KES", GH: "GHS",
  CN: "CNY", HK: "HKD", SG: "SGD", KR: "KRW", TW: "TWD", JP: "JPY",
  IN: "INR", ID: "IDR", MY: "MYR", TH: "THB", PH: "PHP", VN: "VND",
  PK: "PKR", BD: "BDT", LK: "LKR", NP: "NPR",
  AU: "AUD", NZ: "NZD",
  BR: "BRL", AR: "ARS", CL: "CLP", CO: "COP", PE: "PEN", UY: "UYU",
  DO: "DOP", JM: "JMD", TT: "TTD", PA: "PAB", CR: "CRC", GT: "GTQ",
};

/** Currency an address's country implies; USD for the US or unknown countries. */
export function currencyForCountry(country: string): string {
  return COUNTRY_CURRENCY[country?.toUpperCase() ?? ""] ?? "USD";
}
