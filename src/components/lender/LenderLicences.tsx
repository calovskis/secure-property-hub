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
import { useAuth, type LoqalUser } from "@/lib/auth";
import { usePartnerRequests, type RealtorLicenseDoc } from "@/lib/partner-requests";
import {
  LicenceCoverageTable,
  useRealtorLicences,
  type LicenceSeed,
} from "@/components/profile/realtor-licences";
import { LicenceUploadDialog } from "@/components/profile/LicenceUploadDialog";
import { useUploadDrafts } from "@/lib/upload-drafts";
import { isLicenceVerified, lenderLicenceSeed } from "@/lib/licence-verification";

export function LenderLicences() {
  const { user } = useAuth();
  if (!user) return null;
  return <LenderLicencesInner user={user} />;
}

function LenderLicencesInner({ user }: { user: LoqalUser }) {
  const { requests } = usePartnerRequests();
  const [uploadOpen, setUploadOpen] = useState(false);
  const drafts = useUploadDrafts();
  const draftId = "lender-licences";
  const draft = drafts.find((d) => d.id === draftId);

  const registration = requests.find(
    (r) => r.email.toLowerCase() === user.email.toLowerCase(),
  );

  /**
   * States declared at registration, pre-filled with the state-specific NMLS
   * number and validity given there (falling back to the general NMLS number
   * for older registrations that only had one).
   */
  const seed: LicenceSeed[] = lenderLicenceSeed(registration);

  const { licenses, persist } = useRealtorLicences(user, seed);

  if (!registration) return null;

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
            /* A new copy always goes back to Loqal for verification. */
            pendingSince: at,
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
      description: `${Object.keys(copies).length} state(s) sent to Loqal for verification — you will be notified once verified.`,
    });
  }

  const notCleared = licenses.filter((l) => !isLicenceVerified(l));
  const asked = licenses.filter((l) => l.infoRequestedAt);

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
        changing a number or a validity date asks for a fresh copy so Loqal can verify it. Every
        change and every copy is checked by Loqal before the state is cleared — you are notified as
        soon as it is verified, or if Loqal needs anything else.
      </p>
      {notCleared.length ? (
        <p className="mt-3 rounded-md border border-gold/40 bg-gold-tint/50 px-3 py-2 text-[11px] font-semibold text-gold">
          {notCleared.length} state(s) not cleared by Loqal yet
          {notCleared.length <= 8
            ? `: ${notCleared.map((l) => l.state).join(", ")}`
            : ` — including ${notCleared
                .slice(0, 8)
                .map((l) => l.state)
                .join(", ")} (use the status filters below to see them all)`}
          . No cases are assigned to you in those states until the licence is verified.
        </p>
      ) : null}
      {asked.length ? (
        <div className="mt-3 space-y-2">
          {asked.map((l) => (
            <p
              key={`asked-${l.state}`}
              className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[11px] text-foreground"
            >
              <span className="font-semibold">Loqal needs more on {l.state}:</span>{" "}
              {l.infoRequestNote || "please re-check the details and the copy on file."}
            </p>
          ))}
        </div>
      ) : null}
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
          hint="Attach a copy per state with the row's Upload copy button, or upload several at once above."
          onUploadCopy={() => setUploadOpen(true)}
        />
      </div>

      <LicenceUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        draftId={draftId}
        licenses={licenses}
        onSubmit={uploadCopies}
        ownerEmail={user.email}
      />
    </section>
  );
}
