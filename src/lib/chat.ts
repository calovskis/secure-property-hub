/**
 * Live chat between platform users (clients & partners) and Loqal support.
 * Threads are keyed by the user's e-mail; the floating chat widget writes
 * here and the admin console's Inbox tab answers.
 */
import { useCallback, useSyncExternalStore } from "react";

export type ChatMessage = {
  id: string;
  from: "user" | "support";
  text: string;
  at: string;
  readByUser?: boolean;
  readBySupport?: boolean;
};

export type ChatThread = {
  /** User e-mail (lowercased). */
  id: string;
  userName: string;
  role: string;
  messages: ChatMessage[];
};

type ChatState = { threads: ChatThread[] };

const STORAGE_KEY = "loqal.chat.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

let state: ChatState | null = null;
const listeners = new Set<() => void>();

function load(): ChatState {
  if (state) return state;
  let next: ChatState = { threads: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { threads: (JSON.parse(raw) as Partial<ChatState>).threads ?? [] };
  } catch {
    /* ignore */
  }
  state = next;
  return next;
}

function commit(next: ChatState) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function ensureThread(email: string, userName: string, role: string): ChatState {
  const cur = load();
  const key = email.toLowerCase();
  if (cur.threads.some((t) => t.id === key)) return cur;
  const thread: ChatThread = {
    id: key,
    userName,
    role,
    messages: [
      {
        id: uid(),
        from: "support",
        text: "Hi! This is Loqal live support — how can we help?",
        at: new Date().toISOString(),
        readBySupport: true,
      },
    ],
  };
  const next = { threads: [thread, ...cur.threads] };
  commit(next);
  return next;
}

const SERVER_SNAPSHOT: ChatState = { threads: [] };

function useStore() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => SERVER_SNAPSHOT,
  );
}

/** User side of a chat thread. */
export function useChatThread(email: string, userName: string, role: string) {
  const snapshot = useStore();
  const key = email.toLowerCase();
  const thread = snapshot.threads.find((t) => t.id === key);

  const send = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      ensureThread(email, userName, role);
      const cur = load();
      commit({
        threads: cur.threads.map((t) =>
          t.id === key
            ? {
                ...t,
                userName,
                role,
                messages: [
                  ...t.messages,
                  { id: uid(), from: "user", text: text.trim(), at: new Date().toISOString(), readByUser: true },
                ],
              }
            : t,
        ),
      });
    },
    [email, userName, role, key],
  );

  const markUserRead = useCallback(() => {
    const cur = load();
    commit({
      threads: cur.threads.map((t) =>
        t.id === key ? { ...t, messages: t.messages.map((m) => ({ ...m, readByUser: true })) } : t,
      ),
    });
  }, [key]);

  return {
    messages: thread?.messages ?? [],
    unread: (thread?.messages ?? []).filter((m) => m.from === "support" && !m.readByUser).length,
    send,
    markUserRead,
  };
}

/** Support (Loqal admin) side: every thread plus reply. */
export function useSupportInbox() {
  const snapshot = useStore();

  const reply = useCallback((threadId: string, text: string) => {
    if (!text.trim()) return;
    const cur = load();
    commit({
      threads: cur.threads.map((t) =>
        t.id === threadId
          ? {
              ...t,
              messages: [
                ...t.messages,
                { id: uid(), from: "support", text: text.trim(), at: new Date().toISOString(), readBySupport: true },
              ],
            }
          : t,
      ),
    });
  }, []);

  const markSupportRead = useCallback((threadId: string) => {
    const cur = load();
    commit({
      threads: cur.threads.map((t) =>
        t.id === threadId
          ? { ...t, messages: t.messages.map((m) => ({ ...m, readBySupport: true })) }
          : t,
      ),
    });
  }, []);

  return {
    threads: [...snapshot.threads].sort((a, b) => {
      const lastA = a.messages[a.messages.length - 1]?.at ?? "";
      const lastB = b.messages[b.messages.length - 1]?.at ?? "";
      return lastB.localeCompare(lastA);
    }),
    unreadTotal: snapshot.threads.reduce(
      (n, t) => n + t.messages.filter((m) => m.from === "user" && !m.readBySupport).length,
      0,
    ),
    reply,
    markSupportRead,
  };
}
