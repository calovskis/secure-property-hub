/**
 * Deletion controls inside an admin profile view. Requesting and confirming are
 * separate permissions, so the strip shows only what this employee may do and
 * always states where the profile stands.
 */
import { useState } from "react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { daysLeft, useDeletions } from "@/lib/deletions";
import { RECOVERY_DAYS, type Permission } from "@/lib/roles";

export function DeleteAccountControls({
  email,
  name,
  roleLabel,
  actor,
  can,
}: {
  email: string;
  name: string;
  roleLabel: string;
  actor: string;
  can: (p: Permission) => boolean;
}) {
  const { recordFor, requestDeletion, confirmDeletion, cancelRequest, restoreProfile } =
    useDeletions();
  const record = recordFor(email);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const mayRequest = can("users.delete.request");
  const mayConfirm = can("users.delete.confirm");
  const mayRestore = can("users.restore");

  if (!record && !mayRequest && !mayConfirm) return null;

  function submit() {
    if (reason.trim().length < 10) {
      toast("Please give a reason", { description: "At least a short sentence, for the record." });
      return;
    }
    requestDeletion({ email, name, roleLabel, reason, requestedBy: actor });
    logActivity(actor, "requested a profile deletion", `${name} · ${reason.trim()}`);
    toast(
      mayConfirm ? "Deletion requested — you can confirm it now" : "Deletion requested",
      { description: "A second employee has to confirm before the profile is deleted." },
    );
    setReason("");
    setOpen(false);
  }

  if (record?.status === "deleted") {
    const left = daysLeft(record);
    return (
      <div className="mb-5 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <h3 className="text-sm font-semibold text-destructive">This profile is deleted</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {record.selfRequested
            ? "Deleted by the person themselves"
            : `Requested by ${record.requestedBy}, confirmed by ${record.confirmedBy}`}{" "}
          · {formatDateTime(record.confirmedAt ?? record.requestedAt)} · recoverable for {left} more
          day{left === 1 ? "" : "s"} (until {formatDate(record.recoverableUntil ?? record.requestedAt)}
          ).
        </p>
        {mayRestore ? (
          <button
            type="button"
            onClick={() => {
              restoreProfile(record.id, actor);
              logActivity(actor, "restored a deleted profile", `${name} · ${email}`);
              toast("Profile restored");
            }}
            className="mt-3 rounded-md bg-success px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
          >
            Restore profile
          </button>
        ) : null}
      </div>
    );
  }

  if (record?.status === "requested") {
    return (
      <div className="mb-5 rounded-lg border border-gold/50 bg-gold-tint/20 p-4">
        <h3 className="text-sm font-semibold text-foreground">Deletion requested</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          By {record.requestedBy} · {formatDateTime(record.requestedAt)}
        </p>
        <p className="mt-2 text-sm text-foreground">“{record.reason}”</p>
        {mayConfirm ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                confirmDeletion(record.id, actor);
                logActivity(actor, "confirmed a profile deletion", `${name} · ${email}`);
                toast("Profile deleted", {
                  description: `Recoverable for ${RECOVERY_DAYS} days.`,
                });
              }}
              className="rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
            >
              Confirm deletion
            </button>
            <button
              type="button"
              onClick={() => {
                cancelRequest(record.id, actor);
                logActivity(actor, "declined a deletion request", `${name} · ${email}`);
                toast("Request declined");
              }}
              className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Decline request
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Waiting for an employee who may confirm deletions.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-lg border border-border bg-background p-4">
      {!open ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Deleting a profile takes two steps: a request with a reason, then a confirmation by a
            colleague. Deleted profiles stay recoverable for {RECOVERY_DAYS} days.
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 rounded-md border border-destructive/60 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
          >
            Request deletion
          </button>
        </div>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-foreground">Request deletion of {name}</h3>
          <label className="mt-2 block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Reason for deletion *
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why should this profile be deleted?"
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submit}
              className="rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
            >
              Submit request
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setReason("");
              }}
              className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
