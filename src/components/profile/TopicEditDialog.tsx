import { useEffect, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmChangesDialog, diffPatch } from "@/components/profile/TopicCard";

/**
 * Generic "edit one topic" dialog: renders a form for a draft of type T,
 * then opens a separate confirmation dialog summarizing field-level changes
 * before calling `onSave` with the full patch.
 */
export function TopicEditDialog<T extends Record<string, unknown>>({
  open,
  onOpenChange,
  title,
  initial,
  labels,
  onSave,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initial: T;
  labels: Partial<Record<keyof T, string>>;
  onSave: (patch: T) => void;
  children: (draft: T, setDraft: (patch: Partial<T>) => void) => ReactNode;
}) {
  const [draft, setDraftState] = useState<T>(initial);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (open) setDraftState(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setDraft = (patch: Partial<T>) => setDraftState((d) => ({ ...d, ...patch }));
  const diffs = diffPatch(initial, draft, labels);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit {title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">{children(draft, setDraft)}</div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Review changes
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmChangesDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        diffs={diffs}
        onConfirm={() => {
          onSave(draft);
          setConfirmOpen(false);
          onOpenChange(false);
        }}
      />
    </>
  );
}
