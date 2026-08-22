import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useLeads,
  KICKOFF_LABEL,
  type KickoffRequest,
  type MortgageLead,
  type Representation,
} from "@/lib/leads";
import { useI18n } from "@/lib/i18n";
import { useBuyerProcess } from "@/lib/buyer-process";
import { CallScheduler } from "@/components/buyer/CallScheduler";
import { formatDateTime } from "@/lib/dates";

const btnPrimary =
  "rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";
const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

type Step = "agree" | "representation" | "kickoff" | "done";

/**
 * Shown when the client chooses to continue with the lender's pre-approval
 * terms:
 *   1. buyer's agent agreement (3% fee at closing)
 *   2. who steers the purchase — a Loqal personal manager (+1% fee) or the
 *      buyer directly with the agent
 *   3. for the direct path — kickoff: intro call (live calendar booking),
 *      photo visit or real-time video tour, with room for written notes
 */
export function BuyerAgentDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: MortgageLead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { agreeBuyerAgent, setBuyerRepresentation } = useLeads();
  const { requestPhotos, bookCall } = useBuyerProcess();
  const { lang } = useI18n();
  const [step, setStep] = useState<Step>("agree");
  const [representation, setRepresentation] = useState<Representation | null>(null);
  const [kickoff, setKickoff] = useState<KickoffRequest | null>(null);
  const [notes, setNotes] = useState("");
  const [callSlot, setCallSlot] = useState<string | null>(null);

  /* Reset every time the dialog opens; skip steps that are already done. */
  useEffect(() => {
    if (!open) return;
    setRepresentation(null);
    setKickoff(null);
    setNotes("");
    setCallSlot(null);
    setStep(
      lead.buyerAgent?.representation ? "done" : lead.buyerAgent ? "representation" : "agree",
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    onOpenChange(false);
  }

  function agree() {
    agreeBuyerAgent(lead.id, [lang === "ru" ? "Russian" : "English"]);
    setStep("representation");
  }

  function continueRepresentation() {
    if (!representation) return;
    if (representation === "loqal_rep") {
      setBuyerRepresentation(lead.id, "loqal_rep", undefined, notes.trim() || undefined);
      setStep("done");
    } else {
      setStep("kickoff");
    }
  }

  function confirmKickoff() {
    if (!kickoff) return;
    if (kickoff === "live_call" && !callSlot) return;
    setBuyerRepresentation(lead.id, "buyer_direct", kickoff, notes.trim() || undefined);
    if (kickoff === "photo_visit") requestPhotos(lead.id);
    setStep("done");
  }

  const agentName = lead.buyerAgent?.agentName;
  const saved = lead.buyerAgent;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        {step === "agree" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                A buyer's agent will represent you
              </DialogTitle>
              <DialogDescription>
                Please review and confirm before we continue with your mortgage pre-approval.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Once you proceed, a licensed Loqal partner realtor is assigned to you as your{" "}
                <strong className="text-foreground">buyer's agent</strong>. The agent represents
                you — the buyer — not the seller.
              </p>
              <div className="rounded-md border border-gold/40 bg-gold-tint/40 p-3 text-foreground">
                The buyer's agent fee is <strong>3% of the purchase price</strong>, due at closing.
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Your buyer's agent's mission
                </div>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Negotiate the property price down as much as possible on your behalf.</li>
                  <li>Decide with you which inspections are necessary and order them.</li>
                  <li>
                    Propose a property change when circumstances or your input call for it.
                  </li>
                  <li>Guide you through offers, the Purchase Agreement and closing.</li>
                </ul>
              </div>
              <p className="text-xs">
                New to buyer's agents?{" "}
                <Link to="/faq" className="font-semibold text-brand hover:underline">
                  Read how buyer's agents work in the USA
                </Link>{" "}
                before you confirm.
              </p>
            </div>

            <DialogFooter>
              <button type="button" onClick={close} className={btnGhost}>
                Not yet
              </button>
              <button type="button" onClick={agree} className={btnPrimary}>
                I agree — assign my buyer's agent
              </button>
            </DialogFooter>
          </>
        ) : null}

        {step === "representation" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">
                Who should steer your purchase?
              </DialogTitle>
              <DialogDescription>
                {agentName
                  ? `${agentName} has been assigned as your buyer's agent.`
                  : "We are matching you with the best available buyer's agent."}{" "}
                Choose how hands-on you want to be.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setRepresentation("loqal_rep")}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  representation === "loqal_rep"
                    ? "border-brand bg-brand-tint/50"
                    : "border-border bg-card hover:border-brand hover:bg-brand-tint/30"
                }`}
              >
                <div className="text-sm font-semibold text-foreground">
                  🛡 Assign a Loqal personal manager to represent my interests
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Your Loqal personal manager treats the property as their own personal investment
                  and makes decisions as if it were their own purchase — always informing you about
                  the best course of action, including necessary inspections, negotiations and
                  next steps.
                </p>
                <p className="mt-2 rounded-md border border-gold/40 bg-gold-tint/40 p-2 text-xs font-semibold text-foreground">
                  Loqal personal manager fee: an extra 1% of the purchase price at closing.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRepresentation("buyer_direct")}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  representation === "buyer_direct"
                    ? "border-brand bg-brand-tint/50"
                    : "border-border bg-card hover:border-brand hover:bg-brand-tint/30"
                }`}
              >
                <div className="text-sm font-semibold text-foreground">
                  🤝 Work with my buyer's agent myself
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  You coordinate with {agentName ?? "your agent"} directly — calls, property
                  visits, inspections and negotiations — with Loqal keeping track in the
                  background. No extra fee beyond the 3% buyer's agent fee.
                </p>
              </button>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Comments / notes (optional)
                </span>
                <textarea
                  rows={3}
                  placeholder="Anything we or your agent should know…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <DialogFooter>
              <button type="button" onClick={close} className={btnGhost}>
                Decide later
              </button>
              <button
                type="button"
                disabled={!representation}
                onClick={continueRepresentation}
                className={btnPrimary}
              >
                {representation === "buyer_direct" ? "Continue" : "Confirm — assign my Loqal manager"}
              </button>
            </DialogFooter>
          </>
        ) : null}

        {step === "kickoff" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">How would you like to start?</DialogTitle>
              <DialogDescription>
                Choose the first step with {agentName ?? "your buyer's agent"}. You can add notes
                for any option.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              {(
                [
                  [
                    "live_call",
                    "📞 Request a live call with your buyer's agent",
                    "Pre-discuss the process, your criteria and the timeline. Book a 1-hour slot straight from the agent's live calendar — the agent is informed automatically.",
                  ],
                  [
                    "photo_visit",
                    "📷 Request an agent visit for updated property photos",
                    "The agent visits the property and uploads fresh photos within 3 days — or tells you the new date and the reason if the seller cannot receive them in time.",
                  ],
                  [
                    "video_showcase",
                    "🎥 Request a real-time video showcasing",
                    "The agent visits the property and walks you through it live on video, answering your questions as you watch.",
                  ],
                ] as [KickoffRequest, string, string][]
              ).map(([id, title, blurb]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setKickoff(id)}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    kickoff === id
                      ? "border-brand bg-brand-tint/50"
                      : "border-border bg-card hover:border-brand hover:bg-brand-tint/30"
                  }`}
                >
                  <div className="text-sm font-semibold text-foreground">{title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{blurb}</p>
                </button>
              ))}

              {kickoff === "live_call" ? (
                <CallScheduler
                  realtorId={lead.buyerAgent?.agentId}
                  {...(callSlot ? { booked: callSlot } : {})}
                  onBook={(startAt) => {
                    bookCall({
                      leadId: lead.id,
                      clientName: lead.clientName,
                      propertyLabel: lead.propertyLabel,
                      kind: "intro_call",
                      startAt,
                      ...(lead.buyerAgent?.agentId
                        ? { realtorId: lead.buyerAgent.agentId }
                        : {}),
                    });
                    setCallSlot(startAt);
                  }}
                />
              ) : null}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Comments / notes (optional)
                </span>
                <textarea
                  rows={3}
                  placeholder="Anything your agent should know before starting…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <DialogFooter>
              <button type="button" onClick={() => setStep("representation")} className={btnGhost}>
                Back
              </button>
              <button
                type="button"
                disabled={!kickoff || (kickoff === "live_call" && !callSlot)}
                onClick={confirmKickoff}
                className={btnPrimary}
              >
                Confirm
              </button>
            </DialogFooter>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">You're all set</DialogTitle>
              <DialogDescription>
                Your mortgage file is open and your purchase team is on board.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-md border border-success/40 bg-success/5 p-4 text-sm text-muted-foreground">
              {saved?.representation === "loqal_rep" ? (
                <p>
                  <strong className="text-foreground">A Loqal personal manager</strong> now
                  represents your interests and will treat this purchase as their own investment
                  (+1% fee at closing). {agentName ? `${agentName} stays involved as the licensed buyer's agent. ` : ""}
                  You will be informed about every recommended step.
                </p>
              ) : (
                <p>
                  <strong className="text-foreground">{agentName ?? "Your buyer's agent"}</strong>{" "}
                  represents you — fee {saved?.feePct ?? 3}% of the purchase price at closing.
                  {saved?.kickoff === "live_call"
                    ? " Your intro call is booked — see the confirmation below."
                    : saved?.kickoff === "photo_visit"
                      ? " The agent will visit the property and upload fresh photos within 3 days."
                      : saved?.kickoff === "video_showcase"
                        ? " The agent will schedule your live video tour of the property."
                        : " The agent starts working on your brief right away."}
                </p>
              )}
              {callSlot ? (
                <p className="rounded-md bg-background/70 p-2 text-xs">
                  📞 Intro call: {formatDateTime(callSlot)} (1 hour)
                </p>
              ) : null}
              <p>
                Your lender is now running the hard credit check and preparing the formal mortgage
                proposal.
              </p>
            </div>
            <DialogFooter>
              <button type="button" onClick={close} className={btnPrimary}>
                Done
              </button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
