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
  createdAt: string;
  readAt?: string;
};

type NotificationState = { items: AppNotification[] };

const STORAGE_KEY = "loqal.notifications.v1";
const MAX_ITEMS = 300;

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
    ...(existing?.readAt ? { readAt: existing.readAt } : {}),
  };
  if (
    existing &&
    existing.title === entry.title &&
    existing.body === entry.body &&
    existing.severity === entry.severity &&
    existing.href === entry.href
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
