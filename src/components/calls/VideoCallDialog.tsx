import { CalendarPlus, Clock, Copy, User, Video } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/dates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "Video call with Loqal" / "Live video tour". */
  title: string;
  /** ISO start time. */
  startAt: string;
  /** Google Meet link, when one was created. */
  meetUrl?: string | null;
  /** Who the call is with (loan officer, Loqal manager, realtor…). */
  withLabel?: string;
  /** Extra context (property, company, reference). */
  contextLabel?: string;
  durationMinutes?: number;
};

/** "Add to Google Calendar" template link — same flow Google Meet uses. */
function googleCalendarUrl(opts: {
  title: string;
  startAt: string;
  durationMinutes: number;
  meetUrl?: string | null;
  details: string;
}) {
  const start = new Date(opts.startAt);
  const end = new Date(start.getTime() + opts.durationMinutes * 60 * 1000);
  const stamp = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: opts.details,
  });
  if (opts.meetUrl) params.set("location", opts.meetUrl);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Pop-up with the key facts of a booked video call — opened straight from a
 * "video call booked" notification anywhere in the platform. Mirrors how
 * Google Meet presents a call: time, duration, participants and a join link.
 */
export function VideoCallDialog({
  open,
  onOpenChange,
  title,
  startAt,
  meetUrl,
  withLabel,
  contextLabel,
  durationMinutes = 60,
}: Props) {
  const details = [
    withLabel ? `With: ${withLabel}` : "",
    contextLabel ?? "",
    meetUrl ? `Join: ${meetUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-tint text-brand">
              <Video className="h-4 w-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>
            Your video call is booked. Join from the link below when it starts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {formatDateTime(startAt)}
            </div>
            <p className="mt-1 pl-6 text-xs text-muted-foreground">
              {durationMinutes} minutes · your local time
            </p>
            {withLabel ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-foreground">
                <User className="h-4 w-4 text-muted-foreground" />
                {withLabel}
              </div>
            ) : null}
            {contextLabel ? (
              <p className="mt-1 pl-6 text-xs text-muted-foreground">{contextLabel}</p>
            ) : null}
          </div>

          {meetUrl ? (
            <div className="rounded-lg border border-brand-soft bg-brand-tint/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">
                Google Meet link
              </p>
              <div className="mt-1 flex items-center gap-2">
                <a
                  href={meetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm font-medium text-brand underline underline-offset-2"
                >
                  {meetUrl}
                </a>
                <button
                  type="button"
                  aria-label="Copy meeting link"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() => {
                    void navigator.clipboard?.writeText(meetUrl).then(
                      () => toast.success("Meeting link copied"),
                      () => toast.error("Could not copy the link"),
                    );
                  }}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <Button asChild className="mt-3 w-full">
                <a href={meetUrl} target="_blank" rel="noreferrer">
                  <Video className="mr-2 h-4 w-4" /> Join with Google Meet
                </a>
              </Button>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
              The Google Meet link appears here as soon as the calendar event is created.
            </p>
          )}

          <Button asChild variant="outline" className="w-full">
            <a
              href={googleCalendarUrl({ title, startAt, durationMinutes, meetUrl, details })}
              target="_blank"
              rel="noreferrer"
            >
              <CalendarPlus className="mr-2 h-4 w-4" /> Add to Google Calendar
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
