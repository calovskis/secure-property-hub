/**
 * Direct client ↔ buyer's-agent messages on one property file.
 *
 * While a call or a video showcasing is still being agreed (or simply while the
 * file is live) both sides need a way to talk: the buyer asks a question or
 * requests something, the agent asks the buyer for information or comes back
 * with an answer. Messages are kept per mortgage/property file so the whole
 * exchange stays with the property it belongs to.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

export type ChatSide = "client" | "agent";

export type FileMessage = {
  id: string;
  /** Mortgage/property file the exchange belongs to. */
  leadId: string;
  from: ChatSide;
  /** Display name of the author (agents see buyers' first name only). */
  authorName: string;
  /** An agent asking the buyer for information, vs. a plain message. */
  kind: "message" | "info_request";
  body: string;
  createdAt: string;
  /** Set when the other side has opened the thread. */
  readAt?: string;
};

type State = { items: FileMessage[] };

const STORAGE_KEY = "loqal.fileChat.v1";
const uid = () => Math.random().toString(36).slice(2, 10);

let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  if (state) return state;
  let next: State = { items: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = { items: (JSON.parse(raw) as Partial<State>).items ?? [] };
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

export function sendFileMessage(input: Omit<FileMessage, "id" | "createdAt">): FileMessage {
  const entry: FileMessage = { ...input, id: uid(), createdAt: new Date().toISOString() };
  commit({ items: [...load().items, entry] });
  return entry;
}

/** Marks everything the other side wrote on this file as read. */
export function markThreadRead(leadId: string, side: ChatSide) {
  const now = new Date().toISOString();
  commit({
    items: load().items.map((m) =>
      m.leadId === leadId && m.from !== side && !m.readAt ? { ...m, readAt: now } : m,
    ),
  });
}

const SERVER_SNAPSHOT: State = { items: [] };

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

export function useFileChat(leadId: string, side: ChatSide) {
  const snapshot = useStore();
  const messages = useMemo(
    () =>
      snapshot.items
        .filter((m) => m.leadId === leadId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [snapshot.items, leadId],
  );
  const unread = messages.filter((m) => m.from !== side && !m.readAt).length;
  const send = useCallback(
    (input: Omit<FileMessage, "id" | "createdAt" | "leadId" | "from">) =>
      sendFileMessage({ ...input, leadId, from: side }),
    [leadId, side],
  );
  const markRead = useCallback(() => markThreadRead(leadId, side), [leadId, side]);
  return { messages, unread, send, markRead };
}

/** Unanswered questions/requests waiting for one side, across all files. */
export function awaitingReply(items: FileMessage[], side: ChatSide) {
  const byLead = new Map<string, FileMessage>();
  for (const m of items) byLead.set(m.leadId, m);
  return [...byLead.values()].filter((m) => m.from !== side);
}
