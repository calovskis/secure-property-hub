/**
 * Outstanding document requests (identity, visa, bankruptcy discharge, …).
 *
 * Each missing document is tracked as its OWN request/form so the client sees
 * one focused upload form per document under "Unfinished forms" in My Profile.
 * Files chosen but not yet confirmed are pre-saved locally per request, so the
 * client can come back and finish the submission later.
 */
import { useCallback, useEffect, useState } from "react";
import type { LoqalUser, MortgageProfile, StoredDocument } from "@/lib/auth";

export type DocumentRequestKind = "idDocuments" | "visaDocuments" | "bankruptcyDocuments";

export type DocumentRequest = {
  kind: DocumentRequestKind;
  title: string;
  /** Short label used in lists and notifications. */
  label: string;
  description: string;
  /** Why we are asking. */
  reason: string;
};

const DEFINITIONS: Record<DocumentRequestKind, Omit<DocumentRequest, "kind">> = {
  idDocuments: {
    title: "Identity document",
    label: "Driver's licence / green card / passport",
    description:
      "Upload a copy or scan of your driver's licence (front and back), your green card, or your passport.",
    reason: "Required for US citizens, green card and ITIN holders.",
  },
  visaDocuments: {
    title: "US visa / status document",
    label: "Visa copy or scan",
    description:
      "Upload a copy or scan of your US visa or status document so we can verify the status you declared.",
    reason: "You declared an active US visa or status.",
  },
  bankruptcyDocuments: {
    title: "Bankruptcy discharge papers",
    label: "Discharge papers",
    description: "Upload the discharge papers for the bankruptcy you declared.",
    reason: "You answered yes to a bankruptcy in the last 7 years.",
  },
};

const has = (docs?: StoredDocument[]) => Boolean(docs?.length);

/** Every document we asked for and have not received yet, one request each. */
export function outstandingDocumentRequests(
  user: Pick<LoqalUser, "usPerson"> | null | undefined,
  profile: MortgageProfile | null | undefined,
): DocumentRequest[] {
  if (!user || !profile) return [];
  const kinds: DocumentRequestKind[] = [];

  if ((user.usPerson || profile.hasItin) && !has(profile.idDocuments)) kinds.push("idDocuments");
  if (!user.usPerson && profile.usVisaActive && !has(profile.visaDocuments))
    kinds.push("visaDocuments");
  if (profile.declarations?.bankruptcy && !has(profile.bankruptcyDocuments))
    kinds.push("bankruptcyDocuments");

  return kinds.map((kind) => ({ kind, ...DEFINITIONS[kind] }));
}

export const documentRequestDefinition = (kind: DocumentRequestKind): DocumentRequest => ({
  kind,
  ...DEFINITIONS[kind],
});

/* ------------------------- pre-saved (staged) files ------------------------- */

export type StagedDocument = { id: string; name: string; url: string; addedAt: string };

type StagedState = Record<string, StagedDocument[]>;

const STAGED_KEY = "loqal.document.requests.staged.v1";

const stagedKey = (email: string, kind: DocumentRequestKind) =>
  `${email.toLowerCase()}::${kind}`;

function readStaged(): StagedState {
  try {
    const raw = window.localStorage.getItem(STAGED_KEY);
    return raw ? (JSON.parse(raw) as StagedState) : {};
  } catch {
    return {};
  }
}

function writeStaged(next: StagedState) {
  try {
    window.localStorage.setItem(STAGED_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Files the client added to a request but has not confirmed for submission.
 * They stay pre-saved until the request is confirmed or cleared.
 */
export function useStagedDocuments(email: string | undefined, kind: DocumentRequestKind) {
  const [docs, setDocs] = useState<StagedDocument[]>([]);

  useEffect(() => {
    if (!email) return;
    setDocs(readStaged()[stagedKey(email, kind)] ?? []);
  }, [email, kind]);

  const persist = useCallback(
    (next: StagedDocument[]) => {
      setDocs(next);
      if (!email) return;
      const state = readStaged();
      if (next.length) state[stagedKey(email, kind)] = next;
      else delete state[stagedKey(email, kind)];
      writeStaged(state);
    },
    [email, kind],
  );

  const add = useCallback(
    (added: StagedDocument[]) => persist([...docs, ...added]),
    [docs, persist],
  );
  const remove = useCallback(
    (id: string) => persist(docs.filter((d) => d.id !== id)),
    [docs, persist],
  );
  const clear = useCallback(() => persist([]), [persist]);

  return { docs, add, remove, clear };
}

/** Counts of pre-saved files per request kind, for list badges. */
export function stagedCounts(email: string | undefined): Partial<Record<DocumentRequestKind, number>> {
  if (!email || typeof window === "undefined") return {};
  const state = readStaged();
  const out: Partial<Record<DocumentRequestKind, number>> = {};
  for (const kind of ["idDocuments", "visaDocuments", "bankruptcyDocuments"] as const) {
    const count = state[stagedKey(email, kind)]?.length ?? 0;
    if (count) out[kind] = count;
  }
  return out;
}
