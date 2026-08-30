/**
 * Pop-up used everywhere a Loqal request asks a partner for documents.
 *
 * Inside the pop-up the person can add files, replace or delete them, write an
 * optional answer, then reconfirm everything on a summary step before it is
 * submitted. Anything left unfinished is pre-saved and reappears under
 * "Unfinished uploads" on My Profile.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  clearUploadDraft,
  getUploadDraft,
  onOpenUpload,
  saveUploadDraft,
} from "@/lib/upload-drafts";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

export function UploadRequestDialog({
  open,
  onOpenChange,
  draftId,
  label,
  title,
  description,
  requireDocument = false,
  askNote = true,
  choices,
  choiceLabel = "Document type",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string;
  /** Shown in the unfinished-uploads panel. */
  label: string;
  title: string;
  description: string;
  requireDocument?: boolean;
  askNote?: boolean;
  /** Optional document-type picker shown inside the pop-up. */
  choices?: { value: string; label: string }[];
  choiceLabel?: string;
  onSubmit: (result: { note: string; files: string[]; choice?: string }) => void;
}) {
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [choice, setChoice] = useState<string>(choices?.[0]?.value ?? "");
  const [step, setStep] = useState<"upload" | "confirm">("upload");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);


  // Re-open from the "Unfinished uploads" panel.
  useEffect(() => onOpenUpload(draftId, () => onOpenChange(true)), [draftId, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const draft = getUploadDraft(draftId);
    setNote(draft?.note ?? "");
    setFiles(draft?.files ?? []);
    setRestored(Boolean(draft));
    setStep("upload");
    setConfirmed(false);
    setError(null);
  }, [open, draftId]);

  function persist(nextNote: string, nextFiles: string[]) {
    saveUploadDraft({ id: draftId, label, note: nextNote, files: nextFiles, expected: 1 });
  }

  function addFiles(names: string[]) {
    const next = [...files, ...names.filter((n) => !files.includes(n))];
    setFiles(next);
    persist(note, next);
  }

  function removeFile(name: string) {
    const next = files.filter((f) => f !== name);
    setFiles(next);
    persist(note, next);
  }

  function toConfirm() {
    if (requireDocument && files.length === 0)
      return setError("This request needs at least one document.");
    if (askNote && !note.trim() && files.length === 0)
      return setError("Attach a document or write your answer.");
    setError(null);
    setStep("confirm");
  }

  function submit() {
    if (!confirmed) return setError("Please reconfirm that everything is correct.");
    onSubmit({ note: note.trim(), files, choice: choices ? choice : undefined });
    clearUploadDraft(draftId);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="mt-2 space-y-4">
            {restored ? (
              <p className="text-[11px] font-semibold text-gold">
                Pre-saved progress restored — nothing has been submitted yet.
              </p>
            ) : null}

            {choices?.length ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {choiceLabel}
                </span>
                <select
                  value={choice}
                  onChange={(e) => setChoice(e.target.value)}
                  className={inputClass}
                >
                  {choices.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}



            {askNote ? (
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your answer {requireDocument ? "(optional)" : ""}
                </span>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    persist(e.target.value, files);
                  }}
                  placeholder="Anything Loqal should know about these documents"
                  className={inputClass}
                />
              </label>
            ) : null}

            <div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:border-brand">
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const names = Array.from(e.target.files ?? []).map((f) => f.name);
                    if (names.length) addFiles(names);
                    e.target.value = "";
                  }}
                />
                {files.length ? "Add another document" : "Choose document"}
              </label>

              {files.length ? (
                <ul className="mt-3 space-y-2">
                  {files.map((f) => (
                    <li
                      key={f}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs text-foreground"
                    >
                      <span className="truncate">📎 {f}</span>
                      <span className="flex shrink-0 gap-2">
                        <label className="cursor-pointer font-semibold text-brand hover:underline">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const name = e.target.files?.[0]?.name;
                              if (name) {
                                const next = files.map((x) => (x === f ? name : x));
                                setFiles(next);
                                persist(note, next);
                              }
                              e.target.value = "";
                            }}
                          />
                          Change
                        </label>
                        <button
                          type="button"
                          onClick={() => removeFile(f)}
                          className="font-semibold text-destructive hover:underline"
                        >
                          Delete
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Save &amp; close
              </button>
              <button
                type="button"
                onClick={toConfirm}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
              >
                Review &amp; submit
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 space-y-4">
            <div className="rounded-md border border-border bg-background p-3">
              {choices?.length ? (
                <p className="text-sm font-semibold text-foreground">
                  {choices.find((c) => c.value === choice)?.label}
                </p>
              ) : null}
              {note ? (
                <p className="whitespace-pre-wrap text-sm text-foreground">{note}</p>
              ) : null}

              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {files.length ? (
                  files.map((f) => <li key={f}>📎 {f}</li>)
                ) : (
                  <li>No documents attached.</li>
                )}
              </ul>
            </div>
            <label className="flex items-start gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              I confirm these documents are correct, current and mine to share with Loqal.
            </label>
            {error ? <p className="text-xs font-semibold text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Back
              </button>
              <button
                type="button"
                onClick={submit}
                className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
              >
                Submit to Loqal
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
