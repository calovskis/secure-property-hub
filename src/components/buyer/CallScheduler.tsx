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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", year: "numeric" });

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

const dateOf = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

/**
 * Real-time booking into the assigned agent's calendar, shown as a proper
 * month calendar (Mon–Sun) where each date opens that day's free hours.
 *
 * `mode="single"` books one slot immediately (Google Calendar event + Meet
 * link when the agent connected Google). `mode="multi"` lets the buyer
 * propose several prioritised slots so the agent can arrange the visit with
 * the seller.
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
  mode = "single",
  onPropose,
  proposeLabel = "Send my preferred times",
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
  /** "multi" = buyer proposes several prioritised options. */
  mode?: "single" | "multi";
  /** Called with the prioritised ISO slots (priority 1 first) in multi mode. */
  onPropose?: (slots: string[]) => void;
  proposeLabel?: string;
}) {
  const { bookings } = useBuyerProcess();
  const loadAvailability = useServerFn(getAgentAvailability);
  const createMeeting = useServerFn(bookAgentMeeting);

  const fallbackDays = useMemo(
    () => availableSlots(realtorId, bookings, 60),
    [realtorId, bookings],
  );
  const [googleDays, setGoogleDays] = useState<SlotDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  /** Prioritised selection in multi mode — order = priority. */
  const [picks, setPicks] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState<Date | null>(null);

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

  /** Available days indexed by local calendar date. */
  const byDay = useMemo(() => {
    const map = new Map<string, SlotDay>();
    days.forEach((d) => map.set(dayKey(new Date(d.day)), d));
    return map;
  }, [days]);

  const firstDay = days[0] ? new Date(days[0].day) : new Date();
  const lastDay = days.length ? new Date(days[days.length - 1]!.day) : new Date();
  const cursor = monthCursor ?? new Date(firstDay.getFullYear(), firstDay.getMonth(), 1);

  const canPrev = monthKey(cursor) > monthKey(firstDay);
  const canNext = monthKey(cursor) < monthKey(lastDay);

  /** Calendar cells for the visible month, Monday-first. */
  const cells = useMemo(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (start.getDay() + 6) % 7; // Monday = 0
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const out: (Date | null)[] = Array.from({ length: offset }, () => null);
    for (let i = 1; i <= total; i++) out.push(new Date(cursor.getFullYear(), cursor.getMonth(), i));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [cursor]);

  const activeDay = day ? byDay.get(day) : undefined;
  const multi = mode === "multi";

  function togglePick(startAt: string) {
    setPicks((cur) =>
      cur.includes(startAt) ? cur.filter((s) => s !== startAt) : [...cur, startAt],
    );
  }

  async function confirm() {
    if (multi) {
      if (!picks.length) return;
      onPropose?.([...picks]);
      return;
    }
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
        No free slots in the next weeks — the agent will reach out to schedule manually.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {multi ? "Choose your preferred times — 1 hour each" : "Pick a time — 1 hour"},{" "}
        {googleConnected ? "live Google Calendar availability" : "agent's live calendar"}
      </div>

      {multi ? (
        <div className="mt-2 rounded-md border border-brand/30 bg-brand-tint/40 p-3 text-xs leading-relaxed text-muted-foreground">
          <p className="font-semibold text-foreground">
            We recommend selecting at least two options and ranking them.
          </p>
          <p className="mt-1">
            The showing has to be cleared with the seller (or their listing agent), and the
            property is not always available at the first-choice time — tenants in place, the
            owner's own schedule, other confirmed showings or access restrictions can all get in
            the way. Ranked alternatives let your buyer's agent secure a viewing in a single call
            instead of going back and forth, which usually means the walkthrough happens days
            sooner. Your first pick is always requested first.
          </p>
        </div>
      ) : null}

      {/* Month navigation */}
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() =>
            setMonthCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
          }
          className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground disabled:opacity-30 hover:bg-brand-tint"
          aria-label="Previous month"
        >
          ‹
        </button>
        <div className="text-sm font-semibold text-foreground">{monthLabel(cursor)}</div>
        <button
          type="button"
          disabled={!canNext}
          onClick={() =>
            setMonthCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
          }
          className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground disabled:opacity-30 hover:bg-brand-tint"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Month grid */}
      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-[10px] font-semibold uppercase text-muted-foreground">
            {w}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const key = dayKey(date);
          const entry = byDay.get(key);
          const selected = day === key;
          const picked = multi
            ? picks.filter((p) => dayKey(new Date(p)) === key).length
            : slot && dayKey(new Date(slot)) === key
              ? 1
              : 0;
          return (
            <button
              key={key}
              type="button"
              disabled={!entry}
              onClick={() => {
                setDay(key);
                if (!multi) setSlot(null);
              }}
              className={`relative rounded-md py-2 text-xs font-semibold transition-colors ${
                selected
                  ? "bg-brand text-background"
                  : entry
                    ? "border border-border text-foreground hover:bg-brand-tint"
                    : "text-muted-foreground/40"
              }`}
            >
              {date.getDate()}
              {picked ? (
                <span
                  className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${
                    selected ? "bg-background" : "bg-success"
                  }`}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Times of the selected day */}
      {activeDay ? (
        <div className="mt-3">
          <div className="text-xs font-semibold text-foreground">
            {new Date(activeDay.day).toLocaleDateString("en-US", {
              weekday: "long",
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeDay.slots.map((s) => {
              const idx = picks.indexOf(s.startAt);
              const on = multi ? idx >= 0 : slot === s.startAt;
              return (
                <button
                  key={s.startAt}
                  type="button"
                  onClick={() => (multi ? togglePick(s.startAt) : setSlot(s.startAt))}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    on
                      ? "bg-brand text-background"
                      : "border border-border text-foreground hover:bg-brand-tint"
                  }`}
                >
                  {multi && idx >= 0 ? `#${idx + 1} · ` : ""}
                  {s.label || timeOf(s.startAt)}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Select a highlighted date to see the available hours.
        </p>
      )}

      {/* Priority list */}
      {multi && picks.length ? (
        <ol className="mt-3 space-y-1.5">
          {picks.map((p, i) => (
            <li
              key={p}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs"
            >
              <span className="text-foreground">
                <strong className="text-brand">Priority {i + 1}</strong> · {dateOf(p)} at{" "}
                {timeOf(p)}
              </span>
              <span className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() =>
                    setPicks((cur) => {
                      const next = [...cur];
                      const prev = next[i - 1]!;
                      next[i - 1] = next[i]!;
                      next[i] = prev;
                      return next;
                    })
                  }
                  className="rounded border border-border px-1.5 py-0.5 text-muted-foreground disabled:opacity-30 hover:bg-brand-tint"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === picks.length - 1}
                  onClick={() =>
                    setPicks((cur) => {
                      const next = [...cur];
                      const after = next[i + 1]!;
                      next[i + 1] = next[i]!;
                      next[i] = after;
                      return next;
                    })
                  }
                  className="rounded border border-border px-1.5 py-0.5 text-muted-foreground disabled:opacity-30 hover:bg-brand-tint"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setPicks((cur) => cur.filter((x) => x !== p))}
                  className="rounded border border-border px-1.5 py-0.5 text-muted-foreground hover:bg-brand-tint"
                  aria-label="Remove"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      {multi && picks.length === 1 ? (
        <p className="mt-2 text-[11px] text-brand">
          Add at least one more option — it markedly improves the chance the seller can accommodate
          the visit.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        disabled={(multi ? !picks.length : !slot) || saving}
        onClick={() => void confirm()}
        className={`mt-3 rounded-md px-4 py-2 text-sm font-semibold text-background disabled:opacity-50 ${
          accent === "success" ? "bg-success hover:opacity-90" : "bg-brand hover:bg-brand-soft"
        }`}
      >
        {multi ? proposeLabel : saving ? "Creating the Google invite…" : "Book this slot"}
      </button>

      {!multi && googleConnected && withMeet ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          A Google Meet link and calendar invite are sent to you and the agent.
        </p>
      ) : null}
    </div>
  );
}
