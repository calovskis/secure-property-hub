/**
 * Communication line on Loqal support cases (visa support, company set-up).
 * Stored in the database so Loqal staff and the client see the same thread on
 * any device. Loqal can send messages, written information requests (with
 * uploads) and call requests (proposed time slots); the client replies.
 */
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CaseKind = "visa" | "entity";
export type CaseMessageKind = "message" | "info_request" | "call_request" | "reply";

export type CaseMessage = {
  id: string;
  caseKind: CaseKind;
  caseId: string;
  clientUserId: string;
  authorName: string;
  fromLoqal: boolean;
  kind: CaseMessageKind;
  body: string;
  attachments: string[];
  callSlots: string[];
  chosenSlot: string | null;
  replyTo: string | null;
  answeredAt: string | null;
  createdAt: string;
};

const BUCKET = "case-files";

/* eslint-disable @typescript-eslint/no-explicit-any */
const table = () => (supabase as any).from("case_messages");

function map(r: any): CaseMessage {
  return {
    id: r.id,
    caseKind: r.case_kind,
    caseId: r.case_id,
    clientUserId: r.client_user_id,
    authorName: r.author_name,
    fromLoqal: r.from_loqal,
    kind: r.kind,
    body: r.body,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
    callSlots: Array.isArray(r.call_slots) ? r.call_slots : [],
    chosenSlot: r.chosen_slot,
    replyTo: r.reply_to,
    answeredAt: r.answered_at,
    createdAt: r.created_at,
  };
}

let items: CaseMessage[] = [];
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function refreshCaseMessages() {
  const { data, error } = await table().select("*").order("created_at", { ascending: true });
  if (error) return;
  items = (data ?? []).map(map);
  loaded = true;
  emit();
}

let timer: ReturnType<typeof setInterval> | null = null;
export function useCaseMessages(kind?: CaseKind, caseId?: string) {
  const all = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
  useEffect(() => {
    if (!loaded) void refreshCaseMessages();
    if (!timer) timer = setInterval(() => void refreshCaseMessages(), 30_000);
  }, []);
  const messages = kind && caseId ? all.filter((m) => m.caseKind === kind && m.caseId === caseId) : all;
  return { messages, all };
}

/** Open Loqal requests awaiting the client's answer. */
export const pendingForClient = (msgs: CaseMessage[]) =>
  msgs.filter((m) => m.fromLoqal && (m.kind === "info_request" || m.kind === "call_request") && !m.answeredAt);

/** Client replies Loqal has not yet seen acted on (latest message is from the client). */
export const awaitingLoqal = (msgs: CaseMessage[]) => {
  const last = msgs[msgs.length - 1];
  return !!last && !last.fromLoqal;
};

export async function uploadCaseFile(clientUserId: string, caseId: string, file: File) {
  const path = `${clientUserId}/${caseId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  return path;
}

export async function openCaseFile(path: string) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw error ?? new Error("No url");
  window.open(data.signedUrl, "_blank", "noopener");
}

export const caseFileName = (path: string) => (path.split("/").pop() ?? path).replace(/^[0-9a-f-]{36}-/i, "");

export function useSendCaseMessage() {
  return useCallback(
    async (input: {
      caseKind: CaseKind;
      caseId: string;
      clientUserId: string;
      authorName: string;
      fromLoqal: boolean;
      kind: CaseMessageKind;
      body: string;
      attachments?: string[];
      callSlots?: string[];
      replyTo?: string;
      chosenSlot?: string;
    }) => {
      const { error } = await table().insert({
        case_kind: input.caseKind,
        case_id: input.caseId,
        client_user_id: input.clientUserId,
        author_name: input.authorName,
        from_loqal: input.fromLoqal,
        kind: input.kind,
        body: input.body,
        attachments: input.attachments ?? [],
        call_slots: input.callSlots ?? [],
        reply_to: input.replyTo ?? null,
        chosen_slot: input.chosenSlot ?? null,
      });
      if (error) throw error;
      if (input.replyTo) {
        await table()
          .update({ answered_at: new Date().toISOString(), ...(input.chosenSlot ? { chosen_slot: input.chosenSlot } : {}) })
          .eq("id", input.replyTo);
      }
      await refreshCaseMessages();
    },
    [],
  );
}
