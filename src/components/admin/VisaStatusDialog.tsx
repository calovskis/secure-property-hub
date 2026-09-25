import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { countryLabel } from "@/data/countries";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  VISA_STATUSES,
  VISA_STATUS_CLIENT_TEXT,
  VISA_STATUS_LABEL,
  useVisaRequests,
  type VisaRequest,
  type VisaStatus,
} from "@/lib/visa-support";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const OPTIONS: VisaStatus[] = [...VISA_STATUSES, "not_possible"];

export function VisaStatusDialog({
  request,
  onClose,
}: {
  request: VisaRequest | undefined;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { update } = useVisaRequests();
  const [status, setStatus] = useState<VisaStatus>("requested");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!request) return;
    setStatus(request.status);
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  if (!request) return null;
  const by = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "Loqal";

  const save = async () => {
    setBusy(true);
    try {
      await update(request, status, by, note.trim() || undefined);
      toast.success(`Status updated — ${request.clientName.split(" ")[0]} can see the progress`);
      onClose();
    } catch {
      toast.error("Could not update the status. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Visa support — {request.clientName}</DialogTitle>
          <DialogDescription>
            Requested {formatDate(request.requestedAt)} · citizenship{" "}
            {countryLabel(request.citizenship ?? "") || "—"} · residence{" "}
            {countryLabel(request.countryOfResidence ?? "") || "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted-foreground">Progress status</div>
          {OPTIONS.map((st) => (
            <label
              key={st}
              className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                status === st ? "border-brand bg-brand-tint/60" : "border-border"
              }`}
            >
              <input
                type="radio"
                className="mt-1"
                checked={status === st}
                onChange={() => setStatus(st)}
              />
              <span>
                <span className="font-semibold text-foreground">{VISA_STATUS_LABEL[st]}</span>
                <span className="block text-xs text-muted-foreground">
                  Client sees: {VISA_STATUS_CLIENT_TEXT[st]}
                </span>
              </span>
            </label>
          ))}
        </div>

        <label className="block text-xs font-medium text-muted-foreground">
          Note for the client (optional)
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="e.g. Appointment on 10/14/2026 at the US Embassy in Riga"
          />
        </label>

        {request.history.length ? (
          <div>
            <div className="mb-1 text-xs font-medium text-muted-foreground">History</div>
            <ul className="space-y-1 text-xs">
              {[...request.history].reverse().map((h, i) => (
                <li key={i} className="flex justify-between gap-3 border-b border-border pb-1">
                  <span className="text-foreground">
                    {VISA_STATUS_LABEL[h.status]}
                    {h.note ? <span className="text-muted-foreground"> — “{h.note}”</span> : null}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {h.by} · {formatDateTime(h.at)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || (status === request.status && !note.trim())}
            onClick={save}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground disabled:opacity-50"
          >
            Update status
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
