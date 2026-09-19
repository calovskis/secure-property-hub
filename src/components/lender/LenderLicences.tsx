/**
 * Mortgage lender state licences — the lender equivalent of the realtor
 * "Coverage & licences" segment.
 *
 * The rows are seeded from what the lender declared at registration (the
 * licensed states and the licence number given there), and the lender can
 * correct the details, add new states and upload a copy per state exactly the
 * same way realtor partners do.
 */
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { usePartnerRequests, type RealtorLicenseDoc } from "@/lib/partner-requests";
import {
  LicenceCoverageTable,
  useRealtorLicences,
  type LicenceSeed,
} from "@/components/profile/realtor-licences";
import { LicenceUploadDialog } from "@/components/profile/LicenceUploadDialog";
import { useUploadDrafts } from "@/lib/upload-drafts";

export function LenderLicences() {
  const { user } = useAuth();
  const { requests } = usePartnerRequests();
  const [uploadOpen, setUploadOpen] = useState(false);
  const drafts = useUploadDrafts();
  const draftId = "lender-licences";
  const draft = drafts.find((d) => d.id === draftId);

  const registration = user
    ? requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase())
    : undefined;

  /** States declared at registration, pre-filled with the licence number given there. */
  const seed: LicenceSeed[] = (registration?.states ?? []).map((state) => ({
    state,
    number: registration?.lenderLicence ?? "",
    validUntil: "",
  }));

  const { licenses, persist } = useRealtorLicences(user!, seed);

  if (!user || !registration) return null;

  const missing = licenses.filter((l) => !l.doc);

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
      `uploaded ${Object.keys(copies).length} lender licence copy(ies)`,
      Object.entries(copies).map(([state, doc]) => ({
        state,
        action: "copy_uploaded" as const,
        after: doc,
      })),
    );
    toast("Licence copies submitted", {
      description: `${Object.keys(copies).length} state(s) sent to Loqal for verification.`,
    });
  }

  return (
    <section className="mb-6 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Licences</h2>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
              missing.length ? "bg-gold-tint text-gold" : "bg-success/10 text-success"
            }`}
          >
            {missing.length
              ? `${missing.length} licence copy(ies) missing`
              : "All licence copies on file"}
          </span>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
          >
            {draft ? "Continue licence upload" : "Upload licence copies"}
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        These are the states and licence details you declared when registering with Loqal. Keep the
        numbers and validity dates up to date and add any new state you become licensed in —
        changing a number or a validity date asks for a fresh copy so Loqal can verify it.
      </p>
      {registration.allStates ? (
        <p className="mt-3 rounded-md bg-brand-tint/40 px-3 py-2 text-[11px] font-semibold text-brand">
          Your registration says you work in all states — add each state licence below so inquiries
          can be matched and verified.
        </p>
      ) : null}
      {draft ? (
        <p className="mt-3 text-[11px] font-semibold text-gold">
          {Object.keys(draft.states ?? {}).length} licence copy(ies) pre-saved — continue when you
          are ready.
        </p>
      ) : null}

      <div className="mt-4">
        <LicenceCoverageTable
          user={user}
          seed={seed}
          hint="Licence copies are uploaded with the button above."
        />
      </div>

      <LicenceUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        draftId={draftId}
        licenses={licenses}
        onSubmit={uploadCopies}
      />
    </section>
  );
}
