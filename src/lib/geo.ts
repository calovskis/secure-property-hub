/**
 * Worldwide address helpers: ISO 3166-2 subdivisions per country and lazily
 * loaded city lists per subdivision. City data is split per country so only
 * the selected country's chunk is downloaded.
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

/** Flatten the loaded map into the city list for a region (or the whole country). */
export function citiesFor(map: Record<string, string[]>, region: string): string[] {
  if (region && map[region]) return map[region];
  const all = new Set<string>();
  for (const list of Object.values(map)) for (const c of list) all.add(c);
  return [...all].sort((a, b) => a.localeCompare(b));
}
