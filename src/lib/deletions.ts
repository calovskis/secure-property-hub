/**
 * Profile deletion with a two-step approval and a 90-day recovery window.
 *
 * Whoever holds "users.delete.request" starts a deletion with a written
 * reason; whoever holds "users.delete.confirm" confirms it. Users can also
 * delete their own profile — that request is confirmed immediately, because
 * it is their own decision. In every case the profile is only scheduled for
 * removal: for 90 days it can be restored, after which it is purged.
 */
import { useCallback, useSyncExternalStore } from "react";
import { RECOVERY_DAYS } from "@/lib/roles";

export type DeletionStatus = "requested" | "deleted" | "cancelled" | "restored";

export type DeletionRecord = {
  id: string;
  /** Lower-cased e-mail of the profile being deleted. */
  email: string;
  name: string;
  roleLabel: string;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  /** True when the person deleted their own profile. */
  selfRequested: boolean;
  status: DeletionStatus;
  confirmedBy?: string;
  confirmedAt?: string;
  /** ISO date the profile is permanently removed (deletion + 90 days). */
  recoverableUntil?: string;
  closedBy?: string;
  closedAt?: string;
  closeNote?: string;
};

type State = { records: DeletionRecord[] };

const STORAGE_KEY = "loqal.deletions.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  let next: State = { records: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { records: (JSON.parse(raw) as Partial<State>).records ?? [] };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: State) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

const SERVER_SNAPSHOT: State = { records: [] };

function recoveryDeadline(from: Date) {
  const d = new Date(from);
  d.setDate(d.getDate() + RECOVERY_DAYS);
  return d.toISOString();
}

/** Days left in the recovery window; 0 once it has passed. */
export function daysLeft(record: DeletionRecord): number {
  if (!record.recoverableUntil) return 0;
  const ms = new Date(record.recoverableUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function isLive(record: DeletionRecord): boolean {
  return record.status === "requested" || record.status === "deleted";
}

export function useDeletions() {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );

  /** The open request or active deletion for a profile, if any. */
  const recordFor = useCallback(
    (email: string) =>
      snapshot.records.find((r) => r.email === email.trim().toLowerCase() && isLive(r)),
    [snapshot.records],
  );

  const requestDeletion = useCallback(
    (input: {
      email: string;
      name: string;
      roleLabel: string;
      reason: string;
      requestedBy: string;
      /** Self-service deletions are confirmed straight away. */
      selfRequested?: boolean;
    }) => {
      const cur = load();
      const email = input.email.trim().toLowerCase();
      if (cur.records.some((r) => r.email === email && isLive(r))) return;
      const now = new Date();
      const self = Boolean(input.selfRequested);
      const record: DeletionRecord = {
        id: uid(),
        email,
        name: input.name,
        roleLabel: input.roleLabel,
        reason: input.reason.trim(),
        requestedBy: input.requestedBy,
        requestedAt: now.toISOString(),
        selfRequested: self,
        status: self ? "deleted" : "requested",
        ...(self
          ? {
              confirmedBy: input.name,
              confirmedAt: now.toISOString(),
              recoverableUntil: recoveryDeadline(now),
            }
          : {}),
      };
      commit({ records: [record, ...cur.records] });
    },
    [],
  );

  const confirmDeletion = useCallback((id: string, confirmedBy: string) => {
    const cur = load();
    const now = new Date();
    commit({
      records: cur.records.map((r) =>
        r.id === id && r.status === "requested"
          ? {
              ...r,
              status: "deleted",
              confirmedBy,
              confirmedAt: now.toISOString(),
              recoverableUntil: recoveryDeadline(now),
            }
          : r,
      ),
    });
  }, []);

  const cancelRequest = useCallback((id: string, by: string, note?: string) => {
    const cur = load();
    commit({
      records: cur.records.map((r) =>
        r.id === id && r.status === "requested"
          ? {
              ...r,
              status: "cancelled",
              closedBy: by,
              closedAt: new Date().toISOString(),
              ...(note ? { closeNote: note } : {}),
            }
          : r,
      ),
    });
  }, []);

  const restoreProfile = useCallback((id: string, by: string) => {
    const cur = load();
    commit({
      records: cur.records.map((r) =>
        r.id === id && r.status === "deleted"
          ? { ...r, status: "restored", closedBy: by, closedAt: new Date().toISOString() }
          : r,
      ),
    });
  }, []);

  return {
    records: snapshot.records,
    pending: snapshot.records.filter((r) => r.status === "requested"),
    deleted: snapshot.records.filter((r) => r.status === "deleted"),
    history: snapshot.records.filter((r) => !isLive(r)),
    recordFor,
    requestDeletion,
    confirmDeletion,
    cancelRequest,
    restoreProfile,
  };
}
