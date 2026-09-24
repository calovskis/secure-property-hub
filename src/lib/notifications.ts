/**
 * Platform notification centre. One store for every audience (clients,
 * partners, admins); the header bell shows the current user's unread count
 * and each notification deep-links to the relevant page.
 *
 * Notifications are addressed to a user e-mail, or to "admins" for the whole
 * Loqal team. Most entries are derived from platform state (visa expiry,
 * pending decisions, licence renewals…) by `NotificationSync` in the header;
 * `emailCopy` marks the ones that are also e-mailed (3rd-day reminders and
 * later, per product rules).
 */
import { useCallback, useSyncExternalStore } from "react";

export type NotificationSeverity = "info" | "warning" | "critical";

export type AppNotification = {
  /** Stable id — re-deriving the same notification never duplicates it. */
  id: string;
  /** Recipient: user e-mail (lowercased) or "admins". */
  to: string;
  title: string;
  body?: string;
  /** Where clicking the notification lands. */
  href?: string;
  severity: NotificationSeverity;
  /** An e-mail copy was also sent to the recipient. */
  emailCopy?: boolean;
  /** The action this notification asked for has been completed. */
  completed?: boolean;
  /** Small status chip shown next to the title (e.g. "Assigned"). */
  badge?: string;
  createdAt: string;
  readAt?: string;
};

type NotificationState = { items: AppNotification[] };

const STORAGE_KEY = "loqal.notifications.v1";
const MAX_ITEMS = 300;
/* Ids the recipient has already read. Kept separately so a derived notice that
   was trimmed from the list and re-derived later never comes back unread. */
const READ_KEY = "loqal.notifications.read.v1";
const MAX_READ = 3000;
let readIds: Set<string> | null = null;
function loadRead(): Set<string> {
  if (readIds) return readIds;
  try {
    readIds = new Set(JSON.parse(window.localStorage.getItem(READ_KEY) ?? "[]") as string[]);
  } catch {
    readIds = new Set();
  }
  return readIds;
}
function rememberRead(keys: string[]) {
  if (!keys.length) return;
  const set = loadRead();
  keys.forEach((k) => set.add(k));
  const arr = [...set].slice(-MAX_READ);
  readIds = new Set(arr);
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}
const readKey = (i: { to: string; id: string }) => `${i.to}|${i.id}`;

let state: NotificationState | null = null;
const listeners = new Set<() => void>();

function load(): NotificationState {
  if (state) return state;
  let next: NotificationState = { items: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { items: (JSON.parse(raw) as Partial<NotificationState>).items ?? [] };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: NotificationState) {
  rememberRead(next.items.filter((i) => i.readAt).map(readKey));
  state = { items: next.items.slice(0, MAX_ITEMS) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

/** Add or refresh a notification. Existing read state is preserved. */
export function notify(n: Omit<AppNotification, "createdAt"> & { createdAt?: string | undefined }) {
  const cur = load();
  const existing = cur.items.find((i) => i.id === n.id);
  const entry: AppNotification = {
    ...n,
    createdAt: n.createdAt ?? existing?.createdAt ?? new Date().toISOString(),
    ...(existing?.readAt
      ? { readAt: existing.readAt }
      : loadRead().has(readKey(n))
        ? { readAt: new Date().toISOString() }
        : {}),
  };
  if (
    existing &&
    existing.title === entry.title &&
    existing.body === entry.body &&
    existing.severity === entry.severity &&
    existing.completed === entry.completed &&
    existing.badge === entry.badge &&
    existing.href === entry.href &&
    Boolean(existing.readAt) === Boolean(entry.readAt)
  ) {
    return; // nothing changed — avoid render loops
  }
  commit({
    items: [entry, ...cur.items.filter((i) => i.id !== n.id)],
  });
}

/** Bulk-upsert derived notifications; no-op when nothing is new. */
export function syncNotifications(
  list: (Omit<AppNotification, "createdAt"> & { createdAt?: string | undefined })[],
) {
  list.forEach((n) => notify(n));
}

/** Mark previously-created action notifications complete without changing their date or order. */
export function completeNotifications(ids: string[]) {
  if (!ids.length) return;
  const wanted = new Set(ids);
  const cur = load();
  let changed = false;
  const items = cur.items.map((item) => {
    if (!wanted.has(item.id) || item.completed) return item;
    changed = true;
    return { ...item, completed: true };
  });
  if (changed) commit({ items });
}

/**
 * Derived notifications describe live platform state, so a notification that
 * is no longer derived (the licence was renewed, the request disappeared, an
 * older app version created it) must not linger as an open task. Each sync
 * pass declares the id prefixes it owns and the ids it still derives; every
 * other, not-yet-completed item under those prefixes is dropped. Completed
 * items are kept — they are the recipient's history.
 */
export function pruneDerived(recipient: string, prefixes: string[], liveIds: string[]) {
  const key = recipient.toLowerCase();
  if (!key) return;
  const live = new Set(liveIds);
  const cur = load();
  const items = cur.items.filter((item) => {
    if (item.to !== key || item.completed) return true;
    if (!prefixes.some((p) => item.id.startsWith(p))) return true;
    return live.has(item.id);
  });
  if (items.length !== cur.items.length) commit({ items });
}

const SERVER_SNAPSHOT: NotificationState = { items: [] };

export function useNotifications(recipient: string | undefined) {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );

  const key = recipient?.toLowerCase();
  const items = key
    ? snapshot.items
        .filter((i) => i.to === key)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  const markRead = useCallback((id: string) => {
    const cur = load();
    commit({
      items: cur.items.map((i) =>
        i.id === id && !i.readAt ? { ...i, readAt: new Date().toISOString() } : i,
      ),
    });
  }, []);

  const markAllRead = useCallback(() => {
    if (!key) return;
    const cur = load();
    const now = new Date().toISOString();
    commit({
      items: cur.items.map((i) => (i.to === key && !i.readAt ? { ...i, readAt: now } : i)),
    });
  }, [key]);

  return {
    notifications: items,
    unread: items.filter((i) => !i.readAt).length,
    markRead,
    markAllRead,
  };
}
