/**
 * Self-service profile deletion. The person confirms in writing, loses access
 * immediately, and can have the profile recovered within 90 days.
 */
import { useState } from "react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { daysLeft, useDeletions } from "@/lib/deletions";
import { RECOVERY_DAYS } from "@/lib/roles";

export function DeleteMyAccountCard({
  email,
  name,
  roleLabel,
}: {
  email: string;
  name: string;
  roleLabel: string;
}) {
  const { recordFor, requestDeletion } = useDeletions();
  const record = recordFor(email);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");

  if (record?.status === "deleted") {
    const left = daysLeft(record);
    return (
      <section className="rounded-lg border border-destructive/50 bg-destructive/5 p-6">
        <h2 className="text-base font-semibold text-destructive">Your profile is deleted</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Deleted on {formatDateTime(record.confirmedAt ?? record.requestedAt)}. We keep your
          information for {RECOVERY_DAYS} days, so it can still be recovered until{" "}
          {formatDate(record.recoverableUntil ?? record.requestedAt)} —{" "}
          {left} day{left === 1 ? "" : "s"} left. Write to Loqal and we will bring it back.
        </p>
      </section>
    );
  }

  if (record?.status === "requested") {
    return (
      <section className="rounded-lg border border-gold/50 bg-gold-tint/20 p-6">
        <h2 className="text-base font-semibold text-foreground">Deletion in review</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A deletion of your profile was requested on {formatDateTime(record.requestedAt)} and is
          waiting for a Loqal confirmation.
        </p>
      </section>
    );
  }

  function submit() {
    if (typed.trim().toUpperCase() !== "DELETE") {
      toast("Type DELETE to confirm");
      return;
    }
    requestDeletion({
      email,
      name,
      roleLabel,
      reason: reason.trim() || "Deleted by the account holder",
      requestedBy: name,
      selfRequested: true,
    });
    logActivity(name, "deleted their own profile", email);
    toast("Your profile is deleted", {
      description: `It can still be recovered for ${RECOVERY_DAYS} days.`,
    });
    setOpen(false);
    setReason("");
    setTyped("");
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">Delete my profile</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You can delete your Loqal profile at any time. Access stops right away, and for{" "}
        {RECOVERY_DAYS} days your information is kept so the profile can be recovered if you change
        your mind. After that it is removed for good.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-md border border-destructive/60 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10"
        >
          Delete my profile
        </button>
      ) : (
        <div className="mt-4 space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Why are you leaving? (optional)
            </span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Type DELETE to confirm *
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={submit}
              className="rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
            >
              Delete my profile
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
              }}
              className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground"
            >
              Keep my profile
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
