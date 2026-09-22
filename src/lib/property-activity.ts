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
import { allProperties, formatPrice, type Property } from "@/data/properties";
import { formatDate } from "@/lib/dates";
import {
  usePropertyRequests,
  type ChangeRequest,
  type PurchaseRequest,
} from "@/lib/property-requests";
import { useAllFileChat, type FileMessage } from "@/lib/file-chat";
import { ENTITY_PATH_LABEL, useEntityPlans, type EntityPlan } from "@/lib/entity-structure";

const money = (n: number) => formatPrice(n);

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
  /** Deep link for the next action the client has to take, if any. */
  action?: { href: string; cta: string } | undefined;
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
  purchases: PurchaseRequest[],
  changes: ChangeRequest[],
  messages: FileMessage[],
  plan: EntityPlan | undefined,
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
        action: { href: `/property/${lead.propertyId}?open=feedback&view=deal`, cta: "Respond to lender" },
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
        : { href: `/property/${lead.propertyId}?open=feedback&view=deal`, cta: "Review terms and answer" },
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
        action: { href: `/property/${lead.propertyId}?view=deal`, cta: "Review photos and decide" },
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

  /* ------------------------- work with the buyer's agent -------------------
     Everything exchanged with the realtor on this property file: the request
     to proceed with a price and the agent's answer, property-change requests,
     messages both ways, and the purchase agreement. */
  const chatHref = `/property/${lead.propertyId}?open=chat&view=deal`;

  for (const p of purchases.filter((x) => x.leadId === lead.id)) {
    push(items, {
      at: p.createdAt,
      label:
        p.mode === "listing"
          ? "You asked to proceed at the listing price"
          : "You asked to proceed with a lower price",
      detail: `Offered ${money(p.offerPrice)}${
        p.mode === "lower" ? ` against the listing price of ${money(p.listingPrice)}` : ""
      }${p.buyerNote ? ` — ${p.buyerNote}` : ""}`,
      tone: p.status === "pending" ? "update" : "done",
    });
    if (p.status === "pending") {
      push(items, {
        at: p.createdAt,
        label: "Your agent is preparing a price opinion",
        detail: "They will either confirm your price for the seller or suggest a higher one.",
        tone: "update",
      });
    }
    if (p.status === "price_pushback" && p.respondedAt) {
      awaiting += 1;
      push(items, {
        at: p.respondedAt,
        label: "Your agent came back with a higher price",
        detail: `${p.agentSuggestedPrice ? `${money(p.agentSuggestedPrice)} — ` : ""}${
          p.agentNote ?? ""
        } Accept it or propose another price.`,
        tone: "pending",
        action: { href: chatHref, cta: "Accept or propose another price" },
      });
    }
    if (p.status === "buyer_raised" && p.raisedAt) {
      push(items, {
        at: p.raisedAt,
        label: "You proposed another price — waiting for your agent",
        detail: `${p.raisedPrice ? money(p.raisedPrice) : ""}${
          p.buyerCounterNote ? ` — ${p.buyerCounterNote}` : ""
        }`,
        tone: "update",
      });
    }
    if (p.status === "price_supported" && p.respondedAt) {
      push(items, {
        at: p.respondedAt,
        label: "Price confirmed — your agent is presenting it to the seller",
        detail: `${money(p.offerPrice)}${p.agentNote ? ` — ${p.agentNote}` : ""}`,
        tone: "done",
      });
      if (!plan?.path) {
        awaiting += 1;
        push(items, {
          at: p.respondedAt,
          label: "Tell us how the property will be held",
          detail: "Directly, or through a US company holding the property.",
          tone: "pending",
          action: {
            href: `/property/${lead.propertyId}?open=agreement&view=deal`,
            cta: "Continue",
          },
        });
      }
    }
    if (p.status === "withdrawn") {
      push(items, {
        at: p.respondedAt ?? p.createdAt,
        label: "You withdrew the purchase request",
        tone: "done",
      });
    }
  }

  if (plan) {
    if (plan.path) {
      push(items, {
        at: plan.updatedAt,
        label: `Ownership structure: ${ENTITY_PATH_LABEL[plan.path]}`,
        detail: plan.entityName || undefined,
        tone: "done",
      });
    }
    if (plan.termsProposedAt && !plan.termsConfirmedAt && !plan.termsChangeRequestedAt) {
      awaiting += 1;
      push(items, {
        at: plan.termsProposedAt,
        label: "Your agent proposed the purchase terms — your confirmation is needed",
        detail:
          "These terms go to the seller, who can confirm them or suggest changes. Once agreed, your agent uploads the agreement for signing.",
        tone: "pending",
        action: {
          href: `/property/${lead.propertyId}?open=agreement&view=deal`,
          cta: "Review and confirm the terms",
        },
      });
    }
    if (plan.termsChangeRequestedAt && !plan.termsConfirmedAt) {
      push(items, {
        at: plan.termsChangeRequestedAt,
        label: "You asked your agent to change the proposed terms",
        detail: plan.termsChangeNote || undefined,
        tone: "update",
      });
    }
    if (plan.termsConfirmedAt) {
      push(items, {
        at: plan.termsConfirmedAt,
        label: "You confirmed the purchase terms — they go to the seller",
        tone: "done",
      });
    }
  }

  for (const c of changes.filter((x) => x.leadId === lead.id)) {
    push(items, {
      at: c.createdAt,
      label:
        c.kind === "buyer_picked"
          ? "You chose another property"
          : "You asked your agent for other property options",
      detail: `${c.pickedPropertyLabel ? `${c.pickedPropertyLabel} — ` : ""}${c.reason}`,
      tone: c.status === "pending" ? "update" : "done",
    });
    if (c.status === "acknowledged" && c.respondedAt) {
      push(items, {
        at: c.respondedAt,
        label: "Your agent picked up your property change",
        detail: c.agentNote || undefined,
        tone: "done",
      });
    }
  }

  for (const m of messages.filter((x) => x.leadId === lead.id)) {
    if (m.from === "client") {
      push(items, {
        at: m.createdAt,
        label: "You messaged your buyer's agent",
        detail: m.body,
        tone: "done",
      });
      continue;
    }
    const isRequest = m.kind === "info_request";
    if (isRequest && !m.readAt) awaiting += 1;
    push(items, {
      at: m.createdAt,
      label: isRequest
        ? "Your agent asked you for information"
        : "Your buyer's agent sent you a message",
      detail: m.body,
      tone: isRequest && !m.readAt ? "pending" : "done",
      action:
        isRequest && !m.readAt ? { href: chatHref, cta: "Open the message" } : undefined,
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
    action: items.find((i) => i.tone === "pending" && i.action)?.action,
  };
}

/** All properties the signed-in client has an active process on, newest first. */
export function useClientPropertyActivity(): PropertyActivity[] {
  const { user } = useAuth();
  const { leadsForClient, ready } = useLeads();
  const { photos, bookings, actions } = useBuyerProcess();
  const { purchases, changes } = usePropertyRequests();
  const { messages } = useAllFileChat();
  const { plans } = useEntityPlans();

  return useMemo(() => {
    if (!ready || !user?.email) return [];
    const leads = leadsForClient(user.email);
    return leads
      .map((lead) =>
        buildActivity(
          lead,
          photos,
          bookings,
          actions,
          purchases,
          changes,
          messages,
          plans.find((p) => p.leadId === lead.id),
        ),
      )
      .sort((a, b) => {
        if (a.awaitingClient !== b.awaitingClient) return b.awaitingClient - a.awaitingClient;
        return new Date(b.items[0]?.at ?? 0).getTime() - new Date(a.items[0]?.at ?? 0).getTime();
      });
  }, [
    ready,
    user?.email,
    leadsForClient,
    photos,
    bookings,
    actions,
    purchases,
    changes,
    messages,
    plans,
  ]);
}
