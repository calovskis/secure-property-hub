/**
 * Admin-side follow-up on an open partner registration: ask the partner for
 * more information (the same two-step compose → confirm flow a mortgage
 * lender uses with a client) or ask them for a video call, which the partner
 * then books from their Loqal profile.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PartnerRequest } from "@/lib/partner-requests";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft";
const btnGhost =
  "rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

export function PartnerRequestDialog({
  request,
  kind,
  open,
  onOpenChange,
  onSend,
}: {
  request: PartnerRequest;
  kind: "info" | "call";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (message: string, requiresDocument: boolean) => void;
}) {
  const [step, setStep] = useState<"compose" | "confirm">("compose");
  const [message, setMessage] = useState("");
  const [docChoice, setDocChoice] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setStep("compose");
    setMessage("");
    setDocChoice(null);
    setError(null);
    onOpenChange(false);
  }

  function review() {
    if (!message.trim()) {
      setError(
        kind === "info"
          ? "Describe what the partner must answer or upload."
          : "Say what the call should cover.",
      );
      return;
    }
    if (kind === "info" && docChoice === null) {
      setError("Choose whether a document upload is required.");
      return;
    }
    setError(null);
    setStep("confirm");
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
            {kind === "info" ? "Request more information" : "Request a video call"} —{" "}
            {request.companyName}
          </DialogTitle>
          <DialogDescription>
            {kind === "info"
              ? "Ask the partner to clarify something or upload a document before you decide."
              : "The partner picks a time from the Loqal calendar and joins on Google Meet."}
          </DialogDescription>
        </DialogHeader>

        {step === "compose" ? (
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Message to the partner
              </span>
              <textarea
                rows={4}
                autoFocus
                placeholder={
                  kind === "info"
                    ? "e.g. Please confirm your brokerage licence number and upload the E&O insurance certificate."
                    : "e.g. We'd like a 30-minute introduction call to walk through your coverage areas."
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className={inputClass}
              />
            </label>
            {kind === "info" ? (
              <div>
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Is a document upload required?
                </span>
                <div className="flex gap-2">
                  {(
                    [
                      ["yes", "Yes — partner must upload"],
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
            ) : null}
            {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
            <DialogFooter>
              <button type="button" onClick={close} className={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={review} className={btnPrimary}>
                Review request
              </button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border border-gold/40 bg-gold-tint/40 p-4">
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Message
              </span>
              <p className="mt-2 whitespace-pre-wrap rounded-md border border-border bg-card p-3 text-sm text-foreground">
                {message.trim()}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {kind === "info" ? (
                  <>
                    Document upload:{" "}
                    <strong className="text-foreground">
                      {docChoice === "yes" ? "required" : "not required"}
                    </strong>
                  </>
                ) : (
                  <>The partner books a slot from their Loqal profile.</>
                )}{" "}
                · The registration stays open in the queue.
              </p>
            </div>
            <DialogFooter>
              <button type="button" onClick={close} className={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={() => setStep("compose")} className={btnGhost}>
                Back to edit
              </button>
              <button
                type="button"
                onClick={() => {
                  onSend(message.trim(), docChoice === "yes");
                  close();
                }}
                className={btnPrimary}
              >
                Confirm &amp; send request
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
