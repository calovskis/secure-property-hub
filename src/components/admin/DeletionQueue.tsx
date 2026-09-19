/**
 * Deletion queue: profiles requested for deletion (awaiting a confirmation by
 * a second employee), profiles already deleted but still recoverable for 90
 * days, and the closed history.
 */
import { useState } from "react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/dates";
import { logActivity } from "@/lib/activity";
import { daysLeft, useDeletions, type DeletionRecord } from "@/lib/deletions";
import { RECOVERY_DAYS } from "@/lib/roles";

export function DeletionQueue({
  actor,
  canConfirm,
  canRestore,
}: {
  actor: string;
  canConfirm: boolean;
  canRestore: boolean;
}) {
  const { pending, deleted, history, confirmDeletion, cancelRequest, restoreProfile } =
    useDeletions();
  const [confirming, setConfirming] = useState<DeletionRecord | null>(null);

  function doConfirm(r: DeletionRecord) {
    confirmDeletion(r.id, actor);
    logActivity(actor, "confirmed a profile deletion", `${r.name} · ${r.email}`);
    toast("Profile deleted", {
      description: `${r.name} can still be recovered for ${RECOVERY_DAYS} days.`,
    });
    setConfirming(null);
  }

  function doCancel(r: DeletionRecord) {
    cancelRequest(r.id, actor);
    logActivity(actor, "declined a deletion request", `${r.name} · ${r.email}`);
    toast("Deletion request declined", { description: `${r.name} keeps their profile.` });
  }

  function doRestore(r: DeletionRecord) {
    restoreProfile(r.id, actor);
    logActivity(actor, "restored a deleted profile", `${r.name} · ${r.email}`);
    toast("Profile restored", { description: `${r.name} is active again.` });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Deletions awaiting confirmation</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every deletion is requested with a reason and confirmed by a second employee.
            </p>
          </div>
          <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
            {pending.length} waiting
          </span>
        </div>

        {pending.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Nothing waiting for a decision.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pending.map((r) => (
              <li key={r.id} className="rounded-lg border border-gold/40 bg-gold-tint/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {r.name} <span className="text-muted-foreground">· {r.roleLabel}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                    <div className="mt-2 rounded-md border border-border bg-card p-3 text-sm text-foreground">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Reason
                      </span>
                      <div className="mt-1">{r.reason || "—"}</div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Requested by {r.requestedBy} · {formatDateTime(r.requestedAt)}
                    </div>
                  </div>
                  {canConfirm ? (
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirming(r)}
                        className="rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
                      >
                        Confirm deletion
                      </button>
                      <button
                        type="button"
                        onClick={() => doCancel(r)}
                        className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Decline request
                      </button>
                    </div>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      You may not confirm deletions.
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">
          Deleted profiles — recoverable for {RECOVERY_DAYS} days
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Deleted profiles keep their data for {RECOVERY_DAYS} days so nothing is lost by mistake.
          After that they are removed for good.
        </p>
        {deleted.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No deleted profiles.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {deleted.map((r) => {
              const left = daysLeft(r);
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {r.name} <span className="text-muted-foreground">· {r.roleLabel}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {r.selfRequested
                        ? "Deleted by the person themselves"
                        : `Requested by ${r.requestedBy}, confirmed by ${r.confirmedBy}`}{" "}
                      · {formatDateTime(r.confirmedAt ?? r.requestedAt)}
                    </div>
                    {r.reason ? (
                      <div className="mt-1 text-xs italic text-muted-foreground">“{r.reason}”</div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        left > 14
                          ? "bg-brand-tint text-brand"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {left} day{left === 1 ? "" : "s"} left
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Removed for good on {formatDate(r.recoverableUntil ?? r.requestedAt)}
                    </span>
                    {canRestore ? (
                      <button
                        type="button"
                        onClick={() => doRestore(r)}
                        className="rounded-md bg-success px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
                      >
                        Restore profile
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {history.length ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">History</h2>
          <ul className="mt-3 divide-y divide-border">
            {history.map((r) => (
              <li key={r.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-foreground">
                    <strong>{r.name}</strong>{" "}
                    {r.status === "restored" ? "restored" : "deletion request declined"}
                    {r.closedBy ? ` by ${r.closedBy}` : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(r.closedAt ?? r.requestedAt)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {confirming ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm deletion"
          onClick={() => setConfirming(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-foreground">
              Delete {confirming.name}'s profile?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Requested by {confirming.requestedBy}: “{confirming.reason}”
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              The profile loses access immediately and can be restored for {RECOVERY_DAYS} days.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => doConfirm(confirming)}
                className="rounded-md bg-destructive px-4 py-2 text-xs font-semibold text-background hover:opacity-90"
              >
                Yes, delete profile
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
