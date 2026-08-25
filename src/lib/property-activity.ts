/**
 * Client-side view of everything ongoing on a property: the mortgage
 * pre-approval inquiry, lender correspondence, the buyer's agent engagement,
 * photo deliveries, calls/visits and the buyer's own decisions.
 *
 * Used to highlight "properties in action" inside the property search.
 */
import { useMemo } from "react";
import { useAuth } from "@/lib/auth";
import {
  CLIENT_DECISION_LABEL,
  KICKOFF_LABEL,
  LEAD_STATUS_LABEL,
  hasPricedOffer,
  useLeads,
  type MortgageLead,
} from "@/lib/leads";
import { CLIENT_ACTION_LABEL, useBuyerProcess } from "@/lib/buyer-process";
import { allProperties, type Property } from "@/data/properties";
import { formatDate } from "@/lib/dates";

export type ActivityTone = "pending" | "update" | "done";

export type ActivityItem = {
  at: string;
  label: string;
  detail?: string | undefined;
  tone: ActivityTone;
  /** Where the client has to go to deal with this item (pop-up deep link). */
  action?: { href: string; cta: string } | undefined;
};

export type PropertyActivity = {
  leadId: string;
  propertyId: number;
  property?: Property | undefined;
  propertyLabel: string;
  propertyPrice: number;
  /** One-line summary of where the property stands right now. */
  headline: string;
  /** Newest-first list of what happened / what is awaited. */
  items: ActivityItem[];
  /** Number of items waiting on the client. */
  awaitingClient: number;
};

function push(items: ActivityItem[], item: ActivityItem) {
  items.push(item);
}

/** Builds the client-facing activity trail for a single lead. */
function buildActivity(
  lead: MortgageLead,
  photos: ReturnType<typeof useBuyerProcess>["photos"],
  bookings: ReturnType<typeof useBuyerProcess>["bookings"],
  actions: ReturnType<typeof useBuyerProcess>["actions"],
): PropertyActivity {
  const items: ActivityItem[] = [];
  let awaiting = 0;

  push(items, {
    at: lead.submittedAt,
    label: "Mortgage pre-approval application submitted",
    detail: `Status: ${LEAD_STATUS_LABEL[lead.status]}`,
    tone: "done",
  });

  if (lead.annulledAt) {
    push(items, {
      at: lead.annulledAt,
      label: "Application cancelled by you",
      detail: "You can resubmit it at any time — your answers are saved.",
      tone: "update",
    });
  } else if (lead.assignedAt) {
    push(items, {
      at: lead.assignedAt,
      label: "Assigned to a licensed loan processor",
      detail: "Your file is under review.",
      tone: "update",
    });
  }

  for (const req of lead.infoRequests ?? []) {
    if (req.answeredAt) {
      push(items, {
        at: req.answeredAt,
        label: "You answered a lender information request",
        detail: req.question,
        tone: "done",
      });
    } else {
      awaiting += 1;
      push(items, {
        at: req.requestedAt,
        label: "Lender requested information from you",
        detail: req.needsDocument ? `${req.question} (document upload required)` : req.question,
        tone: "pending",
        action: { href: `/property/${lead.propertyId}?open=feedback`, cta: "Respond to lender" },
      });
    }
  }

  for (const q of lead.clientQuestions ?? []) {
    push(items, {
      at: q.askedAt,
      label: "You asked the lender a question",
      detail: q.text,
      tone: q.answer ? "done" : "update",
    });
    if (q.answer && q.answeredAt) {
      push(items, {
        at: q.answeredAt,
        label: "Lender answered your question",
        detail: q.answer,
        tone: "done",
      });
    }
  }

  if (hasPricedOffer(lead) && lead.terms) {
    push(items, {
      at: lead.terms.issuedAt,
      label: "Pre-approval terms received for this property",
      detail: `${lead.terms.ratePct}% over ${lead.terms.termYears} years, ${lead.terms.downPaymentPct}% down`,
      tone: lead.clientDecision ? "done" : "pending",
      action: lead.clientDecision
        ? undefined
        : { href: `/property/${lead.propertyId}?open=feedback`, cta: "Review terms and answer" },
    });
    if (!lead.clientDecision) awaiting += 1;
  }

  if (lead.clientDecision && lead.clientDecisionAt) {
    push(items, {
      at: lead.clientDecisionAt,
      label: `Your answer to the terms: ${CLIENT_DECISION_LABEL[lead.clientDecision]}`,
      tone: lead.clientDecision === "accepted" ? "done" : "update",
    });
  }

  const ba = lead.buyerAgent;
  if (ba) {
    push(items, {
      at: ba.agreedAt,
      label: `Buyer's agent agreement confirmed (${ba.feePct}% fee at closing)`,
      tone: "done",
    });
    if (ba.assignedAt) {
      push(items, {
        at: ba.assignedAt,
        label: "A Loqal realtor partner was assigned to you",
        tone: "done",
      });
    }
    if (ba.representation === "loqal_rep") {
      push(items, {
        at: ba.kickoffAt ?? ba.agreedAt,
        label: "Loqal personal advocate represents your interests",
        detail: ba.kickoffNotes || undefined,
        tone: "done",
      });
    }
    if (ba.kickoff) {
      push(items, {
        at: ba.kickoffAt ?? ba.agreedAt,
        label: `Requested: ${KICKOFF_LABEL[ba.kickoff]}`,
        detail: ba.kickoffNotes || undefined,
        tone: "update",
      });
    }
  }

  for (const b of bookings.filter((x) => x.leadId === lead.id)) {
    if (b.status === "confirmed") {
      push(items, {
        at: b.confirmedAt ?? b.createdAt,
        label: "Appointment confirmed with your buyer's agent",
        detail: formatDate(b.startAt),
        tone: "done",
      });
    } else {
      push(items, {
        at: b.createdAt,
        label: "You proposed times — awaiting the agent's confirmation",
        detail: b.note || undefined,
        tone: "update",
      });
    }
  }

  const delivery = photos[lead.id];
  if (delivery) {
    if (delivery.status === "delivered" && delivery.deliveredAt) {
      awaiting += 1;
      push(items, {
        at: delivery.deliveredAt,
        label: `Fresh photos delivered (${delivery.photos.length}) — your decision is awaited`,
        detail: delivery.comments || undefined,
        tone: "pending",
        action: { href: `/property/${lead.propertyId}`, cta: "Review photos and decide" },
      });
    } else if (delivery.status === "delayed") {
      push(items, {
        at: delivery.requestedAt,
        label: "Photo visit rescheduled by the agent",
        detail: delivery.delayReason
          ? `${delivery.delayReason}${delivery.etaAt ? ` — new date ${formatDate(delivery.etaAt)}` : ""}`
          : undefined,
        tone: "update",
      });
    } else {
      push(items, {
        at: delivery.requestedAt,
        label: "Agent is visiting to upload fresh photos",
        detail: `Due by ${formatDate(delivery.dueAt)}`,
        tone: "update",
      });
    }
  }

  for (const a of actions[lead.id] ?? []) {
    push(items, {
      at: a.createdAt,
      label: CLIENT_ACTION_LABEL[a.action],
      detail: a.details || undefined,
      tone: "done",
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const pending = items.find((i) => i.tone === "pending");
  const headline = lead.annulledAt
    ? "Application cancelled — you can resubmit"
    : pending
      ? pending.label
      : (items[0]?.label ?? "Application in progress");

  return {
    leadId: lead.id,
    propertyId: lead.propertyId,
    property: allProperties.find((p) => p.id === lead.propertyId),
    propertyLabel: lead.propertyLabel,
    propertyPrice: lead.propertyPrice,
    headline,
    items,
    awaitingClient: awaiting,
  };
}

/** All properties the signed-in client has an active process on, newest first. */
export function useClientPropertyActivity(): PropertyActivity[] {
  const { user } = useAuth();
  const { leadsForClient, ready } = useLeads();
  const { photos, bookings, actions } = useBuyerProcess();

  return useMemo(() => {
    if (!ready || !user?.email) return [];
    const leads = leadsForClient(user.email);
    return leads
      .map((lead) => buildActivity(lead, photos, bookings, actions))
      .sort((a, b) => {
        if (a.awaitingClient !== b.awaitingClient) return b.awaitingClient - a.awaitingClient;
        return new Date(b.items[0]?.at ?? 0).getTime() - new Date(a.items[0]?.at ?? 0).getTime();
      });
  }, [ready, user?.email, leadsForClient, photos, bookings, actions]);
}
