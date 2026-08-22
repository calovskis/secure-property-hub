import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeads, type MortgageLead } from "@/lib/leads";
import { useI18n } from "@/lib/i18n";

const btnPrimary =
  "rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft";
const btnGhost =
  "rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

type Step = "agree" | "next" | "done";

/**
 * Shown when the client chooses to continue with the lender's pre-approval
 * terms: first the buyer's agent agreement (3% fee at closing), then how the
 * client wants to start working with the assigned agent.
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
  const { agreeBuyerAgent, setBuyerAgentNextStep } = useLeads();
  const { lang } = useI18n();
  const [step, setStep] = useState<Step>("agree");

  function close() {
    setStep("agree");
    onOpenChange(false);
  }

  function agree() {
    agreeBuyerAgent(lead.id, [lang === "ru" ? "Russian" : "English"]);
    setStep("next");
  }

  function choose(nextStep: "live_call" | "start") {
    setBuyerAgentNextStep(lead.id, nextStep);
    setStep("done");
  }

  const agentName = lead.buyerAgent?.agentName;

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
                  <li>Guide you through offers, the prepurchase contract and closing.</li>
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

        {step === "next" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">How would you like to start?</DialogTitle>
              <DialogDescription>
                {agentName
                  ? `${agentName} has been assigned as your buyer's agent.`
                  : "We are matching you with the best available buyer's agent."}{" "}
                Choose how to kick off the cooperation.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => choose("live_call")}
                className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-brand hover:bg-brand-tint/40"
              >
                <div className="text-sm font-semibold text-foreground">
                  📞 Request a live call with your buyer's agent
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pre-discuss the process, your criteria and the timeline before any property work
                  starts. The agent will reach out to schedule.
                </p>
              </button>
              <button
                type="button"
                onClick={() => choose("start")}
                className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-brand hover:bg-brand-tint/40"
              >
                <div className="text-sm font-semibold text-foreground">
                  ⚡ No call needed — start right away
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your agent begins working on your brief immediately and coordinates everything in
                  writing.
                </p>
              </button>
            </div>
          </>
        ) : null}

        {step === "done" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-foreground">You're all set</DialogTitle>
              <DialogDescription>
                Your mortgage file is now open and your buyer's agent is on board.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-success/40 bg-success/5 p-4 text-sm text-muted-foreground">
              {agentName ? (
                <p>
                  <strong className="text-foreground">{agentName}</strong> is your buyer's agent
                  (fee 3% of the purchase price at closing).
                  {lead.buyerAgent?.nextStep === "live_call"
                    ? " Your live call request was sent — the agent will contact you to schedule it."
                    : " The agent starts working on your brief right away."}
                </p>
              ) : (
                <p>
                  We will notify you as soon as your buyer's agent is assigned. You can follow
                  everything on this property page and in My profile.
                </p>
              )}
              <p className="mt-2">
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
