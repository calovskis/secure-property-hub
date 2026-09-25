/**
 * Dashboard card: partner state licences waiting for Loqal verification.
 *
 * Mortgage lender and realtor partners submit licence details and copies from
 * their own portal; every submission is unusable until a Loqal admin verifies
 * it (no cases are assigned in an unverified state). This card makes those
 * checks visible on the admin overview; "Verify" opens the verification in a
 * pop-up window instead of sending the admin to a separate page.
 */
import { useState } from "react";
import { formatDateTime } from "@/lib/dates";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { pendingVerifications } from "@/lib/licence-verification";
import { useDeletions } from "@/lib/deletions";
import { LicenceVerificationDialog } from "@/components/admin/LicenceVerificationPanel";

export function LicenceChecksCard() {
  const { requests } = usePartnerRequests();
  const { deleted } = useDeletions();
  const deletedEmails = new Set(deleted.map((r) => r.email.trim().toLowerCase()));
  const [openFor, setOpenFor] = useState<PartnerRequest | null>(null);

  /* One row per partner — a lender can submit dozens of states at once and the
     verification pop-up handles them all together. */
  const items = requests
    .filter((r) => r.status !== "declined" && !deletedEmails.has(r.email.trim().toLowerCase()))
    .map((request) => ({ request, licences: pendingVerifications(request) }))
    .filter((i) => i.licences.length > 0)
    .map((i) => ({
      ...i,
      since: i.licences
        .map((l) => l.pendingSince ?? l.uploadedAt ?? i.request.submittedAt)
        .sort()[0]!,
    }))
    .sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime());

  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-gold/50 bg-gold-tint/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Partner licences to verify</h2>
        <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
          {items.reduce((n, i) => n + i.licences.length, 0)} awaiting verification
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Each partner submitted licence details or a copy. Verify the state to clear them for cases
        there, or ask them for more information — they are notified either way.
      </p>

      <ul className="mt-3 space-y-2">
        {items.map(({ request, licences, since }) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 text-xs">
              <p className="text-sm font-semibold text-foreground">
                {`${request.firstName} ${request.lastName}`.trim()}
                {request.companyName ? ` · ${request.companyName}` : ""} ·{" "}
                {licences.length === 1 ? licences[0]!.state : `${licences.length} states`}
              </p>
              <p className="text-muted-foreground">
                {licences
                  .slice(0, 8)
                  .map((l) => l.state)
                  .join(", ")}
                {licences.length > 8 ? ` and ${licences.length - 8} more` : ""} ·{" "}
                {licences.filter((l) => l.doc).length} with a copy on file
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-gold">
                {licences.some((l) => l.infoRequestedAt)
                  ? "Information requested from the partner"
                  : `Submitted ${formatDateTime(since)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenFor(request)}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
            >
              Review the licences
            </button>
          </li>
        ))}
      </ul>

      {openFor ? (
        <LicenceVerificationDialog
          request={openFor}
          open={Boolean(openFor)}
          onOpenChange={(open) => {
            if (!open) setOpenFor(null);
          }}
        />
      ) : null}
    </section>
  );
}
