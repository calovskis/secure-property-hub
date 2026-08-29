/**
 * Pre-saved (unfinished) document uploads.
 *
 * Whenever someone starts answering a Loqal document request — attaching
 * files, typing a note, picking licence copies state by state — the progress
 * is kept here so they can close the pop-up and continue later. Unfinished
 * uploads are listed on the right-hand side of My Profile, exactly like the
 * client's unfinished forms.
 */
import { useSyncExternalStore } from "react";

export type UploadDraft = {
  id: string;
  /** Human label shown in the "unfinished uploads" panel. */
  label: string;
  /** Free-text answer, when the request asks for one. */
  note?: string;
  /** Generic attachments (file names). */
  files: string[];
  /** Per-state licence copies: state code → file name. */
  states?: Record<string, string>;
  /** How many items are expected in total, for the progress bar. */
  expected?: number;
  updatedAt: string;
};

type DraftState = Record<string, UploadDraft>;

const STORAGE_KEY = "loqal.upload-drafts.v1";

let cache: DraftState | null = null;
const listeners = new Set<() => void>();
const EMPTY: DraftState = {};

function load(): DraftState {
  if (cache) return cache;
  let next: DraftState = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) next = JSON.parse(raw) as DraftState;
  } catch {
    /* ignore */
  }
  cache = next;
  return next;
}

function commit(next: DraftState) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function getUploadDraft(id: string): UploadDraft | undefined {
  if (typeof window === "undefined") return undefined;
  return load()[id];
}

/** Counts as progress only when something was actually entered. */
function isEmpty(draft: UploadDraft) {
  return (
    !draft.note?.trim() && draft.files.length === 0 && Object.keys(draft.states ?? {}).length === 0
  );
}

export function saveUploadDraft(draft: Omit<UploadDraft, "updatedAt">) {
  if (typeof window === "undefined") return;
  const current = load();
  const next = { ...draft, updatedAt: new Date().toISOString() };
  if (isEmpty(next)) {
    if (!current[draft.id]) return;
    const { [draft.id]: _drop, ...rest } = current;
    commit(rest);
    return;
  }
  commit({ ...current, [draft.id]: next });
}

export function clearUploadDraft(id: string) {
  if (typeof window === "undefined") return;
  const current = load();
  if (!current[id]) return;
  const { [id]: _drop, ...rest } = current;
  commit(rest);
}

/** Completion of a draft, 0–100. */
export function draftCompletion(draft: UploadDraft) {
  const done = draft.files.length + Object.keys(draft.states ?? {}).length;
  const expected = Math.max(draft.expected ?? done, 1);
  return Math.min(100, Math.round((done / expected) * 100));
}

export function useUploadDrafts(): UploadDraft[] {
  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => load(),
    () => EMPTY,
  );
  return Object.values(snapshot).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

/** Fired by the "unfinished uploads" panel to re-open the matching pop-up. */
export const OPEN_UPLOAD_EVENT = "loqal:open-upload";

export function requestOpenUpload(id: string) {
  window.dispatchEvent(new CustomEvent(OPEN_UPLOAD_EVENT, { detail: id }));
}

export function onOpenUpload(id: string, handler: () => void) {
  function listener(e: Event) {
    if ((e as CustomEvent<string>).detail === id) handler();
  }
  window.addEventListener(OPEN_UPLOAD_EVENT, listener);
  return () => window.removeEventListener(OPEN_UPLOAD_EVENT, listener);
}
