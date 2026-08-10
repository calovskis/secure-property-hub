/**
 * Loqal date convention: every date shown or requested in the UI uses US
 * format mm/dd/yyyy (months as mm/yyyy). Values are stored as ISO
 * (yyyy-mm-dd / yyyy-mm) so they stay sortable and machine-readable.
 */

export const DATE_PLACEHOLDER = "mm/dd/yyyy";
export const MONTH_PLACEHOLDER = "mm/yyyy";

/** ISO yyyy-mm-dd -> mm/dd/yyyy */
export function isoToUsDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  return `${m[2]}/${m[3]}/${m[1]}`;
}

/** mm/dd/yyyy -> ISO yyyy-mm-dd (empty string when incomplete/invalid) */
export function usDateToIso(value: string): string {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return "";
  const [, mm, dd, yyyy] = m;
  const month = Number(mm);
  const day = Number(dd);
  if (month < 1 || month > 12 || day < 1 || day > 31) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/** ISO yyyy-mm -> mm/yyyy */
export function isoToUsMonth(iso: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  return `${m[2]}/${m[1]}`;
}

/** mm/yyyy -> ISO yyyy-mm */
export function usMonthToIso(value: string): string {
  const m = /^(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return "";
  const month = Number(m[1]);
  if (month < 1 || month > 12) return "";
  return `${m[2]}-${m[1]}`;
}

/** Digits-only masking helpers used by the date inputs. */
export function maskUsDate(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

export function maskUsMonth(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Any date-ish value (ISO string / Date) -> mm/dd/yyyy */
export function formatDate(value?: string | number | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "—";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

/** mm/dd/yyyy, h:mm AM/PM */
export function formatDateTime(value?: string | number | Date | null): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : "—";
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${formatDate(d)}, ${time}`;
}
