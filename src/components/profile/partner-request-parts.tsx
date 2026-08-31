/**
 * Shared building blocks for the two partner-side inboxes on My Profile:
 *  - "Open requests" — everything Loqal asks the partner to provide in writing
 *    and/or with documents (plus its request history).
 *  - "Correspondence with Loqal" — video calls, live/e-mail chats and support
 *    tickets, which are not document-specific.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { fullName, type LoqalUser } from "@/lib/auth";
import type { PartnerAdminRequest } from "@/lib/partner-requests";
import { CallScheduler } from "@/components/buyer/CallScheduler";
import { logActivity } from "@/lib/activity";
import { formatDateTime } from "@/lib/dates";
import { UploadRequestDialog } from "@/components/profile/UploadRequestDialog";
import { UploadedDocLink } from "@/components/profile/UploadedDocLink";
import { useUploadDrafts } from "@/lib/upload-drafts";
import { useDeepLinkAction } from "@/lib/deep-link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const LOQAL_ADMIN_EMAIL = "it@loqal.global";

/** Open = still needs the partner, or is a call that has not happened yet. */
export function isOpenItem(i: PartnerAdminRequest) {
  if (i.kind === "info") return !i.answeredAt;
  if (!i.scheduledAt) return true;
  return new Date(i.scheduledAt).getTime() > Date.now();
}

export function titleOf(item: PartnerAdminRequest) {
  const first = (item.message || "").split("\n")[0]?.trim() ?? "";
  const label = first.length > 70 ? `${first.slice(0, 70)}…` : first;
  return label || (item.kind === "info" ? "Information request" : "Video call request");
}

/** Collapsible list of finished items with a detail pop-up per entry. */
export function HistorySection({
  past,
  label,
  open,
  onToggle,
  onPick,
}: {
  past: PartnerAdminRequest[];
  label: string;
  open: boolean;
  onToggle: () => void;
  onPick: (item: PartnerAdminRequest) => void;
}) {
  if (!past.length) return null;
  return (
    <div className="mt-6 border-t border-border pt-4">
      <button
        type="button"
        onClick={onToggle}
        className="text-xs font-semibold text-brand hover:underline"
      >
        {open ? `Hide ${label.toLowerCase()}` : `${label} (${past.length})`}
      </button>
      {open ? (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {past.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onPick(item)}
                className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/40"
              >
                <span className="text-sm text-foreground">{titleOf(item)}</span>
                <span className="text-[11px] text-muted-foreground">
                  {item.kind === "info" ? "Information request" : "Video call"} ·{" "}
                  {formatDateTime(item.requestedAt)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function HistoryDetailDialog({
  item,
  onClose,
}: {
  item: PartnerAdminRequest | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="max-w-lg">
        {item ? (
          <>
            <DialogHeader>
              <DialogTitle>
                {item.kind === "info" ? "Information request" : "Video call request"}
              </DialogTitle>
              <DialogDescription>Sent {formatDateTime(item.requestedAt)}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Loqal asked
                </p>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{item.message}</p>
              </div>
              {item.kind === "info" ? (
                <div className="rounded-md border border-success/40 bg-success/5 p-3">
                  <p className="text-[11px] font-semibold text-success">
                    You answered {item.answeredAt ? formatDateTime(item.answeredAt) : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-foreground">{item.answer}</p>
                  {item.answerDocs?.length ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {item.answerDocs.map((d) => (
                        <li key={d}>
                          <UploadedDocLink path={d} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">No files attached.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/30 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Call
                  </p>
                  <p className="mt-1 text-foreground">
                    {item.scheduledAt ? `Held ${formatDateTime(item.scheduledAt)}` : "Not booked"}
                  </p>
                  {item.meetUrl ? (
                    <a
                      href={item.meetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-semibold text-brand underline"
                    >
                      Meeting link
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ItemShell({
  item,
  badge,
  children,
}: {
  item: PartnerAdminRequest;
  badge: string;
  children: React.ReactNode;
}) {
  const done = item.kind === "info" ? Boolean(item.answeredAt) : Boolean(item.scheduledAt);
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand">
          {badge}
        </span>
        {done ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Completed
          </span>
        ) : null}
        <span className="text-[11px] text-muted-foreground">
          Sent {formatDateTime(item.requestedAt)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item.message}</p>
      {children}
    </div>
  );
}

export function InfoItem({
  item,
  requestId,
  user,
  onAnswer,
}: {
  item: PartnerAdminRequest;
  requestId: string;
  user: LoqalUser;
  onAnswer: (id: string, changes: Partial<PartnerAdminRequest>) => void;
}) {
  const [open, setOpen] = useState(false);
  const drafts = useUploadDrafts();
  const draftId = `partner-request:${item.id}`;
  const draft = drafts.find((d) => d.id === draftId);

  // A notification about this request opens its answer pop-up directly.
  useDeepLinkAction("request", (focus) => {
    if (!item.answeredAt && (!focus || focus === item.id)) setOpen(true);
  });

  return (
    <ItemShell item={item} badge="Information requested">
      {item.answeredAt ? (
        <div className="mt-3 rounded-md border border-success/40 bg-success/5 p-3">
          <p className="text-xs font-semibold text-success">
            Answered {formatDateTime(item.answeredAt)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.answer}</p>
          {item.answerDocs?.length ? (
            <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
              {item.answerDocs.map((d) => (
                <li key={d}>
                  <UploadedDocLink path={d} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          {draft ? (
            <p className="mb-2 text-[11px] font-semibold text-gold">
              {draft.files.length || 0} file(s) and your answer are pre-saved — not submitted yet.
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            {draft ? "Continue upload" : "Upload"}
          </button>
          <UploadRequestDialog
            open={open}
            onOpenChange={setOpen}
            draftId={draftId}
            label={item.message.slice(0, 60) || "Loqal information request"}
            title="Respond to Loqal"
            description={item.message}
            requireDocument={Boolean(item.requiresDocument)}
            folder={`requests/${requestId}/${item.id}`}
            onSubmit={({ note, files }) => {
              onAnswer(item.id, {
                answer: note,
                answerDocs: files,
                answeredAt: new Date().toISOString(),
              });
              logActivity(fullName(user), "answered a Loqal information request", files.join(", "));
              toast("Sent to Loqal", { description: "Your registration stays in the review queue." });
            }}
          />
        </div>
      )}
    </ItemShell>
  );
}

export function CallItem({
  item,
  user,
  onBooked,
  agentEmail,
}: {
  item: PartnerAdminRequest;
  user: LoqalUser;
  onBooked: (id: string, changes: Partial<PartnerAdminRequest>) => void;
  /** Calendar the slot is booked into — the assigned Loqal manager when known. */
  agentEmail?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // "Loqal asked for a call" notifications open the booking pop-up directly,
  // exactly like information requests do.
  useDeepLinkAction("call", (focus) => {
    if (!item.scheduledAt && (!focus || focus === item.id)) {
      setOpen(true);
      ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });

  return (
    <div ref={ref}>
      <ItemShell item={item} badge="Video call requested">
        {item.scheduledAt ? (
          <div className="mt-3 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
            <p className="font-semibold text-success">Booked for {formatDateTime(item.scheduledAt)}</p>
            {item.meetUrl ? (
              <a
                href={item.meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs font-semibold text-brand underline"
              >
                Join the Google Meet
              </a>
            ) : null}
          </div>
        ) : (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Choose a time
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Book your video call with Loqal</DialogTitle>
                  <DialogDescription className="whitespace-pre-wrap">
                    {item.message || "Pick a slot that suits you."}
                  </DialogDescription>
                </DialogHeader>
                <CallScheduler
                  agentEmail={agentEmail || LOQAL_ADMIN_EMAIL}
                  summary="Loqal — partner registration call"
                  description={item.message}
                  attendeeEmails={[user.email]}
                  onBook={(startAt, meeting) => {
                    onBooked(item.id, { scheduledAt: startAt, meetUrl: meeting?.meetUrl ?? null });
                    logActivity(fullName(user), "booked a video call with Loqal", startAt);
                    toast("Call booked", { description: "Loqal received your slot." });
                    setOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        )}
      </ItemShell>
    </div>
  );
}
