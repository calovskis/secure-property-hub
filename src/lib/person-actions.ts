/**
 * "Active actions" per person for the Loqal admin console.
 *
 * Every open item on one profile in one list, split by who has to act:
 *  - `owner: "loqal"`  — Loqal staff must do it (verify licences, approve a
 *    registration, countersign the agreement, review a KYB questionnaire,
 *    decide a name change, assign a lender to a mortgage file).
 *  - `owner: "person"` — Loqal is waiting on the client or partner (sign the
 *    agreement, complete the KYB questionnaire, attach licence copies, answer
 *    an information request, decide on issued pre-approval terms).
 *
 * The same model powers the People list (rows with open actions are highlighted
 * and carry an Actions button) and the Active actions section on the profile.
 */
import type { PartnerRequest } from "@/lib/partner-requests";
import type { MortgageLead } from "@/lib/leads";
import { licenceRows, pendingVerifications } from "@/lib/licence-verification";
import { formatDate } from "@/lib/dates";

/** What the button on the action opens. */
export type PersonActionHandler =
  | "licences"
  | "countersign"
  | "registration"
  | "kyb"
  | "correspondence"
  | "properties"
  | "profile";

export type PersonAction = {
  id: string;
  owner: "loqal" | "person";
  title: string;
  detail: string;
  /** When the item started waiting. */
  since: string;
  /** Button label. */
  cta: string;
  handler: PersonActionHandler;
  urgent?: boolean;
};

const byOldest = (a: PersonAction, b: PersonAction) => a.since.localeCompare(b.since);

export function personActions({
  request,
  leads,
  name,
}: {
  request?: PartnerRequest | undefined;
  leads: MortgageLead[];
  name: string;
}): PersonAction[] {
  const out: PersonAction[] = [];
  const first = name.trim().split(/\s+/)[0] || name;

  if (request && request.status !== "declined") {
    const who = request.companyName || name;

    if (request.status === "pending")
      out.push({
        id: `approve-${request.id}`,
        owner: "loqal",
        title: "Approve the registration",
        detail: `${who} registered and is waiting for Loqal to approve or decline the application.`,
        since: request.submittedAt,
        cta: "Open the registration",
        handler: "registration",
        urgent: true,
      });

    const pendingLic = pendingVerifications(request);
    if (pendingLic.length)
      out.push({
        id: `licences-${request.id}`,
        owner: "loqal",
        title: `Verify ${pendingLic.length === 1 ? `the ${pendingLic[0]!.state} licence` : `${pendingLic.length} state licences`}`,
        detail: `${pendingLic
          .slice(0, 8)
          .map((l) => l.state)
          .join(", ")}${pendingLic.length > 8 ? ` and ${pendingLic.length - 8} more` : ""} · ${
          pendingLic.filter((l) => l.doc).length
        } with a copy on file. No cases are assigned in a state until it is verified.`,
        since:
          pendingLic
            .map((l) => l.pendingSince ?? l.uploadedAt ?? request.submittedAt)
            .sort()[0] ?? request.submittedAt,
        cta: "Verify the licences",
        handler: "licences",
        urgent: true,
      });

    if (request.status === "approved" && request.agreementSignedAt && !request.agreementCountersignedAt)
      out.push({
        id: `countersign-${request.id}`,
        owner: "loqal",
        title: "Countersign the partnership agreement",
        detail: `${who} signed on ${formatDate(request.agreementSignedAt)} — the partnership is active once Loqal countersigns.`,
        since: request.agreementSignedAt,
        cta: "Countersign",
        handler: "countersign",
        urgent: true,
      });

    if (request.kyc)
      out.push({
        id: `kyb-${request.id}`,
        owner: "loqal",
        title: "Review the KYB questionnaire",
        detail: "Director and shareholder information has been submitted and is ready for review.",
        since: request.kyc.submittedAt,
        cta: "Open the questionnaire",
        handler: "kyb",
      });

    for (const c of request.profileChangeRequests ?? [])
      if (c.status === "pending")
        out.push({
          id: `change-${c.id}`,
          owner: "loqal",
          title: `Decide the ${c.label.toLowerCase()} change`,
          detail: `${c.currentValue || "—"} → ${c.requestedValue} — approve or decline the change.`,
          since: c.requestedAt,
          cta: "Open the registration",
          handler: "registration",
        });

    for (const a of request.adminRequests ?? []) {
      if (a.kind === "info" && a.answeredAt && !a.answerReadAt)
        out.push({
          id: `answered-${a.id}`,
          owner: "loqal",
          title: "Read the answer to your information request",
          detail: `${first} replied${a.answerDocs?.length ? " and attached files" : ""}: “${a.message}”`,
          since: a.answeredAt,
          cta: "Read the answer",
          handler: "correspondence",
          marksReadRequestId: a.id,
        });
      if (a.kind === "info" && !a.answeredAt)
        out.push({
          id: `awaiting-info-${a.id}`,
          owner: "person",
          title: "Awaiting an answer to an information request",
          detail: `“${a.message}”${a.requiresDocument ? " — a document is required." : ""}`,
          since: a.requestedAt,
          cta: "Open the correspondence",
          handler: "correspondence",
        });
      if (a.kind === "call" && !a.scheduledAt)
        out.push({
          id: `awaiting-call-${a.id}`,
          owner: "person",
          title: "Awaiting a video call slot",
          detail: `${first} has not picked a slot yet: “${a.message}”`,
          since: a.requestedAt,
          cta: "Open the correspondence",
          handler: "correspondence",
        });
    }

    if (request.status === "approved" && !request.agreementSignedAt)
      out.push({
        id: `awaiting-sign-${request.id}`,
        owner: "person",
        title: "Awaiting the signed partnership agreement",
        detail: `${who} has been approved and can sign the Loqal partnership agreement in their portal.`,
        since: request.decidedAt ?? request.submittedAt,
        cta: "Open the profile",
        handler: "profile",
      });

    if (request.status === "approved" && !request.kyc && request.partnerType !== "realtor")
      out.push({
        id: `awaiting-kyb-${request.id}`,
        owner: "person",
        title: "Awaiting the KYB questionnaire",
        detail: "Director and shareholder information has not been submitted yet.",
        since: request.decidedAt ?? request.submittedAt,
        cta: "Open the profile",
        handler: "profile",
      });

    const rows = licenceRows(request);
    const missingCopies = rows.filter((l) => !l.doc);
    if (missingCopies.length)
      out.push({
        id: `awaiting-copies-${request.id}`,
        owner: "person",
        title: `Awaiting ${missingCopies.length} licence cop${missingCopies.length === 1 ? "y" : "ies"}`,
        detail: `${missingCopies
          .slice(0, 8)
          .map((l) => l.state)
          .join(", ")}${missingCopies.length > 8 ? ` and ${missingCopies.length - 8} more` : ""} — no copy on file yet.`,
        since: request.submittedAt,
        cta: "Open the licences",
        handler: "licences",
      });

    const infoAsked = rows.filter((l) => l.infoRequestedAt && !l.verifiedAt);
    if (infoAsked.length)
      out.push({
        id: `awaiting-licinfo-${request.id}`,
        owner: "person",
        title: "Awaiting more licence information",
        detail: `Loqal asked for more on ${infoAsked.map((l) => l.state).join(", ")}.`,
        since: infoAsked.map((l) => l.infoRequestedAt!).sort()[0]!,
        cta: "Open the licences",
        handler: "licences",
      });
  }

  /* ------------------------------- client files ---------------------------- */
  for (const lead of leads) {
    if (lead.status === "annulled" || lead.annulledAt) continue;

    if (!lead.lenderPartnerId && !lead.terms)
      out.push({
        id: `assign-${lead.id}`,
        owner: "loqal",
        title: "Assign a mortgage lender to the file",
        detail: `${lead.propertyLabel} — the pre-approval inquiry has no lending partner yet.`,
        since: lead.submittedAt,
        cta: "Open the file",
        handler: "properties",
        urgent: true,
      });

    for (const q of lead.clientQuestions ?? [])
      if (!q.answeredAt)
        out.push({
          id: `question-${lead.id}-${q.id}`,
          owner: "loqal",
          title: "Answer the client's question",
          detail: `${lead.propertyLabel}: “${q.text}”`,
          since: q.askedAt,
          cta: "Open the file",
          handler: "properties",
        });

    if (lead.terms && !lead.clientDecision)
      out.push({
        id: `awaiting-decision-${lead.id}`,
        owner: "person",
        title: "Awaiting the decision on the issued terms",
        detail: `${lead.propertyLabel} — terms were issued and ${first} has not answered yet.`,
        since: lead.terms.issuedAt ?? lead.submittedAt,
        cta: "Open the file",
        handler: "properties",
      });

    for (const r of lead.infoRequests ?? [])
      if (!r.answeredAt)
        out.push({
          id: `awaiting-docs-${lead.id}-${r.id}`,
          owner: "person",
          title: "Awaiting requested information",
          detail: `${lead.propertyLabel}: “${r.question}”`,
          since: r.requestedAt,
          cta: "Open the file",
          handler: "properties",
        });
  }

  return out.sort(byOldest);
}
