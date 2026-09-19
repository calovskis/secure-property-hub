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
import { formatDate, formatDateTime } from "@/lib/dates";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { pendingVerifications } from "@/lib/licence-verification";
import { useDeletions } from "@/lib/deletions";
import { LicenceVerificationDialog } from "@/components/admin/LicenceVerificationPanel";

export function LicenceChecksCard() {
  const { requests } = usePartnerRequests();
  const { deleted } = useDeletions();
  const deletedEmails = new Set(deleted.map((r) => r.email.trim().toLowerCase()));
  const [openFor, setOpenFor] = useState<PartnerRequest | null>(null);

  const items = requests
    .filter((r) => r.status !== "declined" && !deletedEmails.has(r.email.trim().toLowerCase()))
    .flatMap((r) => pendingVerifications(r).map((licence) => ({ request: r, licence })))
    .sort(
      (a, b) =>
        new Date(a.licence.pendingSince ?? a.licence.uploadedAt ?? 0).getTime() -
        new Date(b.licence.pendingSince ?? b.licence.uploadedAt ?? 0).getTime(),
    );

  if (items.length === 0) return null;

  return (
    <section className="rounded-xl border border-gold/50 bg-gold-tint/40 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">Partner licences to verify</h2>
        <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
          {items.length} awaiting verification
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Each partner submitted licence details or a copy. Verify the state to clear them for cases
        there, or ask them for more information — they are notified either way.
      </p>

      <ul className="mt-3 space-y-2">
        {items.map(({ request, licence }) => (
          <li
            key={`${request.id}-${licence.state}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div className="min-w-0 text-xs">
              <p className="text-sm font-semibold text-foreground">
                {request.companyName || `${request.firstName} ${request.lastName}`} · {licence.state}
              </p>
              <p className="text-muted-foreground">
                Licence {licence.number || "—"}
                {licence.validUntil ? ` · valid till ${formatDate(licence.validUntil)}` : ""} ·{" "}
                {licence.doc ? "copy on file" : "no copy uploaded yet"}
              </p>
              <p className="mt-0.5 text-[11px] font-semibold text-gold">
                {licence.infoRequestedAt
                  ? "Information requested from the partner"
                  : `Submitted ${
                      licence.pendingSince || licence.uploadedAt
                        ? formatDateTime((licence.pendingSince ?? licence.uploadedAt)!)
                        : ""
                    }`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenFor(request)}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
            >
              Verify {licence.state}
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
