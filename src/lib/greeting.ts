import { useEffect, useState } from "react";

/**
 * Personal greeting for the signed-in dashboards.
 *
 * The wording changes with the local time of day, how long it has been since
 * the person's previous visit, and — occasionally — the country they are
 * logging in from (a local "Ciao" / "Guten Tag" when the timezone says so).
 * Only the first name is ever used; never a role or filler word.
 */

const STORAGE_KEY = "loqal.greeting.v1";

type Visit = { last: number; previous?: number };

function readVisits(): Record<string, Visit> {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, Visit>;
  } catch {
    return {};
  }
}

/** Records this visit and returns the timestamp of the previous one, if any. */
export function markVisit(email: string): number | undefined {
  if (typeof window === "undefined" || !email) return undefined;
  const key = email.toLowerCase();
  const all = readVisits();
  const now = Date.now();
  const entry = all[key];
  // Treat anything within 20 minutes as the same visit.
  const previous = entry && now - entry.last > 20 * 60 * 1000 ? entry.last : entry?.previous;
  all[key] = { last: now, ...(previous ? { previous } : {}) };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
  return entry?.last;
}

/** Local-language hellos keyed by the country part of the browser timezone. */
const LOCAL_HELLO: Record<string, string> = {
  "Europe/Rome": "Ciao",
  "Europe/Paris": "Bonjour",
  "Europe/Brussels": "Bonjour",
  "Europe/Berlin": "Guten Tag",
  "Europe/Vienna": "Guten Tag",
  "Europe/Zurich": "Grüezi",
  "Europe/Madrid": "Hola",
  "Europe/Lisbon": "Olá",
  "Europe/Amsterdam": "Hallo",
  "Europe/Warsaw": "Cześć",
  "Europe/Prague": "Ahoj",
  "Europe/Stockholm": "Hej",
  "Europe/Oslo": "Hei",
  "Europe/Copenhagen": "Hej",
  "Europe/Helsinki": "Moi",
  "Europe/Riga": "Sveiki",
  "Europe/Vilnius": "Sveiki",
  "Europe/Tallinn": "Tere",
  "Europe/Athens": "Geia sou",
  "Europe/Istanbul": "Merhaba",
  "Europe/Moscow": "Привет",
  "Europe/Kyiv": "Вітаю",
  "Europe/Dublin": "Dia dhuit",
  "Asia/Tokyo": "Konnichiwa",
  "Asia/Seoul": "Annyeong",
  "Asia/Shanghai": "Nǐ hǎo",
  "Asia/Hong_Kong": "Nǐ hǎo",
  "Asia/Kolkata": "Namaste",
  "Asia/Dubai": "Marhaba",
  "Asia/Jerusalem": "Shalom",
  "Asia/Bangkok": "Sawasdee",
  "Asia/Jakarta": "Halo",
  "America/Sao_Paulo": "Olá",
  "America/Mexico_City": "Hola",
  "America/Argentina/Buenos_Aires": "Hola",
  "Africa/Nairobi": "Jambo",
  "Africa/Johannesburg": "Sawubona",
  "Pacific/Auckland": "Kia ora",
};

function timeOfDay(hour: number) {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function pick(options: string[], seed: number) {
  return options[Math.abs(seed) % options.length] ?? options[0]!;
}

/**
 * Builds the greeting line, e.g. "Welcome back, Alina" or "Ciao, Alina".
 * `previousVisit` is a timestamp in ms; omit it for a first-ever visit.
 */
export function greetingFor(
  firstName: string,
  previousVisit?: number,
  now: Date = new Date(),
  timeZone?: string,
): string {
  const name = (firstName || "").trim().split(" ")[0] ?? "";
  const seed = Math.floor(now.getTime() / 3_600_000) + name.length;
  const hour = now.getHours();
  const gap = previousVisit ? now.getTime() - previousVisit : undefined;
  const day = 86_400_000;

  let phrase: string;

  if (gap === undefined) {
    phrase = pick(["Welcome", "Hi", "Hello", timeOfDay(hour)], seed);
  } else if (gap < 6 * 3_600_000) {
    phrase = pick(["Round two", "Back again", "That was quick", "Hi again"], seed);
  } else if (gap < day) {
    phrase = pick(["Hi", "Welcome back", "Nice to see you again", timeOfDay(hour)], seed);
  } else if (gap < 7 * day) {
    phrase = pick(["Welcome back", "Good to see you", "Hi", timeOfDay(hour)], seed);
  } else if (gap < 30 * day) {
    phrase = pick(["It's been a while", "We meet again", "Lovely to see you again"], seed);
  } else {
    phrase = pick(["Long time no see", "It's been a while", "Great to have you back"], seed);
  }

  // Every so often, greet in the local language of wherever they are.
  const zone =
    timeZone ??
    (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined);
  const local = zone ? LOCAL_HELLO[zone] : undefined;
  if (local && seed % 3 === 0) phrase = local;

  return name ? `${phrase}, ${name}` : phrase;
}

/**
 * React hook: records the visit once and returns the greeting line.
 * Renders an empty string on the server so hydration stays stable.
 */
export function useGreeting(firstName: string, email?: string): string {
  const [line, setLine] = useState("");
  useEffect(() => {
    const previous = email ? markVisit(email) : undefined;
    setLine(greetingFor(firstName, previous));
  }, [firstName, email]);
  return line;
}
