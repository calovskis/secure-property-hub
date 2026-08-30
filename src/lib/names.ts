/**
 * One place for how people's names are produced and displayed across Loqal.
 *
 * Names arrive from three sources — the registration form, a partner
 * registration record, and (as a last resort) the e-mail address — so they
 * must be normalised consistently, otherwise dashboards end up greeting
 * "alinacarter" instead of "Alina Carter".
 */

/** Title-cases one word, keeping hyphens, apostrophes and Mc/Mac intact. */
function titleCaseWord(word: string): string {
  if (!word) return "";
  return word
    .split(/([-'’])/)
    .map((part) =>
      /^[-'’]$/.test(part)
        ? part
        : part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase(),
    )
    .join("");
}

/** Normalises a single name field: trims, collapses spaces, title-cases it. */
export function normalizeName(raw?: string | null): string {
  const value = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return "";
  return value.split(" ").map(titleCaseWord).join(" ");
}

/** Splits a free-form name ("alina carter", "Carter, Alina") into parts. */
export function splitName(raw?: string | null): { firstName: string; lastName: string } {
  const value = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!value) return { firstName: "", lastName: "" };
  if (value.includes(",")) {
    const [last, first] = value.split(",");
    return { firstName: normalizeName(first), lastName: normalizeName(last) };
  }
  const parts = value.split(" ");
  if (parts.length === 1) return { firstName: normalizeName(parts[0]), lastName: "" };
  return {
    firstName: normalizeName(parts[0]),
    lastName: normalizeName(parts.slice(1).join(" ")),
  };
}

/**
 * Best-effort first/last name from an e-mail address, used only when we have
 * no registration on file. "alina.carter@x.com" → Alina Carter;
 * "alinaCarter@x.com" → Alina Carter; "alinacarter@x.com" → Alinacarter.
 */
export function namesFromEmail(email?: string | null): { firstName: string; lastName: string } {
  const local = (email ?? "").split("@")[0] ?? "";
  const cleaned = local
    .replace(/\d+/g, " ")
    .replace(/[._\-+]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return { firstName: "Loqal", lastName: "" };
  return splitName(cleaned);
}

/** "Alina Carter" — middle name included when present. */
export function joinName(parts: {
  firstName?: string | null;
  middleName?: string | null;
  lastName?: string | null;
}): string {
  return [parts.firstName, parts.middleName, parts.lastName]
    .map((p) => normalizeName(p))
    .filter(Boolean)
    .join(" ");
}

/** "AC" — initials for avatars and badges. */
export function nameInitials(parts: {
  firstName?: string | null;
  lastName?: string | null;
}): string {
  const first = normalizeName(parts.firstName).charAt(0);
  const last = normalizeName(parts.lastName).charAt(0);
  return `${first}${last}`.toUpperCase() || "L";
}
