import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { availableSlots, useBuyerProcess } from "@/lib/buyer-process";
import { bookAgentMeeting, getAgentAvailability } from "@/lib/google-calendar.functions";

export type BookedMeeting = {
  eventId: string;
  meetUrl: string | null;
  htmlLink: string | null;
};

type SlotDay = { day: string; label: string; slots: { startAt: string; label: string }[] };

/**
 * Real-time booking into the assigned agent's calendar. When the agent has
 * connected Google Calendar, the slots come from their live free/busy data and
 * the booking is created as a Google Calendar event with a Google Meet link
 * and invites for both sides. Otherwise we fall back to Loqal's own slot grid.
 */
export function CallScheduler({
  realtorId,
  agentEmail,
  booked,
  meetUrl,
  onBook,
  accent = "brand",
  summary = "Loqal — buyer's agent call",
  description,
  attendeeEmails,
  withMeet = true,
}: {
  realtorId?: string | undefined;
  /** Fallback lookup key when the agent connected Google under their e-mail. */
  agentEmail?: string | undefined;
  /** ISO start time once a slot is booked through this scheduler. */
  booked?: string | undefined;
  meetUrl?: string | null | undefined;
  onBook: (startAt: string, meeting?: BookedMeeting) => void;
  accent?: "brand" | "success";
  summary?: string;
  description?: string | undefined;
  attendeeEmails?: string[] | undefined;
  /** Video calls get a Meet link; in-person visits do not need one. */
  withMeet?: boolean;
}) {
  const { bookings } = useBuyerProcess();
  const loadAvailability = useServerFn(getAgentAvailability);
  const createMeeting = useServerFn(bookAgentMeeting);

  const fallbackDays = useMemo(
    () => availableSlots(realtorId, bookings),
    [realtorId, bookings],
  );
  const [googleDays, setGoogleDays] = useState<SlotDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void loadAvailability({
      data: { ...(realtorId ? { agentRef: realtorId } : {}), ...(agentEmail ? { agentEmail } : {}) },
    })
      .then((res) => {
        if (!active) return;
        setGoogleDays(res.connected ? (res.days as SlotDay[]) : null);
      })
      .catch(() => {
        if (active) setGoogleDays(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadAvailability, realtorId, agentEmail]);

  const googleConnected = googleDays !== null;
  const days = googleDays ?? fallbackDays;
  const active = days.find((d) => d.day === day) ?? days[0];

  async function confirm() {
    if (!slot) return;
    if (!googleConnected) {
      onBook(slot);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const meeting = await createMeeting({
        data: {
          ...(realtorId ? { agentRef: realtorId } : {}),
          ...(agentEmail ? { agentEmail } : {}),
          startAt: slot,
          durationMin: 60,
          summary,
          ...(description ? { description } : {}),
          ...(attendeeEmails?.length ? { attendeeEmails } : {}),
        },
      });
      onBook(slot, {
        eventId: meeting.eventId,
        meetUrl: withMeet ? meeting.meetUrl : null,
        htmlLink: meeting.htmlLink,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Google Calendar could not create the appointment.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (booked) {
    return (
      <div className="rounded-md border border-success/40 bg-success/5 p-3 text-sm text-foreground">
        ✓ Call booked —{" "}
        {new Date(booked).toLocaleString("en-US", {
          month: "2-digit",
          day: "2-digit",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        (1 hour). The agent is notified and sees it in their Google Calendar.
        {meetUrl ? (
          <a
            href={meetUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-2 font-semibold text-brand underline-offset-2 hover:underline"
          >
            Join Google Meet
          </a>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return (
      <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        Loading the agent's calendar…
      </p>
    );
  }

  if (!days.length) {
    return (
      <p className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
        No free slots in the next two weeks — the agent will reach out to schedule manually.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Pick a time — 1 hour,{" "}
        {googleConnected ? "live Google Calendar availability" : "agent's live calendar"}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {days.map((d) => (
          <button
            key={d.day}
            type="button"
            onClick={() => {
              setDay(d.day);
              setSlot(null);
            }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
              active?.day === d.day
                ? "bg-brand text-background"
                : "border border-border text-muted-foreground hover:bg-brand-tint"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {active ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {active.slots.map((s) => (
            <button
              key={s.startAt}
              type="button"
              onClick={() => setSlot(s.startAt)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                slot === s.startAt
                  ? "bg-brand text-background"
                  : "border border-border text-foreground hover:bg-brand-tint"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={!slot || saving}
        onClick={() => void confirm()}
        className={`mt-3 rounded-md px-4 py-2 text-sm font-semibold text-background disabled:opacity-50 ${
          accent === "success" ? "bg-success hover:opacity-90" : "bg-brand hover:bg-brand-soft"
        }`}
      >
        {saving ? "Creating the Google invite…" : "Book this slot"}
      </button>
      {googleConnected && withMeet ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          A Google Meet link and calendar invite are sent to you and the agent.
        </p>
      ) : null}
    </div>
  );
}
