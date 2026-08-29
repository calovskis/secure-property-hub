/**
 * Realtor identity & licence verification — the realtor equivalent of the KYB
 * questionnaire (real estate agents are verified as individuals, not as a
 * business structure):
 *
 *   1. one identity document — driver's licence or passport;
 *   2. one licence copy for every state declared at registration.
 *
 * Licence details stay editable afterwards. Whenever a licence number or its
 * validity date changes, the copy on file no longer proves the new data, so it
 * is dropped and Loqal asks for a fresh copy before the state counts again.
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
import { DateInput } from "@/components/form/DateInput";
import { StateCombobox } from "@/components/form/StateCombobox";
import { uid } from "@/lib/mortgage-form";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

const ID_LABEL: Record<string, string> = {
  drivers_license: "Driver's licence",
  passport: "Passport",
};

/** The licences on file, seeded from what was declared at registration. */
function licenseDocsOf(request: PartnerRequest): RealtorLicenseDoc[] {
  const stored = request.realtorVerification?.licenseDocs ?? [];
  const declared = request.realtorLicenses ?? [];
  const merged = declared.map((l) => {
    const hit = stored.find((s) => s.state === l.state);
    return hit ?? { state: l.state, number: l.number, validUntil: l.validUntil };
  });
  for (const s of stored) if (!merged.some((m) => m.state === s.state)) merged.push(s);
  return merged;
}

function describe(l: { number: string; validUntil: string }) {
  return `${l.number} · valid till ${formatDate(l.validUntil)}`;
}

export function RealtorVerificationCard({ user }: { user: LoqalUser }) {
  const { requests, updateRequest } = usePartnerRequests();
  const { realtors, updateRealtor } = useRealtors();
  const [edit, setEdit] = useState<{ state: string; number: string; validUntil: string } | null>(
    null,
  );
  /** State code being edited — null while adding a new licence. */
  const [editState, setEditState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  if (!request) return null;

  const verification = request.realtorVerification;
  const licenses = licenseDocsOf(request);
  const missing = licenses.filter((l) => !l.doc);
  const outstanding = missing.length + (verification?.identityDoc ? 0 : 1);

  function persist(next: RealtorLicenseDoc[], note: string, events: Omit<RealtorLicenseEvent, "id" | "at" | "by">[] = []) {
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

  function saveIdentity(type: "drivers_license" | "passport", doc: string) {
    if (!request || !doc) return;
    updateRequest(request.id, {
      realtorVerification: {
        licenseDocs: request.realtorVerification?.licenseDocs ?? [],
        ...(request.realtorVerification ?? {}),
        identityType: type,
        identityDoc: doc,
        identityUploadedAt: new Date().toISOString(),
      },
    });
    logActivity(fullName(user), "uploaded an identity document", ID_LABEL[type] ?? type);
    toast("Identity document uploaded", { description: "Loqal will verify it shortly." });
  }

  function uploadCopy(state: string, doc: string) {
    const next = licenses.map((l) =>
      l.state === state
        ? (() => {
            const entry: RealtorLicenseDoc = {
              state: l.state,
              number: l.number,
              validUntil: l.validUntil,
              doc,
              uploadedAt: new Date().toISOString(),
            };
            return entry;
          })()
        : l,
    );
    persist(next, `uploaded the ${state} licence copy`, [
      { state, action: "copy_uploaded", after: doc },
    ]);
    toast("Licence copy uploaded", { description: `${state} licence sent for verification.` });
  }

  function saveLicense() {
    if (!edit) return;
    if (!edit.state || !edit.number.trim() || !edit.validUntil)
      return setError("State, licence number and validity date are all required.");
    setError(null);
    const number = edit.number.trim();
    const previous = licenses.find((l) => l.state === editState);
    const changed = !previous || previous.number !== number || previous.validUntil !== edit.validUntil;
    const entry: RealtorLicenseDoc = {
      state: edit.state,
      number,
      validUntil: edit.validUntil,
      ...(changed
        ? { recopyRequestedAt: new Date().toISOString() }
        : {
            ...(previous.doc ? { doc: previous.doc } : {}),
            ...(previous.uploadedAt ? { uploadedAt: previous.uploadedAt } : {}),
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
          ? { state: entry.state, action: "updated", before: describe(previous), after: describe(entry) }
          : { state: entry.state, action: "added", after: describe(entry) },
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

  function removeLicense(l: RealtorLicenseDoc) {
    if (!window.confirm(`Remove the ${l.state} licence from your profile?`)) return;
    persist(
      licenses.filter((x) => x.state !== l.state),
      `removed the ${l.state} licence`,
      [{ state: l.state, action: "removed", before: describe(l) }],
    );
    toast("Licence removed", { description: `${l.state} is no longer part of your coverage.` });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Identity &amp; licence verification</h2>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            outstanding ? "bg-gold-tint text-gold" : "bg-success/10 text-success"
          }`}
        >
          {outstanding ? `${outstanding} document(s) missing` : "All documents on file"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        We verify every Loqal agent personally: one photo ID and a copy of each state licence you
        declared at registration.
      </p>

      {/* Identity document */}
      <div className="mt-5 rounded-lg border border-border bg-background p-4">
        <h3 className="text-sm font-semibold text-foreground">Identity document</h3>
        {verification?.identityDoc ? (
          <div className="mt-2 text-sm text-muted-foreground">
            📎 {verification.identityDoc} ·{" "}
            <span className="text-foreground">
              {ID_LABEL[verification.identityType ?? ""] ?? "Photo ID"}
            </span>
            {verification.identityUploadedAt ? (
              <span className="text-xs"> · uploaded {formatDateTime(verification.identityUploadedAt)}</span>
            ) : null}
            <div className="mt-2">
              <IdentityUpload onPick={saveIdentity} label="Replace document" />
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">
              Upload your driver&apos;s licence or passport.
            </p>
            <IdentityUpload onPick={saveIdentity} label="Upload identity document" />
          </div>
        )}
      </div>

      {/* Licence copies per state */}
      <div className="mt-4 rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">State licences</h3>
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
          <p className="mt-2 text-xs text-muted-foreground">
            No licences declared yet — add the states you are licensed in.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {licenses.map((l) => (
              <li key={l.state} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {l.state} · {l.number}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Valid until {formatDate(l.validUntil)}
                    </div>
                    {l.doc ? (
                      <div className="mt-1 text-xs text-success">
                        📎 {l.doc}
                        {l.uploadedAt ? ` · uploaded ${formatDate(l.uploadedAt)}` : ""}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs font-semibold text-gold">
                        {l.recopyRequestedAt
                          ? "Details changed — a new copy of the licence is required"
                          : "Licence copy not uploaded yet"}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <label className="cursor-pointer rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand">
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          const name = e.target.files?.[0]?.name;
                          if (name) uploadCopy(l.state, name);
                          e.target.value = "";
                        }}
                      />
                      {l.doc ? "Replace copy" : "Upload copy"}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEdit({ state: l.state, number: l.number, validUntil: l.validUntil });
                        setEditState(l.state);
                      }}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint"
                    >
                      Edit details
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLicense(l)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
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
                className={btnGhost}
              >
                Cancel
              </button>
              <button type="button" onClick={saveLicense} className={btnPrimary}>
                Save licence
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function IdentityUpload({
  onPick,
  label,
}: {
  onPick: (type: "drivers_license" | "passport", doc: string) => void;
  label: string;
}) {
  const [type, setType] = useState<"drivers_license" | "passport">("drivers_license");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        value={type}
        onChange={(e) => setType(e.target.value as "drivers_license" | "passport")}
        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="drivers_license">Driver&apos;s licence</option>
        <option value="passport">Passport</option>
      </select>
      <label className="cursor-pointer rounded-md border border-dashed border-border px-3 py-2 text-sm font-semibold text-foreground hover:border-brand">
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            const name = e.target.files?.[0]?.name;
            if (name) onPick(type, name);
            e.target.value = "";
          }}
        />
        {label}
      </label>
    </div>
  );
}
