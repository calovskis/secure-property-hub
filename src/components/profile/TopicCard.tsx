import { useState, type ReactNode } from "react";
import { ChevronDown, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** One field-level change shown in the confirmation dialog. */
export type FieldDiff = { label: string; from: string; to: string };

export function formatDiffValue(v: unknown): string {
  if (v === undefined || v === null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.length ? `${v.length} item${v.length === 1 ? "" : "s"}` : "None";
  return String(v);
}

/** Compare two flat patch objects and return only the fields that changed. */
export function diffPatch<T extends Record<string, unknown>>(
  before: T,
  after: T,
  labels: Partial<Record<keyof T, string>>,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const key of Object.keys(after) as (keyof T)[]) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    diffs.push({
      label: labels[key] ? String(labels[key]) : String(key),
      from: formatDiffValue(a),
      to: formatDiffValue(b),
    });
  }
  return diffs;
}

/** Confirmation modal summarizing field-level changes before persisting. */
export function ConfirmChangesDialog({
  open,
  onOpenChange,
  diffs,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diffs: FieldDiff[];
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Review changes</DialogTitle>
        </DialogHeader>
        {diffs.length ? (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {diffs.map((d) => (
              <li key={d.label} className="rounded-md border border-border p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {d.label}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-foreground">
                  <span className="text-muted-foreground line-through">{d.from}</span>
                  <span className="text-brand">→</span>
                  <span className="font-medium">{d.to}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No changes detected.</p>
        )}
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
          >
            Go back
          </button>
          <button
            type="button"
            disabled={!diffs.length}
            onClick={onConfirm}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
          >
            Confirm changes
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Collapsible topic card: collapsed summary line, expands to full detail + edit. */
export function TopicCard({
  title,
  summary,
  banner,
  onEdit,
  children,
  defaultOpen,
}: {
  title: string;
  summary: string;
  banner?: ReactNode;
  onEdit?: () => void;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {!open ? <div className="mt-0.5 text-xs text-muted-foreground">{summary}</div> : null}
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="border-t border-border px-5 py-4">
          {banner}
          <div className="flex justify-end">
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="mb-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
            ) : null}
          </div>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function TopicField({
  label,
  value,
}: {
  label: string;
  value?: string | number | null | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}
