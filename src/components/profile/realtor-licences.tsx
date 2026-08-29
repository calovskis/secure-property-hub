/**
 * Shared realtor licence logic and the coverage table.
 *
 * The licences on file live on the partner registration; this module keeps the
 * read/write logic in one place so both the verification card (which collects
 * the copies) and the "Coverage & licences" profile segment (which lists and
 * edits them) behave identically.
 */
import { useState } from "react";
import { toast } from "sonner";
import { fullName, type LoqalUser } from "@/lib/auth";
import {
  usePartnerRequests,
  type PartnerRequest,
  type RealtorLicenseDoc,
  type RealtorLicenseEvent,
} from "@/lib/partner-requests";
import { useRealtors } from "@/lib/realtors";
import { logActivity } from "@/lib/activity";
import { formatDate } from "@/lib/dates";
import { DateInput } from "@/components/form/DateInput";
import { StateCombobox } from "@/components/form/StateCombobox";
import { uid } from "@/lib/mortgage-form";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

/** The licences on file, seeded from what was declared at registration. */
export function licenseDocsOf(request: PartnerRequest): RealtorLicenseDoc[] {
  const stored = request.realtorVerification?.licenseDocs ?? [];
  const declared = request.realtorLicenses ?? [];
  const merged = declared.map((l) => {
    const hit = stored.find((s) => s.state === l.state);
    return hit ?? { state: l.state, number: l.number, validUntil: l.validUntil };
  });
  for (const s of stored) if (!merged.some((m) => m.state === s.state)) merged.push(s);
  return merged;
}

export function describeLicence(l: { number: string; validUntil: string }) {
  return `${l.number} · valid till ${formatDate(l.validUntil)}`;
}

export type VerificationState = "verified" | "in_progress" | "missing";

export function verificationState(l: RealtorLicenseDoc): VerificationState {
  if (l.verifiedAt) return "verified";
  if (l.doc) return "in_progress";
  return "missing";
}

const VERIFICATION_LABEL: Record<VerificationState, string> = {
  verified: "Yes — verified",
  in_progress: "In progress",
  missing: "No — copy missing",
};

const VERIFICATION_TONE: Record<VerificationState, string> = {
  verified: "bg-success/10 text-success",
  in_progress: "bg-brand-tint text-brand",
  missing: "bg-gold-tint text-gold",
};

export function VerificationBadge({ license }: { license: RealtorLicenseDoc }) {
  const state = verificationState(license);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${VERIFICATION_TONE[state]}`}
    >
      {VERIFICATION_LABEL[state]}
    </span>
  );
}

/** Read/write access to the realtor's licences, kept in sync with the seat. */
export function useRealtorLicences(user: LoqalUser) {
  const { requests, updateRequest } = usePartnerRequests();
  const { realtors, updateRealtor } = useRealtors();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const licenses = request ? licenseDocsOf(request) : [];

  function persist(
    next: RealtorLicenseDoc[],
    note: string,
    events: Omit<RealtorLicenseEvent, "id" | "at" | "by">[] = [],
  ) {
    if (!request) return;
    const stamped: RealtorLicenseEvent[] = events.map((e) => ({
      ...e,
      id: uid(),
      at: new Date().toISOString(),
      by: fullName(user),
    }));
    updateRequest(request.id, {
      realtorVerification: {
        ...(request.realtorVerification ?? {}),
        licenseDocs: next,
        licenseHistory: [...stamped, ...(request.realtorVerification?.licenseHistory ?? [])],
      },
      realtorLicenses: next.map((l) => ({
        state: l.state,
        number: l.number,
        validUntil: l.validUntil,
      })),
    });
    const seat = realtors.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
    if (seat)
      updateRealtor(seat.id, {
        licenses: next.map((l) => ({
          state: l.state,
          number: l.number,
          validUntil: l.validUntil,
        })),
      });
    logActivity(fullName(user), note, request.companyName);
  }

  return { request, licenses, persist };
}

type EditForm = { state: string; number: string; validUntil: string };

/**
 * Coverage & licences table — one row per state with the licence number, the
 * validity date and whether Loqal verified the copy on file.
 */
export function LicenceCoverageTable({ user }: { user: LoqalUser }) {
  const { licenses, persist } = useRealtorLicences(user);
  const [edit, setEdit] = useState<EditForm | null>(null);
  const [editState, setEditState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!edit) return;
    if (!edit.state || !edit.number.trim() || !edit.validUntil)
      return setError("State, licence number and validity date are all required.");
    setError(null);
    const number = edit.number.trim();
    const previous = licenses.find((l) => l.state === editState);
    const changed =
      !previous || previous.number !== number || previous.validUntil !== edit.validUntil;
    const entry: RealtorLicenseDoc = {
      state: edit.state,
      number,
      validUntil: edit.validUntil,
      ...(changed
        ? { recopyRequestedAt: new Date().toISOString() }
        : {
            ...(previous.doc ? { doc: previous.doc } : {}),
            ...(previous.uploadedAt ? { uploadedAt: previous.uploadedAt } : {}),
            ...(previous.verifiedAt ? { verifiedAt: previous.verifiedAt } : {}),
          }),
    };
    const next = editState
      ? licenses.map((l) => (l.state === editState ? entry : l))
      : [...licenses.filter((l) => l.state !== entry.state), entry];
    persist(
      next,
      editState ? `updated the ${entry.state} licence details` : `added a ${entry.state} licence`,
      [
        previous && editState
          ? {
              state: entry.state,
              action: "updated",
              before: describeLicence(previous),
              after: describeLicence(entry),
            }
          : { state: entry.state, action: "added", after: describeLicence(entry) },
      ],
    );
    setEdit(null);
    setEditState(null);
    toast(changed ? "New licence copy required" : "Licence saved", {
      description: changed
        ? "The details changed, so please upload a fresh copy of the licence."
        : `${entry.state} licence details saved.`,
    });
  }

  function remove(l: RealtorLicenseDoc) {
    if (!window.confirm(`Remove the ${l.state} licence from your profile?`)) return;
    persist(
      licenses.filter((x) => x.state !== l.state),
      `removed the ${l.state} licence`,
      [{ state: l.state, action: "removed", before: describeLicence(l) }],
    );
    toast("Licence removed", { description: `${l.state} is no longer part of your coverage.` });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Licence copies are uploaded from the identity &amp; licence verification card.
        </p>
        {edit === null ? (
          <button
            type="button"
            onClick={() => {
              setEdit({ state: "", number: "", validUntil: "" });
              setEditState(null);
            }}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
          >
            + Add licence
          </button>
        ) : null}
      </div>

      {licenses.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No licences declared yet — add the states you are licensed in.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  State
                </th>
                <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Licence number
                </th>
                <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Valid until
                </th>
                <th className="py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Verified
                </th>
                <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Manage
                </th>
              </tr>
            </thead>
            <tbody>
              {licenses.map((l) => (
                <tr key={l.state} className="border-b border-border/60 last:border-b-0">
                  <td className="py-2 pr-3 font-semibold text-foreground">{l.state}</td>
                  <td className="py-2 pr-3 text-foreground">{l.number}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{formatDate(l.validUntil)}</td>
                  <td className="py-2 pr-3">
                    <VerificationBadge license={l} />
                  </td>
                  <td className="py-2 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEdit({
                            state: l.state,
                            number: l.number,
                            validUntil: l.validUntil,
                          });
                          setEditState(l.state);
                        }}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-tint"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(l)}
                        className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit !== null ? (
        <div className="mt-4 space-y-4 rounded-md border border-brand/40 bg-brand-tint/30 p-4">
          <h4 className="text-sm font-semibold text-foreground">
            {editState ? `Adjust the ${editState} licence` : "New licence"}
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <span className={labelClass}>State</span>
              <StateCombobox
                value={edit.state}
                onChange={(code) => setEdit({ ...edit, state: code })}
              />
            </div>
            <label className="block">
              <span className={labelClass}>Licence number</span>
              <input
                value={edit.number}
                onChange={(e) => setEdit({ ...edit, number: e.target.value })}
                placeholder="e.g. FL-SL-3488210"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Valid until</span>
              <DateInput
                value={edit.validUntil}
                onChange={(v) => setEdit({ ...edit, validUntil: v })}
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Changing the number or the validity date requires a new copy of the licence so Loqal
            can verify the update.
          </p>
          {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setEdit(null);
                setEditState(null);
                setError(null);
              }}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Save licence
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
