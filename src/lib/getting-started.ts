/**
 * "Get Started" onboarding checklist state.
 *
 * Every Loqal user (client, partner, admin) has a short, role-specific list of
 * set-up tasks and things to know. Most items complete themselves from real
 * platform state (registration details, submitted questionnaire, signed
 * agreement…). The purely informational ones are marked here, once the person
 * has read them, so the progress ring reflects a genuinely complete profile.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

type Entry = { done: string[]; dismissedAt?: string };
type State = Record<string, Entry>;

const STORAGE_KEY = "loqal.getStarted.v1";
const EMPTY: State = {};

let cache: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (cache) return cache;
  let next: State = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = JSON.parse(raw) as State;
  } catch {
    /* ignore */
  }
  cache = next;
  return next;
}

function commit(next: State) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useGettingStarted(email: string | undefined) {
  const snapshot = useSyncExternalStore(subscribe, () => load(), () => EMPTY);
  const key = (email ?? "").trim().toLowerCase();
  const entry = snapshot[key];

  const read = useMemo(() => new Set(entry?.done ?? []), [entry?.done]);

  const markRead = useCallback(
    (id: string) => {
      if (!key) return;
      const cur = load();
      const prev = cur[key] ?? { done: [] };
      if (prev.done.includes(id)) return;
      commit({ ...cur, [key]: { ...prev, done: [...prev.done, id] } });
    },
    [key],
  );

  const dismiss = useCallback(() => {
    if (!key) return;
    const cur = load();
    const prev = cur[key] ?? { done: [] };
    commit({ ...cur, [key]: { ...prev, dismissedAt: new Date().toISOString() } });
  }, [key]);

  const restore = useCallback(() => {
    if (!key) return;
    const cur = load();
    const prev = cur[key] ?? { done: [] };
    commit({ ...cur, [key]: { done: prev.done } });
  }, [key]);

  return { read, markRead, dismiss, restore, dismissed: Boolean(entry?.dismissedAt) };
}
