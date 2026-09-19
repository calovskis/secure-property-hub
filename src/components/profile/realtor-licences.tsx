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
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/form/DateInput";
import { StateCombobox } from "@/components/form/StateCombobox";
import { uid } from "@/lib/mortgage-form";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";

/**
 * The licences on file, seeded from what was declared at registration.
 * `seed` lets other partner types (mortgage lenders) pass the states they
 * declared at registration so those rows show up before anything was edited.
 */
export function licenseDocsOf(
  request: PartnerRequest,
  seed: { state: string; number: string; validUntil: string }[] = [],
): RealtorLicenseDoc[] {
  const stored = request.realtorVerification?.licenseDocs ?? [];
  const declared = request.realtorLicenses ?? [];
  const merged = declared.map((l) => {
    const hit = stored.find((s) => s.state === l.state);
    return hit ?? { state: l.state, number: l.number, validUntil: l.validUntil };
  });
  for (const s of stored) if (!merged.some((m) => m.state === s.state)) merged.push(s);
  for (const s of seed) if (!merged.some((m) => m.state === s.state)) merged.push({ ...s });
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

export type LicenceSeed = { state: string; number: string; validUntil: string };

/** Read/write access to the partner's licences, kept in sync with the seat. */
export function useRealtorLicences(user: LoqalUser, seed: LicenceSeed[] = []) {
  const { requests, updateRequest } = usePartnerRequests();
  const { realtors, updateRealtor } = useRealtors();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const licenses = request ? licenseDocsOf(request, seed) : [];


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
export function LicenceCoverageTable({
  user,
  seed = [],
  hint = "Licence copies are uploaded from the identity & licence verification card.",
  onUploadCopy,
}: {
  user: LoqalUser;
  seed?: LicenceSeed[];
  hint?: string;
  /** When provided, each row shows an "Upload copy" action that calls this. */
  onUploadCopy?: (state: string) => void;
}) {
  const { request, licenses, persist } = useRealtorLicences(user, seed);

  const [edit, setEdit] = useState<EditForm | null>(null);
  const [editState, setEditState] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Save is two-step: Save shows a summary, Confirm persists it. */
  const [confirming, setConfirming] = useState(false);
  const history = request?.realtorVerification?.licenseHistory ?? [];

  function closeEdit() {
    setEdit(null);
    setEditState(null);
    setError(null);
    setConfirming(false);
  }

  function save() {
    if (!edit) return;
    if (!edit.state || !edit.number.trim() || !edit.validUntil)
      return setError("State, licence number and validity date are all required.");
    setError(null);
    if (!confirming) return setConfirming(true);
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
    closeEdit();
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
        <p className="text-xs text-muted-foreground">{hint}</p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
          >
            View history{history.length ? ` (${history.length})` : ""}
          </button>
          {edit === null ? (
            <button
              type="button"
              onClick={() => {
                setEdit({ state: "", number: "", validUntil: "" });
                setEditState(null);
                setError(null);
                setConfirming(false);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
            >
              + Add licence
            </button>
          ) : null}
        </div>
      </div>

      <LicenceHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        history={history}
        licenses={licenses}
      />

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
              {licenses.map((l) =>
                edit !== null && editState === l.state ? (
                  <tr key={l.state} className="border-b border-border/60 last:border-b-0">
                    <td colSpan={5} className="py-3">
                      <LicenceEditPanel
                        edit={edit}
                        setEdit={setEdit}
                        editingState={editState}
                        previous={l}
                        error={error}
                        confirming={confirming}
                        onCancel={closeEdit}
                        onBack={() => setConfirming(false)}
                        onSave={save}
                        onUploadCopy={onUploadCopy}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={l.state} className="border-b border-border/60 last:border-b-0">
                    <td className="py-2 pr-3 font-semibold text-foreground">{l.state}</td>
                    <td className="py-2 pr-3 text-foreground">{l.number}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{formatDate(l.validUntil)}</td>
                    <td className="py-2 pr-3">
                      <VerificationBadge license={l} />
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex gap-2">
                        {onUploadCopy ? (
                          <button
                            type="button"
                            onClick={() => onUploadCopy(l.state)}
                            className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${
                              l.doc && !l.recopyRequestedAt
                                ? "border-border text-muted-foreground hover:text-foreground"
                                : "border-brand/40 bg-brand-tint text-brand hover:bg-brand-tint/70"
                            }`}
                          >
                            {l.doc ? (l.recopyRequestedAt ? "Upload new copy" : "Replace copy") : "Upload copy"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            setEdit({
                              state: l.state,
                              number: l.number,
                              validUntil: l.validUntil,
                            });
                            setEditState(l.state);
                            setError(null);
                            setConfirming(false);
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
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {edit !== null && editState === null ? (
        <div className="mt-4 rounded-md border border-brand/40 bg-brand-tint/30 p-4">
          <LicenceEditPanel
            edit={edit}
            setEdit={setEdit}
            editingState={null}
            previous={undefined}
            error={error}
            confirming={confirming}
            onCancel={closeEdit}
            onBack={() => setConfirming(false)}
            onSave={save}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inline licence editor — shown inside the row being edited (or under the
 * table for a new licence). Saving first shows a short confirmation of what
 * will change; Confirm persists it.
 */
function LicenceEditPanel({
  edit,
  setEdit,
  editingState,
  previous,
  error,
  confirming,
  onCancel,
  onBack,
  onSave,
}: {
  edit: EditForm;
  setEdit: (v: EditForm) => void;
  editingState: string | null;
  previous: RealtorLicenseDoc | undefined;
  error: string | null;
  confirming: boolean;
  onCancel: () => void;
  onBack: () => void;
  onSave: () => void;
}) {
  if (confirming) {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground">
          Confirm {editingState ? `the ${editingState}` : "the new"} licence details
        </h4>
        {previous ? (
          <p className="text-xs text-muted-foreground">
            Before: <span className="line-through">{describeLicence(previous)}</span>
          </p>
        ) : null}
        <p className="text-xs text-foreground">
          After: <span className="font-semibold">{describeLicence(edit)}</span>
        </p>
        <p className="text-[11px] text-muted-foreground">
          {previous &&
          (previous.number !== edit.number.trim() || previous.validUntil !== edit.validUntil)
            ? "The details changed, so a fresh copy of the licence will be required for verification."
            : "No change to the number or validity — the copy on file stays valid."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            Confirm changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-foreground">
        {editingState ? `Adjust the ${editingState} licence` : "New licence"}
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
        Changing the number or the validity date requires a new copy of the licence so Loqal can
        verify the update.
      </p>
      {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
        >
          Save licence
        </button>
      </div>
    </div>
  );
}

const HISTORY_LABEL: Record<RealtorLicenseEvent["action"], string> = {
  added: "Licence added",
  updated: "Details updated",
  removed: "Licence removed",
  copy_uploaded: "Copy uploaded",
};

const HISTORY_TONE: Record<RealtorLicenseEvent["action"], string> = {
  added: "bg-success/10 text-success",
  updated: "bg-brand-tint text-brand",
  removed: "bg-destructive/10 text-destructive",
  copy_uploaded: "bg-gold-tint text-gold",
};

/**
 * Audit trail of the coverage list — every addition, edit, removal and licence
 * copy upload, newest first, with the document attached to that step if one
 * was uploaded.
 */
export function LicenceHistoryDialog({
  open,
  onOpenChange,
  history,
  licenses,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  history: RealtorLicenseEvent[];
  licenses: RealtorLicenseDoc[];
}) {
  function docFor(event: RealtorLicenseEvent) {
    if (event.action === "copy_uploaded") return event.after;
    if (event.action === "removed") return undefined;
    return licenses.find((l) => l.state === event.state)?.doc;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Coverage &amp; licences history</DialogTitle>
          <DialogDescription>
            Every change to your licensed states — additions, edits, removals and the licence
            copies uploaded for verification.
          </DialogDescription>
        </DialogHeader>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No changes recorded yet. Adding, editing or removing a licence — or uploading a copy —
            will show up here.
          </p>
        ) : (
          <ol className="space-y-3">
            {history.map((e) => {
              const doc = docFor(e);
              return (
                <li key={e.id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {e.state}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${HISTORY_TONE[e.action]}`}
                      >
                        {HISTORY_LABEL[e.action]}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(e.at)}
                    </span>
                  </div>
                  {e.before ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Before: <span className="line-through">{e.before}</span>
                    </p>
                  ) : null}
                  {e.after && e.action !== "copy_uploaded" ? (
                    <p className="mt-0.5 text-xs text-foreground">{e.after}</p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">By {e.by}</p>
                  {doc ? (
                    <p className="mt-2 rounded-md bg-muted/40 px-2 py-1 text-[11px] text-foreground">
                      Document: {doc}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
