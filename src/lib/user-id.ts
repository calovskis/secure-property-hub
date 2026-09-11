/**
 * Internal Loqal user numbers and partner-facing name privacy.
 *
 * Every person on the platform (client or partner) carries a short internal
 * number shown next to their name, so two people with the same first name can
 * always be told apart. The number is derived from the account e-mail, which
 * makes it stable everywhere without a round-trip.
 *
 * Partners must never see a client's family name — only the first name plus
 * the internal number. Loqal admins keep the full name.
 */
import { normalizeName } from "@/lib/names";

/** Stable 6-digit code from an e-mail — "LQ-482913". */
export function loqalNumber(email?: string | null): string {
  const key = (email ?? "").trim().toLowerCase();
  if (!key) return "LQ-000000";
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = (Math.abs(h) % 900000) + 100000;
  return `LQ-${n}`;
}

/** First name only, from a full name or an e-mail fallback. */
export function firstNameOnly(fullName?: string | null): string {
  const first = (fullName ?? "").replace(/\s+/g, " ").trim().split(" ")[0] ?? "";
  return normalizeName(first);
}

/**
 * What a partner is allowed to see for a client: "Lola · LQ-482913".
 * `withNumber: false` returns just the first name.
 */
export function clientDisplayForPartner(
  fullName?: string | null,
  email?: string | null,
  opts: { withNumber?: boolean } = {},
): string {
  const first = firstNameOnly(fullName) || "Client";
  if (opts.withNumber === false) return first;
  return `${first} · ${loqalNumber(email)}`;
}

/**
 * What a client is allowed to see for a partner: first name plus the internal
 * number — "Anna · LQ-731204". Family names of partners stay hidden from
 * clients, exactly as client family names stay hidden from partners.
 */
export function partnerDisplayForClient(
  fullName?: string | null,
  email?: string | null,
  opts: { withNumber?: boolean } = {},
): string {
  const first = firstNameOnly(fullName) || "Your partner";
  if (opts.withNumber === false) return first;
  return `${first} · ${loqalNumber(email)}`;
}
