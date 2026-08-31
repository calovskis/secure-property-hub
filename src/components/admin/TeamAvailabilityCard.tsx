/**
 * "Loqal team today" — bottom-of-dashboard card for admins: who is in, who is
 * away, and (for anyone) a quick way to set time off for a colleague.
 */
import { useMemo, useState } from "react";
import { CalendarDays, Plane } from "lucide-react";
import { DateInput } from "@/components/form/DateInput";
import { formatDate } from "@/lib/dates";
import { useStaff, type StaffMember } from "@/lib/staff";

const REASONS = ["Out of office", "Vacation", "Sick leave", "Travel / client visit", "Public holiday"];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function isAwayToday(m: StaffMember) {
  if (!m.awayUntil) return false;
  const today = new Date().toISOString().slice(0, 10);
  return m.awayUntil >= today;
}

export function TeamAvailabilityCard({ onOpenEmployees }: { onOpenEmployees?: () => void }) {
  const { members, setAway } = useStaff();
  const [editing, setEditing] = useState(false);
  const [memberId, setMemberId] = useState("");
  const [until, setUntil] = useState("");
  const [reason, setReason] = useState<string>(REASONS[0] ?? "Out of office");

  const away = useMemo(() => members.filter(isAwayToday), [members]);
  const present = members.length - away.length;

  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground">
            <CalendarDays className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">Loqal team today</h2>
            <p className="text-xs text-muted-foreground">
              {present} available · {away.length} away
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {editing ? "Close" : "Set time off"}
        </button>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-[1.2fr_1fr_1fr_auto]">
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select employee…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            {REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <DateInput
            value={until}
            onChange={setUntil}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!memberId || !until}
            onClick={() => {
              setAway(memberId, until, reason);
              setMemberId("");
              setUntil("");
              setEditing(false);
            }}
            className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background disabled:opacity-50"
          >
            Save
          </button>
        </div>
      ) : null}

      {away.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Everyone is in today — no time off recorded.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {away.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-brand-tint text-xs font-semibold text-brand">
                  {initials(m.name)}
                  <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-destructive" />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{m.name}</div>
                  <div className="text-xs text-muted-foreground">{m.title}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[11px] font-semibold text-destructive">
                  <Plane className="h-3 w-3" />
                  {m.awayReason ?? "Out of office"} until {formatDate(m.awayUntil)}
                </span>
                <button
                  type="button"
                  onClick={() => setAway(m.id, "", "")}
                  className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {onOpenEmployees ? (
        <button
          type="button"
          onClick={onOpenEmployees}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-muted px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/70"
        >
          <CalendarDays className="h-4 w-4" />
          View team & access
        </button>
      ) : null}
    </section>
  );
}
