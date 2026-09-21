/**
 * Profile deletion with a two-step approval and a 90-day recovery window.
 *
 * Whoever holds "users.delete.request" starts a deletion with a written
 * reason; whoever holds "users.delete.confirm" confirms it. Users can also
 * delete their own profile — that request is confirmed immediately, because
 * it is their own decision. In every case the profile is only scheduled for
 * removal: for 90 days it can be restored, after which it is purged.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { RECOVERY_DAYS } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";

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

// ---------------------------------------------------------------------------
// Backend sync — deletions are mirrored to the `profile_deletions` table so a
// deletion made in one browser/session hides the account everywhere (accounts
// and partner registrations themselves are database-backed). localStorage
// stays the fast render cache; the server copy wins on conflicts.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DeletionRow = {
  id: string;
  email: string;
  name: string | null;
  role_label: string | null;
  reason: string | null;
  requested_by: string | null;
  requested_at: string | null;
  self_requested: boolean | null;
  status: DeletionStatus;
  confirmed_by: string | null;
  confirmed_at: string | null;
  recoverable_until: string | null;
  closed_by: string | null;
  closed_at: string | null;
  close_note: string | null;
};

function fromRow(row: DeletionRow): DeletionRecord {
  return {
    id: row.id,
    email: row.email.trim().toLowerCase(),
    name: row.name ?? "",
    roleLabel: row.role_label ?? "",
    reason: row.reason ?? "",
    requestedBy: row.requested_by ?? "",
    requestedAt: row.requested_at ?? new Date().toISOString(),
    selfRequested: Boolean(row.self_requested),
    status: row.status,
    ...(row.confirmed_by ? { confirmedBy: row.confirmed_by } : {}),
    ...(row.confirmed_at ? { confirmedAt: row.confirmed_at } : {}),
    ...(row.recoverable_until ? { recoverableUntil: row.recoverable_until } : {}),
    ...(row.closed_by ? { closedBy: row.closed_by } : {}),
    ...(row.closed_at ? { closedAt: row.closed_at } : {}),
    ...(row.close_note ? { closeNote: row.close_note } : {}),
  };
}

function toRow(r: DeletionRecord) {
  return {
    ...(UUID_RE.test(r.id) ? { id: r.id } : {}),
    email: r.email,
    name: r.name,
    role_label: r.roleLabel,
    reason: r.reason,
    requested_by: r.requestedBy,
    requested_at: r.requestedAt,
    self_requested: r.selfRequested,
    status: r.status,
    confirmed_by: r.confirmedBy ?? null,
    confirmed_at: r.confirmedAt ?? null,
    recoverable_until: r.recoverableUntil ?? null,
    closed_by: r.closedBy ?? null,
    closed_at: r.closedAt ?? null,
    close_note: r.closeNote ?? null,
  };
}

/** Best-effort mirror of one record to the backend; failures stay local. */
async function pushRecord(record: DeletionRecord) {
  try {
    if (UUID_RE.test(record.id)) {
      const { error } = await supabase.from("profile_deletions").upsert(toRow(record));
      if (!error) return;
    }
    if (isLive(record)) {
      // A live row for this e-mail may already exist under another id.
      const { data } = await supabase
        .from("profile_deletions")
        .select("id")
        .ilike("email", record.email)
        .in("status", ["requested", "deleted"])
        .limit(1);
      const existing = data?.[0] as { id: string } | undefined;
      if (existing) {
        await supabase.from("profile_deletions").update(toRow(record)).eq("id", existing.id);
        return;
      }
    }
    const { data: inserted, error } = await supabase
      .from("profile_deletions")
      .insert(toRow(record))
      .select("id")
      .maybeSingle();
    const newId = (inserted as { id?: string } | null)?.id;
    if (!error && newId && newId !== record.id) {
      // Adopt the server id so future updates hit the same row.
      const cur = load();
      commit({
        records: cur.records.map((r) => (r.id === record.id ? { ...r, id: newId } : r)),
      });
    }
  } catch {
    /* offline or no session — stays local */
  }
}

let syncing = false;

/** Merge server-side deletion records into the local store (server wins). */
async function syncFromServer() {
  if (syncing || typeof window === "undefined") return;
  syncing = true;
  try {
    const { data, error } = await supabase.from("profile_deletions").select("*");
    if (error || !data) return;
    const server = (data as DeletionRow[]).map(fromRow);
    const cur = load();
    const byId = new Map(cur.records.map((r) => [r.id, r] as const));
    for (const sr of server) byId.set(sr.id, sr);
    // One live record per e-mail — the server copy wins over local duplicates.
    const liveKeeper = new Map<string, string>();
    for (const sr of server) if (isLive(sr)) liveKeeper.set(sr.email, sr.id);
    const merged = [...byId.values()].filter(
      (r) => !isLive(r) || !liveKeeper.has(r.email) || liveKeeper.get(r.email) === r.id,
    );
    const serverIds = new Set(server.map((s) => s.id));
    const localOnly = merged.filter((r) => !serverIds.has(r.id));
    commit({ records: merged });
    for (const r of localOnly) void pushRecord(r);
  } catch {
    /* no session yet — retry on the next tick */
  } finally {
    syncing = false;
  }
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

/**
 * True once the profile's deletion is confirmed (or self-requested, which
 * confirms immediately). Used to drop OPEN tasks partners/admins still had
 * for that person — completed tasks stay as history.
 */
export function isProfileDeleted(email: string | null | undefined): boolean {
  if (!email) return false;
  const key = email.trim().toLowerCase();
  return load().records.some((r) => r.email === key && r.status === "deleted");
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

  // Pull backend deletion records once mounted, then keep them fresh — this is
  // what hides accounts deleted in another browser or session.
  useEffect(() => {
    void syncFromServer();
    const t = window.setInterval(() => void syncFromServer(), 30_000);
    return () => window.clearInterval(t);
  }, []);

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
