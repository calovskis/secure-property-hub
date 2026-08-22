/**
 * Admin-managed profile overrides. The Loqal admin console can correct a
 * client's or partner's display data (name, phone, internal note); overrides
 * are keyed by e-mail and merged over the source records wherever the admin
 * looks at people.
 */
import { useCallback, useSyncExternalStore } from "react";

export type ProfileOverride = {
  displayName?: string;
  phone?: string;
  company?: string;
  note?: string;
  updatedAt: string;
};

type DirectoryState = { overrides: Record<string, ProfileOverride> };

const STORAGE_KEY = "loqal.directory.v1";

let state: DirectoryState | null = null;
const listeners = new Set<() => void>();

function load(): DirectoryState {
  if (state) return state;
  let next: DirectoryState = { overrides: {} };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { overrides: (JSON.parse(raw) as Partial<DirectoryState>).overrides ?? {} };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: DirectoryState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const SERVER_SNAPSHOT: DirectoryState = { overrides: {} };

export function useDirectory() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );

  const setOverride = useCallback(
    (email: string, patch: Omit<ProfileOverride, "updatedAt">) => {
      const cur = load();
      const key = email.toLowerCase();
      commit({
        overrides: {
          ...cur.overrides,
          [key]: { ...cur.overrides[key], ...patch, updatedAt: new Date().toISOString() },
        },
      });
    },
    [],
  );

  return { overrides: snapshot.overrides, setOverride };
}
