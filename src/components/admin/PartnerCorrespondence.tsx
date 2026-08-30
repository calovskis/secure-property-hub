/**
 * Admin-side view of the correspondence Loqal has with one partner: every
 * information request and video call request, with the partner's answer and
 * the files they attached. Used both on the open-requests queue and inside the
 * partner's full profile.
 */
import { useEffect, useState } from "react";
import { UploadedDocLink } from "@/components/profile/UploadedDocLink";
import { formatDateTime } from "@/lib/dates";
import type { PartnerAdminRequest, PartnerRequest } from "@/lib/partner-requests";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function titleOf(item: PartnerAdminRequest) {
  const first = (item.message || "").split("\n")[0]?.trim() ?? "";
  const label = first.length > 70 ? `${first.slice(0, 70)}…` : first;
  return label || (item.kind === "info" ? "Information request" : "Video call request");
}

function isAnswered(a: PartnerAdminRequest) {
  return a.kind === "info" ? Boolean(a.answeredAt) : Boolean(a.scheduledAt);
}

export function PartnerCorrespondence({
  request,
  /** Notification deep link: opens this item's detail straight away. */
  focusItem,
  compact,
}: {
  request: PartnerRequest;
  focusItem?: string | undefined;
  compact?: boolean;
}) {
  const items = request.adminRequests ?? [];
  const [detail, setDetail] = useState<PartnerAdminRequest | null>(null);

  useEffect(() => {
    if (!focusItem) return;
    const found = items.find((i) => i.id === focusItem);
    if (found) setDetail(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusItem, request.id]);

  if (!items.length) {
    return compact ? null : (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        No requests have been sent to this partner yet.
      </p>
    );
  }

  const sorted = [...items].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

  return (
    <>
      <ul className={compact ? "mt-2 space-y-1.5" : "divide-y divide-border rounded-md border border-border"}>
        {sorted.map((a) => {
          const answered = isAnswered(a);
          return (
            <li key={a.id}>
              <button
                type="button"
                onClick={() => setDetail(a)}
                className={`flex w-full flex-wrap items-center justify-between gap-2 text-left ${
                  compact
                    ? "rounded-md border border-border bg-background px-3 py-2 hover:bg-muted/40"
                    : "px-3 py-2.5 hover:bg-muted/40"
                }`}
              >
                <span className="text-xs text-foreground">
                  <span className="font-semibold text-brand">
                    {a.kind === "info" ? "Info requested" : "Video call requested"}
                  </span>{" "}
                  {formatDateTime(a.requestedAt)} — {titleOf(a)}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    answered ? "bg-success/10 text-success" : "bg-gold-tint text-gold"
                  }`}
                >
                  {answered
                    ? a.kind === "info"
                      ? "Answered"
                      : "Booked"
                    : a.kind === "info"
                      ? "Awaiting answer"
                      : "Awaiting booking"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog open={Boolean(detail)} onOpenChange={(o) => (o ? null : setDetail(null))}>
        <DialogContent className="max-w-lg">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {detail.kind === "info" ? "Information request" : "Video call request"}
                </DialogTitle>
                <DialogDescription>
                  {request.firstName} {request.lastName} · {request.companyName} · Sent{" "}
                  {formatDateTime(detail.requestedAt)}
                  {detail.requestedBy ? ` by ${detail.requestedBy}` : ""}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Loqal asked
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{detail.message}</p>
                </div>
                {detail.kind === "info" ? (
                  detail.answeredAt ? (
                    <div className="rounded-md border border-success/40 bg-success/5 p-3">
                      <p className="text-[11px] font-semibold text-success">
                        Partner answered {formatDateTime(detail.answeredAt)}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-foreground">{detail.answer}</p>
                      {detail.answerDocs?.length ? (
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                          {detail.answerDocs.map((d) => (
                            <li key={d}>📎 {d}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-xs text-muted-foreground">No files attached.</p>
                      )}
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                      Awaiting the partner's answer.
                    </p>
                  )
                ) : (
                  <div className="rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-foreground">
                      {detail.scheduledAt
                        ? `Booked for ${formatDateTime(detail.scheduledAt)}`
                        : "Awaiting the partner to book a slot."}
                    </p>
                    {detail.meetUrl ? (
                      <a
                        href={detail.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-semibold text-brand underline"
                      >
                        Join Google Meet
                      </a>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
