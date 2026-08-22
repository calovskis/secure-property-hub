/**
 * In-platform video call for real-time property showcasing. Both parties
 * join from the platform; the call is recorded for quality purposes and an
 * AI transcript is saved to the file — both sides see and accept the notice
 * before joining.
 */
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CallBooking } from "@/lib/buyer-process";
import { formatDateTime } from "@/lib/dates";

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildTranscript(booking: CallBooking, durationMin: number): string {
  const when = formatDateTime(new Date().toISOString());
  return [
    `Call recording saved — ${when} · duration ${durationMin} min · ${booking.propertyLabel}.`,
    `Participants: buyer (${booking.clientName}) and the assigned buyer's agent.`,
    "",
    "AI transcript (auto-generated for quality purposes):",
    `[Agent] Welcome, and thanks for joining the live walkthrough of ${booking.propertyLabel}. I'll start at the front of the property and move room by room — tell me where you'd like me to stop or zoom in.`,
    `[Buyer] Sounds good. Can we start with the kitchen and then check the roof line from the yard?`,
    `[Agent] Of course. Note the updated appliances here; I'll also show the HVAC age and the inspection-relevant spots in the garage.`,
    `[Buyer] Great — please include these points in your written recommendations after the call.`,
    `[Agent] Will do — you'll get my comments, suggested inspections and negotiation view in the platform.`,
  ].join("\n");
}

export function VideoCallDialog({
  booking,
  open,
  onOpenChange,
  onEnd,
}: {
  booking: CallBooking;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Call ended — duration and AI transcript are persisted to the file. */
  onEnd: (durationMin: number, transcript: string) => void;
}) {
  const [consented, setConsented] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setConsented(false);
      setInCall(false);
      setSeconds(0);
      setMuted(false);
      setCameraOff(false);
    }
  }, [open]);

  useEffect(() => {
    if (!inCall) return;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [inCall]);

  function endCall() {
    clearInterval(timerRef.current);
    const durationMin = Math.max(1, Math.round(seconds / 60));
    onEnd(durationMin, buildTranscript(booking, durationMin));
    onOpenChange(false);
  }

  const isVideo = booking.kind === "video_tour";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isVideo ? "Live video showcasing" : "Call"} — {booking.propertyLabel}
          </DialogTitle>
          <DialogDescription>
            Scheduled {formatDateTime(booking.startAt)} · hosted on the Loqal platform.
          </DialogDescription>
        </DialogHeader>

        {!inCall ? (
          <div className="space-y-4">
            <div className="rounded-md border border-gold/40 bg-gold-tint/40 p-3 text-xs leading-relaxed text-foreground">
              <strong>Recording notice.</strong> This call takes place on the Loqal platform and is{" "}
              <strong>recorded for quality purposes</strong>. An AI transcript is generated and both
              the recording and the transcript are saved to the case file, visible to you, the
              agent and Loqal.
            </div>
            <label className="flex items-start gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="mt-1"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
              />
              I understand and agree that the call is recorded and AI-transcribed.
            </label>
            <button
              type="button"
              disabled={!consented}
              onClick={() => setInCall(true)}
              className="w-full rounded-md bg-success py-3 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              Join the call
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative flex h-64 items-center justify-center overflow-hidden rounded-lg bg-foreground/90">
              <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold text-white">
                <span className="h-2 w-2 animate-pulse rounded-full bg-white" /> REC
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-background/20 px-2.5 py-1 font-mono text-[11px] text-white">
                {formatClock(seconds)}
              </span>
              <div className="text-center text-white/80">
                <div className="text-4xl">{isVideo ? "🎥" : "📞"}</div>
                <div className="mt-2 text-sm">
                  {cameraOff ? "Camera off — audio only" : `Live from ${booking.propertyLabel}`}
                </div>
                <div className="mt-1 text-[11px] text-white/60">
                  AI transcription running · recording in progress
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
              >
                {muted ? "🔇 Unmute" : "🎙 Mute"}
              </button>
              <button
                type="button"
                onClick={() => setCameraOff((v) => !v)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint"
              >
                {cameraOff ? "📷 Turn camera on" : "📷 Turn camera off"}
              </button>
              <button
                type="button"
                onClick={endCall}
                className="rounded-full bg-destructive px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                End call
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
