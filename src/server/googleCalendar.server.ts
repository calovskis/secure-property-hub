/**
 * Server-only Google Calendar helpers used by the buyer ↔ buyer's agent
 * scheduling flow. Availability comes from the agent's real Google calendar
 * (free/busy) and every booking becomes a Google Calendar event with a
 * Google Meet link, so both sides get the normal Google invite.
 */
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";

export const GATEWAY_BASE_URL = "https://connector-gateway.lovable.dev";
export const GOOGLE_CALENDAR_CONNECTOR = "google_calendar";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

export type Slot = { startAt: string; label: string };
export type SlotDay = { day: string; label: string; slots: Slot[] };

/** Working hours for agent appointments, in the agent's local time. */
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 17;
const SLOT_MINUTES = 60;

async function google(
  connectionAPIKey: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: GOOGLE_CALENDAR_CONNECTOR,
    path,
    init,
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Calendar request failed [${res.status}] ${path}: ${body}`);
    throw new Error(`Google Calendar request failed [${res.status}]: ${body}`);
  }
  return res.json();
}

export async function fetchAccountEmail(connectionAPIKey: string): Promise<string | null> {
  try {
    const data = (await google(connectionAPIKey, "/calendar/v3/calendars/primary")) as {
      id?: string;
    };
    return data.id ?? null;
  } catch {
    return null;
  }
}

type BusyPeriod = { start: string; end: string };

async function fetchBusy(
  connectionAPIKey: string,
  timeMin: string,
  timeMax: string,
): Promise<BusyPeriod[]> {
  const data = (await google(connectionAPIKey, "/calendar/v3/freeBusy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
  })) as { calendars?: Record<string, { busy?: BusyPeriod[] }> };
  return data.calendars?.["primary"]?.busy ?? [];
}

function timeLabel(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dayLabel(d: Date) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  return `${weekday} ${mm}/${dd}/${d.getFullYear()}`;
}

/** Free weekday 1-hour slots over the next `horizonDays`, minus Google busy time. */
export async function buildAvailability(
  connectionAPIKey: string,
  horizonDays = 14,
  maxDays = 10,
): Promise<SlotDay[]> {
  const now = new Date();
  const timeMin = new Date(now.getTime() + 60 * 60 * 1000);
  const timeMax = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const busy = await fetchBusy(connectionAPIKey, timeMin.toISOString(), timeMax.toISOString());
  const busyRanges = busy.map((b) => [
    new Date(b.start).getTime(),
    new Date(b.end).getTime(),
  ]) as [number, number][];

  const days: SlotDay[] = [];
  for (let d = 0; d < horizonDays && days.length < maxDays; d++) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;

    const slots: Slot[] = [];
    for (let h = DAY_START_HOUR; h + SLOT_MINUTES / 60 <= DAY_END_HOUR; h++) {
      const start = new Date(date);
      start.setHours(h, 0, 0, 0);
      const startMs = start.getTime();
      const endMs = startMs + SLOT_MINUTES * 60 * 1000;
      if (startMs <= timeMin.getTime()) continue;
      const overlaps = busyRanges.some(([bs, be]) => startMs < be && endMs > bs);
      if (overlaps) continue;
      slots.push({ startAt: start.toISOString(), label: timeLabel(start) });
    }
    if (slots.length) days.push({ day: date.toISOString(), label: dayLabel(date), slots });
  }
  return days;
}

export type MeetEvent = {
  eventId: string;
  meetUrl: string | null;
  htmlLink: string | null;
  startAt: string;
  endAt: string;
};

export async function createMeetEvent(
  connectionAPIKey: string,
  input: {
    startAt: string;
    durationMin?: number;
    summary: string;
    description?: string;
    location?: string;
    attendeeEmails?: string[];
  },
): Promise<MeetEvent> {
  const start = new Date(input.startAt);
  const end = new Date(start.getTime() + (input.durationMin ?? 60) * 60 * 1000);
  const body = {
    summary: input.summary,
    description: input.description,
    location: input.location,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    attendees: (input.attendeeEmails ?? []).map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: `loqal-${start.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
    reminders: { useDefault: true },
  };

  const data = (await google(
    connectionAPIKey,
    "/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  )) as {
    id: string;
    hangoutLink?: string;
    htmlLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  };

  const meetUrl =
    data.hangoutLink ??
    data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;

  return {
    eventId: data.id,
    meetUrl,
    htmlLink: data.htmlLink ?? null,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export async function updateMeetEvent(
  connectionAPIKey: string,
  eventId: string,
  startAt: string,
  durationMin = 60,
): Promise<MeetEvent> {
  const start = new Date(startAt);
  const end = new Date(start.getTime() + durationMin * 60 * 1000);
  const data = (await google(
    connectionAPIKey,
    `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    },
  )) as { id: string; hangoutLink?: string; htmlLink?: string };
  return {
    eventId: data.id,
    meetUrl: data.hangoutLink ?? null,
    htmlLink: data.htmlLink ?? null,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

export async function cancelMeetEvent(connectionAPIKey: string, eventId: string): Promise<void> {
  const res = await callAsAppUser({
    gatewayBaseUrl: GATEWAY_BASE_URL,
    connectionAPIKey,
    connectorId: GOOGLE_CALENDAR_CONNECTOR,
    path: `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    init: { method: "DELETE" },
  });
  // 410 = already cancelled on Google's side; treat as success.
  if (!res.ok && res.status !== 410) {
    const body = await res.text();
    console.error(`Google Calendar cancel failed [${res.status}]: ${body}`);
    throw new Error(`Google Calendar cancel failed [${res.status}]: ${body}`);
  }
}
