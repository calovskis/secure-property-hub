import { useEffect, useState } from "react";

/**
 * Daily USD exchange rates.
 *
 * Rates are pulled once a day from the open exchangerate-api feed (no key
 * required) and cached in localStorage, so a session reuses the same day's
 * rates and we always have a value even if the network call fails.
 */

const CACHE_KEY = "loqal.fx.usd.v1";
const ENDPOINT = "https://open.er-api.com/v6/latest/USD";

export type FxSnapshot = {
  /** How many units of the currency equal 1 USD. */
  perUsd: Record<string, number>;
  /** ISO date (yyyy-mm-dd) the rates were fetched. */
  fetchedOn: string;
  updatedAt: string;
};

/** Conservative fallback so conversion still works offline. */
const FALLBACK: FxSnapshot = {
  perUsd: {
    USD: 1, EUR: 0.92, GBP: 0.79, CHF: 0.88, CAD: 1.36, AUD: 1.52, NZD: 1.64,
    JPY: 152, CNY: 7.2, HKD: 7.82, SGD: 1.34, KRW: 1350, TWD: 32, INR: 83,
    IDR: 15800, MYR: 4.7, THB: 36, PHP: 57, VND: 25000, PKR: 278, BDT: 110,
    LKR: 300, NPR: 133, SEK: 10.5, NOK: 10.7, DKK: 6.9, ISK: 138, PLN: 3.95,
    CZK: 23, HUF: 360, RON: 4.6, BGN: 1.8, RSD: 108, TRY: 32, UAH: 39,
    GEL: 2.7, AMD: 390, AZN: 1.7, KZT: 450, UZS: 12600, ILS: 3.7, AED: 3.67,
    SAR: 3.75, QAR: 3.64, KWD: 0.31, BHD: 0.38, OMR: 0.38, JOD: 0.71,
    EGP: 48, MAD: 10, TND: 3.1, ZAR: 18.5, NGN: 1500, KES: 130, GHS: 14,
    MXN: 17.5, BRL: 5.2, ARS: 900, CLP: 950, COP: 3900, PEN: 3.7, UYU: 39,
    DOP: 59, JMD: 155, TTD: 6.8, PAB: 1, CRC: 520, GTQ: 7.8, MDL: 17.7,
    MKD: 57, ALL: 95, BAM: 1.8,
  },
  fetchedOn: "static",
  updatedAt: "static fallback",
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function readCache(): FxSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FxSnapshot;
    return parsed?.perUsd ? parsed : null;
  } catch {
    return null;
  }
}

export async function fetchFxRates(): Promise<FxSnapshot> {
  const cached = readCache();
  if (cached && cached.fetchedOn === today()) return cached;

  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error(`FX request failed: ${res.status}`);
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    if (json.result !== "success" || !json.rates) throw new Error("FX payload invalid");
    const snapshot: FxSnapshot = {
      perUsd: json.rates,
      fetchedOn: today(),
      updatedAt: json.time_last_update_utc ?? today(),
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
    }
    return snapshot;
  } catch {
    return cached ?? FALLBACK;
  }
}

/** USD value of 1 unit of `code` (what the questionnaire stores as fxRate). */
export function usdPerUnit(snapshot: FxSnapshot, code: string): number | null {
  const per = snapshot.perUsd[code.toUpperCase()];
  if (!per || !Number.isFinite(per)) return null;
  return 1 / per;
}

export function useFxRates(): { fx: FxSnapshot; loading: boolean } {
  const [fx, setFx] = useState<FxSnapshot>(() => readCache() ?? FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchFxRates()
      .then((snap) => alive && setFx(snap))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return { fx, loading };
}
