import { useMemo, useState } from "react";
import { availableSlots, useBuyerProcess } from "@/lib/buyer-process";

/**
 * Real-time booking into the assigned realtor's calendar: weekday 1-hour
 * slots for the next two weeks, minus what is already booked. Picking a slot
 * confirms the booking immediately and notifies the agent's calendar.
 */
export function CallScheduler({
  realtorId,
  booked,
  onBook,
  accent = "brand",
}: {
  realtorId?: string | undefined;
  /** ISO start time once a slot is booked through this scheduler. */
  booked?: string | undefined;
  onBook: (startAt: string) => void;
  accent?: "brand" | "success";
}) {
  const { bookings } = useBuyerProcess();
  const days = useMemo(() => availableSlots(realtorId, bookings), [realtorId, bookings]);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);

  const active = days.find((d) => d.day === day) ?? days[0];

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
        (1 hour). The agent is notified and sees it in their calendar.
      </div>
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
        Pick a time — 1 hour, agent's live calendar
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
      <button
        type="button"
        disabled={!slot}
        onClick={() => slot && onBook(slot)}
        className={`mt-3 rounded-md px-4 py-2 text-sm font-semibold text-background disabled:opacity-50 ${
          accent === "success" ? "bg-success hover:opacity-90" : "bg-brand hover:bg-brand-soft"
        }`}
      >
        Book this slot
      </button>
    </div>
  );
}
