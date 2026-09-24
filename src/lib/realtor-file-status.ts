/**
 * Single source of truth for "where does this buyer file stand, and does the
 * buyer's agent have something to do?" — used by the buyer-file list, the
 * expanded file and the realtor dashboard brief.
 */
import type { MortgageLead } from "@/lib/leads";
import type { EntityPlan } from "@/lib/entity-structure";
import type { ChangeRequest, PurchaseRequest } from "@/lib/property-requests";

export type RealtorFileTab = "overview" | "requests" | "visits" | "messages" | "activity";

export type RealtorFileStatus = {
  /** Short status chip text. */
  label: string;
  /** action = realtor must act; waiting = on buyer/seller; info = progressing. */
  tone: "action" | "waiting" | "info" | "done";
  /** Present when the realtor has a task on this file. */
  task?: { title: string; detail: string; tab: RealtorFileTab } | undefined;
};

type Input = {
  lead: MortgageLead;
  purchase?: PurchaseRequest | undefined;
  change?: ChangeRequest | undefined;
  plan?: EntityPlan | undefined;
  photo?: { status: string; dueAt: string; etaAt?: string | undefined } | undefined;
  hasVideoTour: boolean;
  hasIntroCall: boolean;
  unread: number;
};

const act = (label: string, title: string, detail: string, tab: RealtorFileTab): RealtorFileStatus => ({
  label,
  tone: "action",
  task: { title, detail, tab },
});

export function realtorFileStatus(i: Input): RealtorFileStatus {
  const { lead, purchase, change, plan, photo } = i;
  const ba = lead.buyerAgent;

  if (purchase && (purchase.status === "pending" || purchase.status === "buyer_raised"))
    return act(
      "Price request to answer",
      "Answer the buyer's price request",
      "Confirm the price for the seller or suggest a higher one with your reasoning.",
      "requests",
    );
  if (change?.status === "pending")
    return act(
      "Property change to answer",
      "Respond to the property change request",
      "The buyer asked for another property option.",
      "requests",
    );

  if (plan?.agreementSignedAt) return { label: "Agreement signed", tone: "done" };
  if (plan?.agreementUploadedAt) return { label: "Awaiting buyer signature", tone: "waiting" };
  if (plan?.termsConfirmedAt)
    return act(
      "Upload the agreement",
      "Upload the purchase agreement",
      "The buyer confirmed the terms. Once the seller agrees, upload the agreement for signing.",
      "requests",
    );

  const changeAsked =
    plan?.termsChangeRequestedAt &&
    (!plan.termsProposedAt || plan.termsChangeRequestedAt >= plan.termsProposedAt);
  if (changeAsked)
    return act(
      "Revise the terms",
      "Revise the purchase terms",
      plan?.termsChangeNote
        ? `The buyer asked for changes: ${plan.termsChangeNote}`
        : "The buyer asked for changes before confirming.",
      "requests",
    );
  if (plan?.termsProposedAt) return { label: "Terms sent — awaiting buyer", tone: "waiting" };

  if (purchase?.status === "price_supported") {
    if (plan?.path)
      return act(
        "Provide terms to buyer",
        "Provide the purchase terms to the buyer",
        "Price is confirmed and the buyer chose how the property will be held. Propose the terms for their confirmation.",
        "requests",
      );
    return { label: "Buyer choosing ownership", tone: "waiting" };
  }
  if (purchase?.status === "price_pushback")
    return { label: "Awaiting buyer's price answer", tone: "waiting" };

  if (photo && photo.status !== "delivered")
    return act(
      "Property visit due",
      "Complete the property visit",
      "Upload updated photos and your comments for the buyer.",
      "visits",
    );
  if (ba?.kickoff === "video_showcase" && !i.hasVideoTour)
    return act("Video tour to arrange", "Arrange the video tour", "Choose a time and share it with the buyer.", "visits");
  if (i.unread)
    return act(
      "New message",
      "Reply to the buyer",
      `${i.unread} unread message${i.unread === 1 ? "" : "s"} on this file.`,
      "messages",
    );
  if (photo?.status === "delivered") return { label: "Buyer reviewing photos", tone: "waiting" };
  if ((ba?.kickoff === "live_call" || ba?.nextStep === "live_call") && !i.hasIntroCall)
    return { label: "Buyer to pick a call slot", tone: "waiting" };
  if (ba?.representation === "loqal_rep") return { label: "Loqal advocate file", tone: "info" };
  return { label: "Active buyer", tone: "info" };
}

export const STATUS_CLS: Record<RealtorFileStatus["tone"], string> = {
  action: "bg-warning/10 text-warning",
  waiting: "bg-brand-tint text-brand",
  info: "bg-muted text-muted-foreground",
  done: "bg-success/10 text-success",
};
