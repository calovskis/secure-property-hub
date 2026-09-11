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
    MKD: 57, ALL: 95, BAM: 1.8, BYN: 3.3, AFN: 72, AOA: 850, ANG: 1.79,
    AWG: 1.79, BBD: 2, BSD: 1, BMD: 1, BND: 1.34, BOB: 6.9, BTN: 83,
    BWP: 13.6, BIF: 2870, BZD: 2, CDF: 2800, CUP: 24, CVE: 101, DJF: 178,
    DZD: 134, ERN: 15, ETB: 120, FJD: 2.25, FKP: 0.79, GIP: 0.79, GMD: 68,
    GNF: 8600, GYD: 209, HNL: 24.7, HTG: 132, IQD: 1310, IRR: 42000,
    KGS: 86, KHR: 4100, KMF: 452, KPW: 900, KYD: 0.83, LAK: 21500,
    LBP: 89000, LRD: 195, LSL: 18.5, LYD: 4.8, MGA: 4500, MMK: 2100,
    MNT: 3400, MOP: 8.05, MRU: 39.7, MUR: 46, MVR: 15.4, MWK: 1730,
    MZN: 64, NAD: 18.5, NIO: 36.8, PGK: 3.9, PYG: 7500, RWF: 1300,
    SBD: 8.4, SCR: 14, SDG: 600, SHP: 0.79, SLE: 22.5, SOS: 571, SRD: 34,
    SSP: 1300, STN: 22.6, SYP: 13000, SZL: 18.5, TJS: 10.9, TMT: 3.5,
    TOP: 2.35, TZS: 2650, UGX: 3700, VES: 36, VUV: 119, WST: 2.75,
    XAF: 605, XCD: 2.7, XOF: 605, XPF: 110, YER: 250, ZMW: 26, ZWG: 26,
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
