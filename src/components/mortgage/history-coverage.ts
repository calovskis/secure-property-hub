/**
 * 2-year (24 month) history coverage check shared by the address (step 1)
 * and employment/income (step 2) steps. Dates are ISO month strings
 * (yyyy-mm), matching what <MonthInput> produces.
 */

type HistoryEntry = { from: string; to: string; current: boolean };

function monthNum(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

function currentMonthNum(): number {
  const now = new Date();
  return now.getFullYear() * 12 + now.getMonth();
}

/** True when the given entries collectively cover the last 24 months. */
export function hasTwoYearCoverage(entries: HistoryEntry[]): boolean {
  const now = currentMonthNum();
  const target = now - 24;

  const ranges = entries
    .map((e) => {
      const start = monthNum(e.from);
      if (start === null) return null;
      const end = e.current ? now : (monthNum(e.to) ?? start);
      if (end < start) return null;
      return { start, end };
    })
    .filter((r): r is { start: number; end: number } => r !== null)
    .sort((a, b) => a.start - b.start);

  if (!ranges.length) return false;

  // Merge ranges, allowing gaps of at most 1 month.
  const merged: { start: number; end: number }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end + 1) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }

  return merged.some((r) => r.start <= target && r.end >= now - 1);
}
