/**
 * Platform-wide activity log. Every meaningful action (new inquiry, lender
 * decision, partner registration, approvals, signatures…) is recorded here;
 * the Loqal admin console renders it under Activity.
 */
import { useSyncExternalStore } from "react";

export type ActivityEntry = {
  id: string;
  at: string;
  /** Who did it — name, e-mail or "System". */
  actor: string;
  /** Short verb phrase, e.g. "submitted a pre-approval inquiry". */
  action: string;
  /** Optional detail line (property, company, amount…). */
  details?: string;
};

type ActivityState = { entries: ActivityEntry[] };

const STORAGE_KEY = "loqal.activity.v1";
const MAX_ENTRIES = 400;

let state: ActivityState | null = null;
const listeners = new Set<() => void>();

function load(): ActivityState {
  if (state) return state;
  let next: ActivityState = { entries: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { entries: (JSON.parse(raw) as Partial<ActivityState>).entries ?? [] };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: ActivityState) {
  state = { entries: next.entries.slice(0, MAX_ENTRIES) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function logActivity(actor: string, action: string, details?: string) {
  const cur = load();
  commit({
    entries: [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
        actor,
        action,
        ...(details ? { details } : {}),
      },
      ...cur.entries,
    ],
  });
}

const SERVER_SNAPSHOT: ActivityState = { entries: [] };

export function useActivity() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );
  return snapshot.entries;
}
