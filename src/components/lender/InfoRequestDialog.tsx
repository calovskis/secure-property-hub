import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  INFO_REQUEST_TYPE_LABEL,
  type InfoRequestType,
  type MortgageLead,
} from "@/lib/leads";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

const btnPrimary =
  "rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft";
const btnGhost =
  "rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

type Step = "compose" | "confirm";

/**
 * Information-request flow, lifted out of the inline decision panel into its
 * own modal so it reads the same as the client-facing mortgage questionnaire.
 * No soft credit score is ever required to send an information request.
 */
export function InfoRequestDialog({
  lead,
  open,
  onOpenChange,
  onSend,
  initialQuestion = "",
  initialNeedsDocument,
  initialType = "information",
  contextLabel,
}: {
  lead: MortgageLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (question: string, needsDocument: boolean, type: InfoRequestType) => void;
  initialQuestion?: string | undefined;
  initialNeedsDocument?: boolean | undefined;
  initialType?: InfoRequestType | undefined;
  contextLabel?: string | undefined;
}) {
  const [step, setStep] = useState<Step>("compose");
  const [question, setQuestion] = useState(initialQuestion);
  const [requestType, setRequestType] = useState<InfoRequestType>(initialType);
  const [docChoice, setDocChoice] = useState<"yes" | "no" | null>(
    initialNeedsDocument === undefined ? null : initialNeedsDocument ? "yes" : "no",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep("compose");
    setQuestion(initialQuestion);
    setRequestType(initialType);
    setDocChoice(initialNeedsDocument === undefined ? null : initialNeedsDocument ? "yes" : "no");
    setError(null);
  }, [initialNeedsDocument, initialQuestion, initialType, open]);

  function reset() {
    setStep("compose");
    setQuestion("");
    setRequestType("information");
    setDocChoice(null);
    setError(null);
  }

  function close() {
    reset();
    onOpenChange(false);
  }

  function goToConfirm() {
    if (!question.trim()) {
      setError("Describe what the client must answer or upload.");
      return;
    }
    if (docChoice === null) {
      setError("Choose whether a document upload is required.");
      return;
    }
    setError(null);
    setStep("confirm");
  }

  function send() {
    onSend(question.trim(), docChoice === "yes", requestType);
    close();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Request more information — {lead.clientName}
          </DialogTitle>
          <DialogDescription>
            {step === "compose"
              ? "Ask the client to clarify something or upload a document. No credit score is required for this step."
              : "Review the request before it goes to the client."}
          </DialogDescription>
        </DialogHeader>

        {step === "compose" ? (
          <div className="space-y-4">
            {contextLabel ? (
              <div className="rounded-md border border-gold/35 bg-gold-tint/30 px-3 py-2 text-xs text-foreground">
                {contextLabel}
              </div>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Request type
              </span>
              <select
                value={requestType}
                onChange={(event) => setRequestType(event.target.value as InfoRequestType)}
                className={inputClass}
              >
                {Object.entries(INFO_REQUEST_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Message to the client
              </span>
              <textarea
                rows={4}
                autoFocus
                placeholder="e.g. Please confirm your bonus structure and upload your last two pay stubs."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className={inputClass}
              />
            </label>
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Is a document upload required?
              </span>
              <div className="flex gap-2">
                {(
                  [
                    ["yes", "Yes — client must upload"],
                    ["no", "No — written answer only"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDocChoice(value)}
                    className={`rounded-md px-3 py-2 text-xs font-semibold ${
                      docChoice === value
                        ? "bg-brand text-background"
                        : "border border-border text-muted-foreground hover:bg-brand-tint"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
            <DialogFooter>
              <button type="button" onClick={close} className={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={goToConfirm} className={btnPrimary}>
                Review request
              </button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-gold/40 bg-gold-tint/40 p-4">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {INFO_REQUEST_TYPE_LABEL[requestType]} request
              </span>
              <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-sm text-foreground">
                {question.trim()}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Document upload:{" "}
                <strong className="text-foreground">
                  {docChoice === "yes" ? "required" : "not required"}
                </strong>{" "}
                · The file moves to “More information required”.
              </p>
            </div>
            <DialogFooter>
              <button type="button" onClick={close} className={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={() => setStep("compose")} className={btnGhost}>
                Back to edit
              </button>
              <button type="button" onClick={send} className={btnPrimary}>
                Confirm &amp; send request
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
