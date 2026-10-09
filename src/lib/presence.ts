/**
 * Platform presence & engagement tracking.
 *
 * Every signed-in person's visits are recorded locally: which page they open,
 * how long they stay, when they were last online and which searches they run
 * (query, area, price band). The Loqal admin console reads this to show
 * "last online" plus click metrics for a profile.
 *
 * Only real, observed activity is stored — nothing is fabricated. A profile
 * with no recorded sessions simply shows "no activity recorded yet".
 */
import { useSyncExternalStore } from "react";

export type PageVisit = {
  path: string;
  at: string;
  /** Dwell time on that page, in seconds. */
  seconds: number;
};

export type SearchEvent = {
  at: string;
  query?: string | undefined;
  area?: string | undefined;
  priceMin?: number | undefined;
  priceMax?: number | undefined;
};

export type PresenceRecord = {
  email: string;
  firstSeen: string;
  lastSeen: string;
  /** Number of distinct sessions (a gap of 30+ minutes starts a new one). */
  sessions: number;
  visits: PageVisit[];
  searches: SearchEvent[];
};

type PresenceState = { people: Record<string, PresenceRecord> };

const STORAGE_KEY = "loqal.presence.v1";
const MAX_VISITS = 300;
const MAX_SEARCHES = 120;
const SESSION_GAP_MS = 30 * 60 * 1000;

let state: PresenceState | null = null;
const listeners = new Set<() => void>();

function load(): PresenceState {
  if (state) return state;
  let next: PresenceState = { people: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { people: (JSON.parse(raw) as Partial<PresenceState>).people ?? {} };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: PresenceState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function ensure(email: string): PresenceRecord {
  const cur = load();
  const key = email.toLowerCase();
  const now = new Date().toISOString();
  return (
    cur.people[key] ?? {
      email: key,
      firstSeen: now,
      lastSeen: now,
      sessions: 0,
      visits: [],
      searches: [],
    }
  );
}

function save(record: PresenceRecord) {
  const cur = load();
  commit({ people: { ...cur.people, [record.email]: record } });
}

/** Records a page view with the time spent on it. */
export function recordVisit(email: string | undefined, path: string, seconds: number) {
  if (!email || seconds < 1) return;
  const rec = ensure(email);
  const now = new Date();
  const gap = now.getTime() - new Date(rec.lastSeen).getTime();
  save({
    ...rec,
    lastSeen: now.toISOString(),
    sessions: rec.sessions === 0 || gap > SESSION_GAP_MS ? rec.sessions + 1 : rec.sessions,
    visits: [{ path, at: now.toISOString(), seconds: Math.round(seconds) }, ...rec.visits].slice(
      0,
      MAX_VISITS,
    ),
  });
}

/** Records a marketplace / property search. */
export function recordSearch(email: string | undefined, event: Omit<SearchEvent, "at">) {
  if (!email) return;
  const rec = ensure(email);
  const now = new Date().toISOString();
  save({
    ...rec,
    lastSeen: now,
    searches: [{ at: now, ...event }, ...rec.searches].slice(0, MAX_SEARCHES),
  });
}

const SERVER_SNAPSHOT: PresenceState = { people: {} };

export function usePresence() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  ).people;
}

export type EngagementSummary = {
  lastSeen?: string | undefined;
  firstSeen?: string | undefined;
  sessions: number;
  totalMinutes: number;
  visitsPerWeek: number;
  /** Pages ranked by total time spent. */
  topPages: { path: string; visits: number; minutes: number }[];
  searches: SearchEvent[];
  topAreas: { area: string; count: number }[];
  topQueries: { query: string; count: number }[];
  /** Average of the price bands the person searched in, when available. */
  priceBand?: { min: number; max: number } | undefined;
};

const EMPTY: EngagementSummary = {
  sessions: 0,
  totalMinutes: 0,
  visitsPerWeek: 0,
  topPages: [],
  searches: [],
  topAreas: [],
  topQueries: [],
};

function rank(values: (string | undefined)[]) {
  const counts = new Map<string, number>();
  for (const v of values) {
    const key = (v ?? "").trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function engagementFor(
  people: Record<string, PresenceRecord>,
  email: string,
): EngagementSummary {
  const rec = people[email.toLowerCase()];
  if (!rec) return EMPTY;

  const byPath = new Map<string, { visits: number; seconds: number }>();
  let totalSeconds = 0;
  for (const v of rec.visits) {
    totalSeconds += v.seconds;
    const cur = byPath.get(v.path) ?? { visits: 0, seconds: 0 };
    byPath.set(v.path, { visits: cur.visits + 1, seconds: cur.seconds + v.seconds });
  }

  const spanDays = Math.max(
    1,
    (new Date(rec.lastSeen).getTime() - new Date(rec.firstSeen).getTime()) / 86_400_000,
  );

  const mins = rec.searches.map((s) => s.priceMin).filter((n): n is number => typeof n === "number");
  const maxs = rec.searches.map((s) => s.priceMax).filter((n): n is number => typeof n === "number");

  return {
    lastSeen: rec.lastSeen,
    firstSeen: rec.firstSeen,
    sessions: rec.sessions,
    totalMinutes: Math.round(totalSeconds / 60),
    visitsPerWeek: Number(((rec.visits.length / spanDays) * 7).toFixed(1)),
    topPages: [...byPath.entries()]
      .map(([path, v]) => ({ path, visits: v.visits, minutes: Math.round(v.seconds / 60) }))
      .sort((a, b) => b.minutes - a.minutes || b.visits - a.visits)
      .slice(0, 6),
    searches: rec.searches.slice(0, 20),
    topAreas: rank(rec.searches.map((s) => s.area))
      .slice(0, 5)
      .map(([area, count]) => ({ area, count })),
    topQueries: rank(rec.searches.map((s) => s.query))
      .slice(0, 5)
      .map(([query, count]) => ({ query, count })),
    priceBand:
      mins.length || maxs.length
        ? {
            min: mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : 0,
            max: maxs.length ? Math.round(maxs.reduce((a, b) => a + b, 0) / maxs.length) : 0,
          }
        : undefined,
  };
}
