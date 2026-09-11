/**
 * Shared review panel for a viewing whose time is still being agreed.
 *
 * The buyer proposes up to three ranked times for a live video tour (or an
 * in-person visit). The agent sees them in priority order together with the
 * buyer's note and either confirms one of them, or replies with alternative
 * times of their own plus a note. The buyer then sees the agent's alternatives
 * in the very same shape and confirms or answers back — the ball is always
 * clearly in one court.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { availableSlots, useBuyerProcess, type CallBooking } from "@/lib/buyer-process";
import { clientDisplayForPartner } from "@/lib/user-id";
import { bookAgentMeeting } from "@/lib/google-calendar.functions";

const RANK = ["Priority 1", "Priority 2", "Priority 3", "Priority 4", "Priority 5"];

export function TourProposalPanel({
  booking,
  side,
  realtorId,
  agentEmail,
}: {
  booking: CallBooking;
  /** Who is looking at the panel. */
  side: "agent" | "buyer";
  /** Whose calendar the alternative times are taken from. */
  realtorId?: string | undefined;
  /** Fallback lookup when the agent connected Google under their e-mail. */
  agentEmail?: string | undefined;
}) {
  const { bookings, confirmProposal, counterPropose } = useBuyerProcess();
  const createMeeting = useServerFn(bookAgentMeeting);
  const [mode, setMode] = useState<"review" | "alternative">("review");
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kindLabel = booking.kind === "video_tour" ? "live video tour" : "in-person visit";
  const proposedBy = booking.proposedBy ?? "buyer";
  const mine = (side === "agent" && proposedBy === "agent") || (side === "buyer" && proposedBy === "buyer");
  const slots = booking.proposedSlots?.length ? booking.proposedSlots : [booking.startAt];
  const theirNote = proposedBy === "agent" ? booking.agentNote : booking.note;
  const days = availableSlots(realtorId, bookings);

  function toggle(startAt: string) {
    setPicked((cur) =>
      cur.includes(startAt) ? cur.filter((s) => s !== startAt) : [...cur, startAt].slice(0, 3),
    );
  }

  /**
   * Confirming a time also creates the real appointment in the agent's Google
   * Calendar. A video tour always gets a Google Meet link, so buyer and agent
   * walk the property together in Meet; an in-person visit is calendar only.
   */
  async function confirm(slot: string) {
    const video = booking.kind === "video_tour";
    setBusy(slot);
    setError(null);
    try {
      const meeting = await createMeeting({
        data: {
          ...(booking.realtorId ?? realtorId ? { agentRef: booking.realtorId ?? realtorId! } : {}),
          ...(agentEmail ? { agentEmail } : {}),
          startAt: slot,
          durationMin: 60,
          summary: video
            ? `Loqal — live video tour: ${booking.propertyLabel}`
            : `Loqal — property visit: ${booking.propertyLabel}`,
          description: video
            ? "Live video walkthrough of the property with your Loqal buyer's agent, on Google Meet."
            : "In-person property visit with your Loqal buyer's agent.",
          ...(booking.clientEmail ? { attendeeEmails: [booking.clientEmail] } : {}),
        },
      });
      confirmProposal(booking.id, slot, {
        ...(meeting.eventId ? { eventId: meeting.eventId } : {}),
        meetUrl: video ? meeting.meetUrl : null,
        calendarLink: meeting.htmlLink,
      });
      toast(video ? "Video tour confirmed" : "Visit confirmed", {
        description: `${formatDateTime(slot)} (1 hour) — ${
          video && meeting.meetUrl
            ? "the Google Meet link is in both calendars."
            : "both calendars are updated."
        }`,
      });
    } catch (err) {
      // Without a connected Google Calendar we still agree the time, but we say
      // plainly that the Meet link is missing so nobody shows up to nothing.
      confirmProposal(booking.id, slot);
      setError(
        video
          ? "The time is agreed, but the Google Meet link could not be created — the agent needs to connect their Google Calendar."
          : "The time is agreed, but it could not be written to Google Calendar.",
      );
      toast(video ? "Time agreed — Meet link pending" : "Time agreed", {
        description:
          err instanceof Error && err.message
            ? err.message
            : "Google Calendar did not accept the appointment.",
      });
    } finally {
      setBusy(null);
    }
  }

  function sendAlternative() {
    if (!picked.length) return;
    counterPropose(booking.id, picked, side === "agent" ? "agent" : "buyer", note.trim());
    setMode("review");
    setPicked([]);
    setNote("");
    toast("Alternative times sent", {
      description: `${picked.length} option(s) proposed — the other side will confirm one.`,
    });
  }

  /* Waiting on the other side: show what was sent, nothing to do. */
  if (mine) {
    return (
      <div className="rounded-lg border border-border bg-background p-4">
        <h4 className="text-sm font-semibold text-foreground">
          Awaiting an answer on the {kindLabel}
        </h4>
        <ol className="mt-2 space-y-1 text-xs text-muted-foreground">
          {slots.map((s, i) => (
            <li key={s}>
              <span className="font-semibold text-foreground">{RANK[i] ?? `Option ${i + 1}`}:</span>{" "}
              {formatDateTime(s)} (1 hour)
            </li>
          ))}
        </ol>
        {theirNote ? (
          <p className="mt-2 rounded-md bg-brand-tint/50 p-2.5 text-[11px] text-muted-foreground">
            Your note: {theirNote}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gold/40 bg-gold-tint/30 p-4">
      <h4 className="text-sm font-semibold text-foreground">
        {proposedBy === "buyer"
          ? `${clientDisplayForPartner(booking.clientName, booking.clientEmail)} proposed times for the ${kindLabel}`
          : `Your agent proposed alternative times for the ${kindLabel}`}
      </h4>
      <p className="mt-1 text-xs text-muted-foreground">
        Confirm one of the times below, or reply with your own options and a note.
      </p>

      <ol className="mt-3 space-y-2">
        {slots.map((s, i) => (
          <li
            key={s}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3"
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-gold">
                {RANK[i] ?? `Option ${i + 1}`}
              </div>
              <div className="text-sm font-semibold text-foreground">{formatDateTime(s)}</div>
              <div className="text-xs text-muted-foreground">1 hour</div>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void confirm(s)}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
            >
              {busy === s
                ? "Booking…"
                : booking.kind === "video_tour"
                  ? "Confirm & create Meet"
                  : "Confirm this time"}
            </button>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2.5 text-[11px] text-destructive">
          {error}
        </p>
      ) : null}

      {theirNote ? (
        <p className="mt-3 rounded-md bg-card p-2.5 text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">
            {proposedBy === "buyer" ? "Buyer's note" : "Agent's note"}:
          </span>{" "}
          {theirNote}
        </p>
      ) : null}

      {mode === "review" ? (
        <button
          type="button"
          onClick={() => setMode("alternative")}
          className="mt-3 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand"
        >
          None of these work — propose other times
        </button>
      ) : (
        <div className="mt-4 rounded-md border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-sm font-semibold text-foreground">Propose your times</h5>
            <span className="text-[11px] text-muted-foreground">
              {picked.length}/3 selected — the order you click is the priority order
            </span>
          </div>

          {picked.length ? (
            <ol className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
              {picked.map((s, i) => (
                <li key={s}>
                  <span className="font-semibold text-foreground">{RANK[i]}:</span>{" "}
                  {formatDateTime(s)}
                </li>
              ))}
            </ol>
          ) : null}

          <div className="mt-3 max-h-56 space-y-3 overflow-y-auto pr-1">
            {days.length ? (
              days.map((d) => (
                <div key={d.day}>
                  <div className="text-[11px] font-semibold text-foreground">{d.label}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {d.slots.map((s) => {
                      const on = picked.includes(s.startAt);
                      return (
                        <button
                          key={s.startAt}
                          type="button"
                          onClick={() => toggle(s.startAt)}
                          className={`rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                            on
                              ? "border-brand bg-brand text-background"
                              : "border-border text-foreground hover:border-brand"
                          }`}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">No free slots in the next two weeks.</p>
            )}
          </div>

          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional) — e.g. why the proposed times do not work"
            className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand"
          />

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("review");
                setPicked([]);
              }}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!picked.length}
              onClick={sendAlternative}
              className="rounded-md bg-brand px-4 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
            >
              Send {picked.length || ""} option{picked.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
