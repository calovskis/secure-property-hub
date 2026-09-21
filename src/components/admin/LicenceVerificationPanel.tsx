/**
 * Loqal verification of a partner's state licences.
 *
 * Every time a mortgage lender (or realtor) partner changes a state licence or
 * uploads a copy, the row lands here for a Loqal admin to check. The admin
 * either confirms the licence — which clears the partner to work in that state
 * — or asks the partner for more information. Both outcomes are sent to the
 * partner as a notification and recorded in the licence history.
 */
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uid } from "@/lib/mortgage-form";
import { formatDate, formatDateTime } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { completeNotifications, notify } from "@/lib/notifications";
import {
  usePartnerRequests,
  type PartnerRequest,
  type RealtorLicenseDoc,
  type RealtorLicenseEvent,
} from "@/lib/partner-requests";
import {
  awaitsVerification,
  isLicenceVerified,
  licenceRows,
} from "@/lib/licence-verification";
import { downloadLicenceFile, getLicenceFile } from "@/lib/licence-files";

function LicenceVerificationBody({ request }: { request: PartnerRequest }) {
  const { updateRequest } = usePartnerRequests();
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const rows = licenceRows(request);
  if (rows.length === 0) return null;

  const pending = rows.filter(awaitsVerification);

  function persist(next: RealtorLicenseDoc[], event: Omit<RealtorLicenseEvent, "id" | "at" | "by">) {
    const stamped: RealtorLicenseEvent = {
      ...event,
      id: uid(),
      at: new Date().toISOString(),
      by: "Loqal admin",
    };
    updateRequest(request.id, {
      realtorVerification: {
        ...(request.realtorVerification ?? {}),
        licenseDocs: next,
        licenseHistory: [stamped, ...(request.realtorVerification?.licenseHistory ?? [])],
      },
    });
  }

  function verify(l: RealtorLicenseDoc) {
    const at = new Date().toISOString();
    const entry: RealtorLicenseDoc = {
      state: l.state,
      number: l.number,
      validUntil: l.validUntil,
      ...(l.doc ? { doc: l.doc } : {}),
      ...(l.uploadedAt ? { uploadedAt: l.uploadedAt } : {}),
      verifiedAt: at,
      verifiedBy: "Loqal admin",
    };
    persist(
      rows.map((r) => (r.state === l.state ? entry : r)),
      {
        state: l.state,
        action: "verified",
        after: `${l.number} · valid till ${formatDate(l.validUntil)}`,
      },
    );
    completeNotifications([`licverif-${request.id}-${l.state}`]);
    notify({
      id: `licok-${request.id}-${l.state}-${at}`,
      to: request.email.toLowerCase(),
      title: `${l.state} licence verified ✅`,
      body: `Loqal verified your ${l.state} licence (${l.number}). You can now be assigned cases in ${l.state}.`,
      href: "/partner?tab=licences",
      severity: "info",
      createdAt: at,
    });
    logActivity("Loqal admin", `verified the ${l.state} licence`, request.companyName);
    toast("Licence verified", { description: `${request.companyName} — ${l.state}` });
  }

  function requestInfo(l: RealtorLicenseDoc) {
    const text = note.trim();
    if (!text) {
      toast("Add a short note", { description: "Tell the partner what is missing." });
      return;
    }
    const at = new Date().toISOString();
    const entry: RealtorLicenseDoc = {
      ...l,
      pendingSince: l.pendingSince ?? at,
      infoRequestedAt: at,
      infoRequestNote: text,
    };
    delete entry.verifiedAt;
    delete entry.verifiedBy;
    persist(
      rows.map((r) => (r.state === l.state ? entry : r)),
      { state: l.state, action: "info_requested", after: text },
    );
    notify({
      id: `licask-${request.id}-${l.state}-${at}`,
      to: request.email.toLowerCase(),
      title: `Loqal needs more on your ${l.state} licence`,
      body: text,
      href: "/partner?tab=licences",
      severity: "warning",
      createdAt: at,
    });
    logActivity("Loqal admin", `asked for more information on the ${l.state} licence`, request.companyName);
    setNoteFor(null);
    setNote("");
    toast("Information requested", { description: `${request.companyName} — ${l.state}` });
  }

  return (
    <div className="mt-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">State licence verification</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            pending.length ? "bg-gold-tint text-gold" : "bg-success/10 text-success"
          }`}
        >
          {pending.length ? `${pending.length} awaiting verification` : "Nothing to verify"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Unverified states are not used for case assignment — the partner cannot work there until
        Loqal confirms the licence.
      </p>

      <ul className="mt-3 space-y-2">
        {rows.map((l) => {
          const verified = isLicenceVerified(l);
          return (
            <li key={l.state} className="rounded-md border border-border bg-card p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-xs">
                  <p className="text-sm font-semibold text-foreground">
                    {l.state} · {l.number}
                  </p>
                  <p className="text-muted-foreground">
                    Valid till {formatDate(l.validUntil)} ·{" "}
                    {l.doc
                      ? `copy on file${l.uploadedAt ? ` (${formatDateTime(l.uploadedAt)})` : ""}: ${l.doc}`
                      : "no copy uploaded yet"}
                  </p>
                  {verified ? (
                    <p className="mt-1 font-semibold text-success">
                      Verified {l.verifiedAt ? formatDateTime(l.verifiedAt) : ""}
                      {l.verifiedBy ? ` by ${l.verifiedBy}` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 font-semibold text-gold">
                      {l.infoRequestedAt
                        ? `Information requested — ${l.infoRequestNote ?? ""}`
                        : l.doc
                          ? "Submitted — awaiting your verification"
                          : "Waiting for the partner's copy"}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {l.doc ? (
                    getLicenceFile(request.email, l.state) ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!downloadLicenceFile(request.email, l.state))
                            toast("Copy unavailable", {
                              description: "Ask the partner to re-upload the licence copy.",
                            });
                        }}
                        className="rounded-md border border-brand px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint"
                      >
                        ⬇ Download copy
                      </button>
                    ) : (
                      <span className="self-center text-[11px] font-semibold text-muted-foreground">
                        Copy not downloadable — ask for a re-upload
                      </span>
                    )
                  ) : null}
                  {!verified ? (
                    <button
                      type="button"
                      onClick={() => verify(l)}
                      className="rounded-md bg-success px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
                    >
                      Verify &amp; clear state
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setNoteFor(noteFor === l.state ? null : l.state);
                      setNote("");
                    }}
                    className={`rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-brand-tint ${
                      verified ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    Request information
                  </button>
                </div>
              </div>
              {noteFor === l.state ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    placeholder={`What does the partner have to clarify or re-upload for ${l.state}?`}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => requestInfo(l)}
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
                    >
                      Send request
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteFor(null)}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Inline panel (kept for compatibility) — renders the same body. */
export function LicenceVerificationPanel({ request }: { request: PartnerRequest }) {
  return <LicenceVerificationBody request={request} />;
}

/**
 * Pop-up version of the licence verification: opened from the admin
 * dashboard card and from the partner profile, so the profile page itself
 * stays compact.
 */
export function LicenceVerificationDialog({
  request,
  open,
  onOpenChange,
}: {
  request: PartnerRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const name = request.companyName || `${request.firstName} ${request.lastName}`;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>State licence verification — {name}</DialogTitle>
        </DialogHeader>
        <LicenceVerificationBody request={request} />
      </DialogContent>
    </Dialog>
  );
}
