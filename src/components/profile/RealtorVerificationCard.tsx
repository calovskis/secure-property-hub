/**
 * Realtor identity & licence verification — the realtor equivalent of the KYB
 * questionnaire (real estate agents are verified as individuals, not as a
 * business structure):
 *
 *   1. one identity document — driver's licence or passport;
 *   2. one licence copy for every state declared at registration.
 *
 * The states themselves are only listed inside the upload pop-up; the profile
 * page shows a single progress line. Licence details are edited in the
 * "Coverage & licences" segment of the profile.
 */
import { useState } from "react";
import { toast } from "sonner";
import { fullName, type LoqalUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { usePartnerRequests } from "@/lib/partner-requests";
import { LicenceUploadDialog } from "@/components/profile/LicenceUploadDialog";
import { UploadRequestDialog } from "@/components/profile/UploadRequestDialog";
import { useUploadDrafts } from "@/lib/upload-drafts";
import { useRealtorLicences } from "@/components/profile/realtor-licences";
import type { RealtorLicenseDoc } from "@/lib/partner-requests";

const HISTORY_LABEL: Record<string, string> = {
  added: "Licence added",
  updated: "Details updated",
  removed: "Licence removed",
  copy_uploaded: "Copy uploaded",
};

const ID_LABEL: Record<string, string> = {
  drivers_license: "Driver's licence",
  passport: "Passport",
};

export function RealtorVerificationCard({ user }: { user: LoqalUser }) {
  const { updateRequest } = usePartnerRequests();
  const { request, licenses, persist } = useRealtorLicences(user);
  const [showHistory, setShowHistory] = useState(false);
  const [licDialog, setLicDialog] = useState(false);
  const [idDialog, setIdDialog] = useState(false);
  const drafts = useUploadDrafts();
  const licDraftId = "realtor-licences";
  const licDraft = drafts.find((d) => d.id === licDraftId);
  const idDraft = drafts.find((d) => d.id === "realtor-identity");

  if (!request) return null;

  const verification = request.realtorVerification;
  const missing = licenses.filter((l) => !l.doc);
  const history = verification?.licenseHistory ?? [];
  const outstanding = missing.length + (verification?.identityDoc ? 0 : 1);

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

  /** Applies every copy staged in the pop-up in one go. */
  function uploadCopies(copies: Record<string, string>) {
    const at = new Date().toISOString();
    const next = licenses.map((l) =>
      copies[l.state]
        ? ({
            state: l.state,
            number: l.number,
            validUntil: l.validUntil,
            doc: copies[l.state]!,
            uploadedAt: at,
          } as RealtorLicenseDoc)
        : l,
    );
    persist(
      next,
      `uploaded ${Object.keys(copies).length} licence copy(ies)`,
      Object.entries(copies).map(([state, doc]) => ({
        state,
        action: "copy_uploaded" as const,
        after: doc,
      })),
    );
    toast("Licence copies submitted", {
      description: `${Object.keys(copies).length} state(s) sent for verification.`,
    });
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
              <IdentityUpload onPick={saveIdentity} label="Replace document" open={idDialog} setOpen={setIdDialog} hasDraft={Boolean(idDraft)} />
            </div>
          </div>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-muted-foreground">
              Upload your driver&apos;s licence or passport.
            </p>
            <IdentityUpload onPick={saveIdentity} label="Upload" open={idDialog} setOpen={setIdDialog} hasDraft={Boolean(idDraft)} />
          </div>
        )}
      </div>

      {/* Licence copies — the state list lives inside the pop-up */}
      <div className="mt-4 rounded-lg border border-border bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">State licence copies</h3>
          <button
            type="button"
            onClick={() => setLicDialog(true)}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
          >
            {licDraft ? "Continue licence upload" : "Upload licence copies"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {licenses.length
            ? `${licenses.length - missing.length} of ${licenses.length} licence copies on file — the full list of states opens inside the upload window.`
            : "No licences declared yet — add them under “Coverage & licences”."}
        </p>
        {licDraft ? (
          <p className="mt-2 text-[11px] font-semibold text-gold">
            {Object.keys(licDraft.states ?? {}).length} licence copy(ies) pre-saved — continue when
            you are ready.
          </p>
        ) : null}
        {missing.length ? (
          <p className="mt-3 rounded-md bg-gold-tint/40 px-3 py-2 text-[11px] font-semibold text-gold">
            {missing.length} state(s) still need a licence copy.
          </p>
        ) : null}

        <LicenceUploadDialog
          open={licDialog}
          onOpenChange={setLicDialog}
          draftId={licDraftId}
          licenses={licenses}
          onSubmit={uploadCopies}
        />

        <div className="mt-4 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-semibold text-brand hover:underline"
          >
            {showHistory ? "Hide licence history" : `Show licence history (${history.length})`}
          </button>
          {showHistory ? (
            history.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                No changes yet — the licences shown are the ones declared at registration.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {history.map((h) => (
                  <li key={h.id} className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{h.state}</span> ·{" "}
                    <span className="font-semibold text-brand">{HISTORY_LABEL[h.action]}</span> ·{" "}
                    {formatDateTime(h.at)} by {h.by}
                    {h.before || h.after ? (
                      <span>
                        {" "}
                        — {h.before ? h.before : ""}
                        {h.before && h.after ? " → " : ""}
                        {h.after ? h.after : ""}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </div>
      </div>
    </section>
  );
}

function IdentityUpload({
  onPick,
  label,
  open,
  setOpen,
  hasDraft,
}: {
  onPick: (type: "drivers_license" | "passport", doc: string) => void;
  label: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  hasDraft: boolean;
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
      >
        {hasDraft ? "Continue upload" : label}
      </button>
      <UploadRequestDialog
        open={open}
        onOpenChange={setOpen}
        draftId="realtor-identity"
        label="Identity document"
        title="Upload your identity document"
        description="Attach a clear photo or scan of your driver's licence or passport. You can change or delete the file before submitting."
        requireDocument
        askNote={false}
        onSubmit={({ files }) => {
          const doc = files[0];
          if (doc) onPick(type, doc);
        }}
      />
    </div>
  );
}
