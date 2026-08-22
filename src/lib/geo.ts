/**
 * Worldwide address helpers: ISO 3166-2 subdivisions per country and lazily
 * loaded city lists per subdivision. City data is split per country so only
 * the selected country's chunk is downloaded. Also includes a thin client
 * for the free Nominatim (OpenStreetMap) geocoder used for street-level
 * address autocomplete.
 */
import { SUBDIVISIONS, type Subdivision } from "@/data/subdivisions";

export type { Subdivision };

/** What a subdivision is called in the countries we see most. */
const REGION_TERM: Record<string, string> = {
  US: "State",
  CA: "Province",
  AU: "State",
  IN: "State",
  BR: "State",
  MX: "State",
  DE: "State",
  AT: "State",
  CH: "Canton",
  GB: "County",
  IE: "County",
  AE: "Emirate",
  RU: "Region",
  UA: "Oblast",
  FR: "Region",
  IT: "Region",
  ES: "Region",
  PT: "District",
  NL: "Province",
  BE: "Province",
  PL: "Voivodeship",
  JP: "Prefecture",
  CN: "Province",
  ZA: "Province",
};

export function regionTerm(country: string) {
  return REGION_TERM[country] ?? "State / region";
}

export function subdivisionsFor(country: string): Subdivision[] {
  return SUBDIVISIONS[country] ?? [];
}

export function hasSubdivisions(country: string) {
  return subdivisionsFor(country).length > 0;
}

export function subdivisionLabel(country: string, code: string) {
  if (!code) return "";
  const hit = subdivisionsFor(country).find((s) => s.code === code);
  if (!hit) return code;
  return country === "US" ? `${hit.code} — ${hit.name}` : hit.name;
}

/** Strip the generic administrative suffix so "Jūrmala Municipality" -> "Jūrmala". */
function bareName(name: string): string {
  return name
    .replace(
      /\s*(municipality|district|province|region|county|department|prefecture|governorate|state|canton|oblast|voivodeship|city)\s*$/i,
      "",
    )
    .trim()
    .toLowerCase();
}

const cityModules = import.meta.glob("../data/cities/*.ts") as Record<
  string,
  () => Promise<{ default: Record<string, string[]> }>
>;

const cache = new Map<string, Record<string, string[]>>();

/** Cities for a country (grouped by subdivision code); loaded on demand. */
export async function loadCities(country: string): Promise<Record<string, string[]>> {
  if (!country) return {};
  const cached = cache.get(country);
  if (cached) return cached;
  const loader = cityModules[`../data/cities/${country}.ts`];
  if (!loader) return {};
  const mod = await loader();
  cache.set(country, mod.default);
  return mod.default;
}

/**
 * Cities that belong to a region. Only the exact subdivision code's own
 * cities are offered — never unrelated cities from other regions. When a
 * subdivision is itself city-level (its name matches a known city, e.g.
 * "Jūrmala") but isn't keyed directly in the city map, we fall back to
 * matching by name so only that city (and its known localities, if any) is
 * offered. If nothing is known for the region we return an empty list so the
 * caller can invite free text instead of dumping the whole country.
 *
 * The country-wide list (every city in the map) is only returned when no
 * region has been selected at all.
 */
export function citiesFor(map: Record<string, string[]>, region: string, regionName?: string): string[] {
  if (!region) {
    const all = new Set<string>();
    for (const list of Object.values(map)) for (const c of list) all.add(c);
    return [...all].sort((a, b) => a.localeCompare(b));
  }

  const direct = map[region];
  if (direct && direct.length) return direct;

  if (regionName) {
    const bare = bareName(regionName);
    for (const list of Object.values(map)) {
      const hit = list.find((c) => c.toLowerCase() === bare);
      if (hit) return [hit];
    }
  }

  return [];
}

/** True when we have no known cities for this specific region (free text needed). */
export function hasCitiesFor(map: Record<string, string[]>, region: string, regionName?: string): boolean {
  return !region || citiesFor(map, region, regionName).length > 0;
}

/* ------------------------------------------------------------------------ *
 * Nominatim (OpenStreetMap) address autocomplete
 * ------------------------------------------------------------------------ */

export type AddressSuggestion = {
  /** Full label to show in the suggestions list. */
  label: string;
  street: string;
  city: string;
  state: string;
  zip: string;
};

type NominatimResult = {
  display_name?: string;
  address?: Record<string, string>;
};

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "Loqal Mortgage App address autocomplete (contact: support@loqal.com)";

/** In-memory cache so repeated/backspaced queries don't re-hit the network. */
const geocodeCache = new Map<string, AddressSuggestion[]>();

function pick(address: Record<string, string> | undefined, keys: string[]): string {
  if (!address) return "";
  for (const k of keys) {
    if (address[k]) return address[k];
  }
  return "";
}

function toSuggestion(result: NominatimResult): AddressSuggestion | null {
  const address = result.address;
  if (!address) return null;
  const houseNumber = pick(address, ["house_number"]);
  const road = pick(address, ["road", "pedestrian", "footway", "square", "neighbourhood"]);
  const street = [road, houseNumber].filter(Boolean).join(" ").trim();
  const city = pick(address, ["city", "town", "village", "municipality", "hamlet", "suburb", "county"]);
  const state = pick(address, ["state", "region", "state_district", "province"]);
  const zip = pick(address, ["postcode"]);
  if (!street && !city) return null;
  return {
    label: result.display_name ?? [street, city, state, zip].filter(Boolean).join(", "),
    street,
    city,
    state,
    zip,
  };
}

/**
 * Look up address suggestions from Nominatim, scoped to a country when known.
 * Never throws — network failures just resolve to an empty list so
 * typing is never blocked. Results are cached in-memory per query string.
 */
export async function searchAddress(
  query: string,
  country?: string,
  signal?: AbortSignal,
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const cacheKey = `${(country ?? "").toLowerCase()}|${q.toLowerCase()}`;
  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      limit: "6",
      q,
    });
    if (country) params.set("countrycodes", country.toLowerCase());

    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal: signal ?? null,
      headers: {
        Accept: "application/json",
        // Browsers may ignore/forbid setting this, but we send it anyway per
        // Nominatim's usage policy for environments that do honor it.
        "User-Agent": USER_AGENT,
      },
    });
    if (!res.ok) return [];

    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];

    const suggestions = data
      .map((r) => toSuggestion(r as NominatimResult))
      .filter((s): s is AddressSuggestion => s !== null);

    geocodeCache.set(cacheKey, suggestions);
    return suggestions;
  } catch {
    return [];
  }
}

const zipCache = new Map<string, string>();

/**
 * Best-effort ZIP/postal-code lookup for a picked suggestion whose geocode
 * result didn't include one (Nominatim often omits the postcode on the
 * initial search hit). Uses a structured follow-up query; never throws and
 * resolves to "" when no postcode is known.
 */
export async function lookupZip(
  input: { street: string; city: string; state: string; country?: string },
  signal?: AbortSignal,
): Promise<string> {
  if (!input.street && !input.city) return "";
  const key = `${input.country ?? ""}|${input.street}|${input.city}|${input.state}`.toLowerCase();
  const cached = zipCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
    });
    if (input.street) params.set("street", input.street);
    if (input.city) params.set("city", input.city);
    if (input.state) params.set("state", input.state);
    if (input.country) params.set("countrycodes", input.country.toLowerCase());

    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal: signal ?? null,
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
    });
    if (!res.ok) return "";

    const data: unknown = await res.json();
    const first = Array.isArray(data) ? (data[0] as NominatimResult | undefined) : undefined;
    const zip = pick(first?.address, ["postcode"]);
    zipCache.set(key, zip);
    return zip;
  } catch {
    return "";
  }
}
