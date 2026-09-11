/**
 * Header notification centre for every audience (client, partner, admin).
 * Most notifications are derived from platform state here — pending
 * pre-approval answers (with the 1/3/7/14/30/60/75-day reminder ladder,
 * e-mailed from day 3), unanswered information requests, visa validity
 * windows, expiring realtor licences, pending partner approvals and
 * agreements to countersign. Clicking a notification opens the page it
 * belongs to.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { openDeepLink } from "@/lib/deep-link";
import { useAuth, PARTNER_LABEL } from "@/lib/auth";
import { offerReminders, pendingOfferDecision, leadState, useLeads } from "@/lib/leads";
import { useBuyerProcess } from "@/lib/buyer-process";
import { usePartnerRequests } from "@/lib/partner-requests";
import { useRealtors } from "@/lib/realtors";
import { useLenderTeam } from "@/lib/lender-team";
import { useMortgageDrafts } from "@/lib/mortgage-draft";
import {
  clearRequestOpenedAt,
  documentReminders,
  documentNoticeDue,
  outstandingDocumentRequests,
  requestOpenedAt,
} from "@/lib/document-requests";
import {
  completeNotifications,
  pruneDerived,
  syncNotifications,
  useNotifications,
  type AppNotification,
} from "@/lib/notifications";
import { clientDisplayForPartner } from "@/lib/user-id";
import { formatDateTime, usDateToIso } from "@/lib/dates";

type Draft = Omit<AppNotification, "createdAt"> & { createdAt?: string | undefined };

const DAY = 24 * 60 * 60 * 1000;
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);

const SEVERITY_DOT: Record<AppNotification["severity"], string> = {
  info: "bg-brand",
  warning: "bg-gold",
  critical: "bg-destructive",
};

/** Derive every state-based notification for the signed-in user (and admins). */
function useDerivedNotifications() {
  const { user } = useAuth();
  const { leads, ready: leadsReady } = useLeads();
  const proc = useBuyerProcess();
  const { requests } = usePartnerRequests();
  const { realtors } = useRealtors();
  const { drafts, clearDraft } = useMortgageDrafts();
  const { scopedStates } = useLenderTeam();

  const email = user?.email.toLowerCase() ?? "";
  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!user || !leadsReady) return;
    const list: Draft[] = [];
    const completedIds: string[] = [];
    const now = Date.now();

    /* ------------------------------ client side ------------------------------ */
    const myLeads = leads.filter((l) => l.clientEmail.toLowerCase() === email);
    for (const lead of myLeads) {
      const href = `/property/${lead.propertyId}`;
      // Feedback-related alerts open the pre-approval pop-up directly.
      const feedbackHref = `${href}?open=feedback`;

      if (lead.assignedAt && lead.status !== "annulled") {
        list.push({
          id: `assigned-${lead.id}-${lead.assignedAt}`,
          to: email,
          title: "Your pre-approval was assigned to a loan processor",
          body: `${lead.propertyLabel} — a licensed loan processor is now reviewing your application.`,
          href: feedbackHref,
          severity: "info",
          createdAt: lead.assignedAt,
        });
      }



      if (pendingOfferDecision(lead)) {
        list.push({
          id: `offer-${lead.id}`,
          to: email,
          title: "Your pre-approval terms are ready",
          body: `${lead.propertyLabel} — review the lender's terms and tell us whether you continue.`,
          href: feedbackHref,
          severity: "warning",
          createdAt: lead.terms?.issuedAt,
        });
        for (const r of offerReminders(lead)) {
          if (!r.due) continue;
          list.push({
            id: `offer-rem-${lead.id}-${r.day}`,
            to: email,
            title: `Reminder: your pre-approval terms are waiting (day ${r.day})`,
            body: "The lender's offer on your file still needs your answer.",
            href: feedbackHref,
            severity: r.day >= 14 ? "critical" : "warning",
            emailCopy: r.email,
            createdAt: r.dueAt,
          });
        }
      } else if (lead.clientDecision) {
        completedIds.push(`offer-${lead.id}`);
      }

      for (const r of lead.infoRequests) {
        if (r.answeredAt) {
          completedIds.push(`inforeq-${r.id}`);
          continue;
        }
        list.push({
          id: `inforeq-${r.id}`,
          to: email,
          title: "The lender requested more information",
          body: r.question,
          href: feedbackHref,
          severity: "warning",
          createdAt: r.requestedAt,
        });
      }

      /* Terms accepted but the buyer's-agent setup was never finished — remind
       * the client to pick up exactly where they left off. Nothing is shown the
       * moment they accept the terms: the first notice appears 2 hours later,
       * then the standard reminder ladder (3h, 24h, 3d, 7d, …) takes over. */
      if (
        lead.clientDecision === "accepted" &&
        lead.status !== "annulled" &&
        !lead.buyerAgent?.representation
      ) {
        const since = lead.buyerAgent?.agreedAt ?? lead.clientDecisionAt;
        if (since && documentNoticeDue(since, new Date(now))) {
          list.push({
            id: `agentsetup-${lead.id}`,
            to: email,
            title: "Finish setting up your buyer's agent",
            body: `${lead.propertyLabel} — choose how you want to work with your agent and how to start. Your answers so far are saved.`,
            href: `/property/${lead.propertyId}?open=agent`,
            severity: "warning",
            createdAt: since,
          });
          for (const rem of documentReminders(since, new Date(now))) {
            if (!rem.due) continue;
            list.push({
              id: `agentsetup-rem-${lead.id}-${rem.hours}`,
              to: email,
              title: `Reminder: finish setting up your buyer's agent (${rem.label})`,
              body: `${lead.propertyLabel} — your answers so far are saved; continue where you left off.`,
              href: `/property/${lead.propertyId}?open=agent`,
              severity: rem.hours >= 336 ? "critical" : "warning",
              emailCopy: rem.email,
              createdAt: rem.dueAt,
            });
          }
        }
      } else if (lead.buyerAgent?.representation) {
        completedIds.push(`agentsetup-${lead.id}`);
      }

      const photo = proc.photos[lead.id];
      if (photo?.status === "delivered") {
        list.push({
          id: `photos-${lead.id}-${photo.deliveredAt}`,
          to: email,
          title: "Fresh property photos and the agent's recommendations arrived",
          body: lead.propertyLabel,
          href,
          severity: "info",
          createdAt: photo.deliveredAt,
        });
      }

      for (const b of proc.bookings) {
        if (b.leadId !== lead.id) continue;
        if (b.status === "confirmed" && b.kind !== "intro_call" && !b.endedAt) {
          list.push({
            id: `call-${b.id}`,
            to: email,
            title:
              b.kind === "video_tour"
                ? "Your live video tour is confirmed"
                : "Your in-person visit is confirmed",
            body: `${lead.propertyLabel} — ${formatDateTime(b.startAt)}. Tap to see the meeting link.`,
            href: `${href}?open=call&focus=${b.id}`,
            severity: "info",
            createdAt: b.confirmedAt,
          });
          completedIds.push(`altslots-${b.id}`);
        }
        /* The agent could not make the buyer's times work and proposed
           alternatives — the buyer now has to answer. */
        if (b.status === "proposed" && b.proposedBy === "agent") {
          list.push({
            id: `altslots-${b.id}`,
            to: email,
            title: "Your agent proposed other times",
            body: `${lead.propertyLabel} — confirm one of the proposed times or reply with your own.`,
            href: `${href}?open=agenttimes&focus=${b.id}`,
            severity: "warning",
          });
        }
      }
    }

    /* ----------------------- visa & document follow-ups ----------------------- */
    const p = user.mortgageProfile;
    if (p) {
      const rawVisa = p.visaValidUntil ?? "";
      const visaIso = usDateToIso(rawVisa) || (/^\d{4}-\d{2}-\d{2}/.test(rawVisa) ? rawVisa.slice(0, 10) : "");
      if (!user.usPerson && visaIso) {
        const left = daysLeft(visaIso);
        if (left < 0) {
          list.push({
            id: `visa-expired-${email}`,
            to: email,
            title: "Your visa has expired — please upload an updated document",
            href: "/profile?doc=visaDocuments",
            severity: "critical",
            emailCopy: true,
          });
        } else if (left <= 3) {
          list.push({
            id: `visa-exp3-${email}`,
            to: email,
            title: `Your visa expires in ${left} day${left === 1 ? "" : "s"}`,
            body: "Upload the renewed document so your file stays active.",
            href: "/profile?doc=visaDocuments",
            severity: "critical",
            emailCopy: true,
          });
        }
        // Mortgage closings require ≥3 months of visa validity past closing.
        const tiers: [number, string][] = [
          [97, "7 days"],
          [105, "15 days"],
          [120, "30 days"],
        ];
        if (left >= 0 && left <= 90) {
          list.push({
            id: `visa3m-now-${email}`,
            to: email,
            title: "Visa validity dropped below the 3-month pre-closing requirement",
            body: "Mortgage closing requires your visa to be valid at least 3 months beyond it. Please renew and upload the new document.",
            href: "/profile?doc=visaDocuments",
            severity: "critical",
            emailCopy: true,
          });
        } else {
          for (const [threshold, label] of tiers) {
            if (left > 90 && left <= threshold) {
              list.push({
                id: `visa3m-${threshold}-${email}`,
                to: email,
                title: `${label} left to keep the 3-month visa window for closing`,
                body: `Your visa is currently valid until ${formatDateTime(visaIso).split(",")[0]}. Renew it in time — closings require 3 months of remaining validity.`,
                href: "/profile?doc=visaDocuments",
                severity: "warning",
              });
              break;
            }
          }
        }
      }

      /* One notification per outstanding document request — each is its own
       * upload form waiting under "Unfinished forms" in My Profile. */
      const outstanding = outstandingDocumentRequests(user, p);
      for (const request of outstanding) {
        const key = `doc-${request.kind}-${email}`;
        const since = requestOpenedAt(key);
        /* Nothing is announced for the first 2 hours after the form is done. */
        if (!documentNoticeDue(since, new Date(now))) continue;
        list.push({
          id: key,
          to: email,
          title: `${request.title} still missing`,
          body: `${request.description} ${request.reason}`,
          href: `/profile?doc=${request.kind}`,
          severity: "warning",
          createdAt: since,
        });
        for (const r of documentReminders(since, new Date(now))) {
          if (!r.due) continue;
          list.push({
            id: `${key}-rem-${r.hours}`,
            to: email,
            title: `Reminder: ${request.title.toLowerCase()} still needed (${r.label})`,
            body: request.description,
            href: `/profile?doc=${request.kind}`,
            severity: r.hours >= 168 ? "critical" : "warning",
            emailCopy: r.email,
            createdAt: r.dueAt,
          });
        }
      }
      for (const kind of ["idDocuments", "visaDocuments", "bankruptcyDocuments"] as const) {
        if (outstanding.some((r) => r.kind === kind)) continue;
        const key = `doc-${kind}-${email}`;
        /* The client uploaded it themselves — no "received" notification. */
        completedIds.push(key);
        clearRequestOpenedAt(key);
      }
    }

    const submittedPropertyIds = new Set(
      myLeads.filter((lead) => lead.status !== "annulled").map((lead) => lead.propertyId),
    );
    const hasSubmittedPreApproval =
      Boolean(user.mortgageProfile?.submittedAt) || submittedPropertyIds.size > 0;
    for (const d of drafts(email)) {
      /* A browser draft can survive an older questionnaire submission. The
       * submitted lead is authoritative: never turn that stale draft back
       * into a new pre-approval task. Complete any notification already
       * created for it without changing its original date or order. */
      if (
        submittedPropertyIds.has(d.propertyId) ||
        (d.propertyId === 0 && hasSubmittedPreApproval)
      ) {
        completedIds.push(`draft-${d.propertyId}`);
        clearDraft(email, d.propertyId);
        continue;
      }
      if (d.submitted || d.completion >= 100) continue;
      list.push({
        id: `draft-${d.propertyId}`,
        to: email,
        title: "Unfinished pre-approval questionnaire",
        body: `${d.propertyLabel ?? "Mortgage questionnaire"} — ${d.completion}% complete.`,
        href: d.propertyId
          ? `/property/${d.propertyId}?open=questionnaire`
          : "/profile?open=questionnaire",
        severity: "info",
        createdAt: d.updatedAt,
      });
    }

    /* ------------------------------ realtor side ------------------------------ */
    const seat = realtors.find((r) => r.email.toLowerCase() === email);
    if (seat) {
      for (const lic of seat.licenses) {
        const left = daysLeft(lic.validUntil);
        if (left < 0) {
          list.push({
            id: `lic-exp-${seat.id}-${lic.state}`,
            to: email,
            title: `Your ${lic.state} real estate licence has expired`,
            body: `Renew the ${lic.state} licence and enter the new number and validity — only this state is affected.`,
            href: `/profile?open=licence-renewal&focus=${lic.state}`,
            severity: "critical",
            emailCopy: true,
          });
        } else if (left <= 15) {
          list.push({
            id: `lic-15-${seat.id}-${lic.state}`,
            to: email,
            title: `Your ${lic.state} licence expires in ${left} days`,
            body: `Renew the ${lic.state} licence and enter the new number and validity — your other licences stay as they are.`,
            href: `/profile?open=licence-renewal&focus=${lic.state}`,
            severity: "critical",
            emailCopy: true,
          });
        } else if (left <= 30) {
          list.push({
            id: `lic-30-${seat.id}-${lic.state}`,
            to: email,
            title: `Your ${lic.state} licence expires in ${left} days`,
            body: `Please plan the ${lic.state} renewal — you will be asked for the new number and validity date.`,
            href: `/profile?open=licence-renewal&focus=${lic.state}`,
            severity: "warning",
          });
        }
      }
      /* Licences that were renewed must not keep an expiry task alive. */
      for (const lic of seat.licenses) {
        if (daysLeft(lic.validUntil) > 30) {
          completedIds.push(
            `lic-exp-${seat.id}-${lic.state}`,
            `lic-15-${seat.id}-${lic.state}`,
            `lic-30-${seat.id}-${lic.state}`,
          );
        }
      }
      const myFiles = leads.filter((l) => l.buyerAgent?.agentId === seat.id);
      for (const lead of myFiles) {
        const photo = proc.photos[lead.id];
        if (photo && photo.status === "delivered")
          completedIds.push(`photoreq-${lead.id}-${photo.requestedAt}`);
        if (photo && photo.status !== "delivered") {
          list.push({
            id: `photoreq-${lead.id}-${photo.requestedAt}`,
            to: email,
            title: "Photo request — deliver within 3 days",
            body: lead.propertyLabel,
            href: `/partner?tab=buyers&focus=${lead.id}`,
            severity: photo.status === "delayed" ? "info" : "warning",
            createdAt: photo.requestedAt,
          });
        }
        const lastAction = (proc.actions[lead.id] ?? []).slice(-1)[0];
        if (lastAction) {
          list.push({
            id: `decision-${lastAction.id}`,
            to: email,
            title: `Buyer decision on ${lead.propertyLabel}`,
            href: `/partner?tab=buyers&focus=${lead.id}`,
            severity: "info",
            createdAt: lastAction.createdAt,
          });
        }
      }
      for (const b of proc.bookings) {
        if (b.realtorId !== seat.id && !myFiles.some((l) => l.id === b.leadId)) continue;
        /* Only the side that has to answer keeps an open task. Once a time is
           agreed — or the agent has replied with alternatives — the original
           request is marked completed in place. */
        const waitingForAgent = b.status === "proposed" && (b.proposedBy ?? "buyer") === "buyer";
        if (waitingForAgent) {
          list.push({
            id: `proposal-${b.id}`,
            to: email,
            title: b.kind === "video_tour" ? "Video tour times proposed" : "In-person visit times proposed",
            body: `${clientDisplayForPartner(b.clientName, leads.find((l) => l.id === b.leadId)?.clientEmail)} — ${b.propertyLabel}. Confirm one of the ranked times or propose your own.`,
            href: `/partner?tab=calendar&focus=${b.id}`,
            severity: "warning",
            createdAt: b.createdAt,
          });
        } else {
          completedIds.push(`proposal-${b.id}`);
        }
      }
    }

    completeNotifications(completedIds);
    if (list.length) syncNotifications(list);
    /* Anything under these prefixes that is no longer derived is stale (a
       renewed licence, a withdrawn request, an older app version) and must
       stop counting as an open task. */
    pruneDerived(
      email,
      [
        "assigned-",
        "offer-",
        "inforeq-",
        "agentsetup-",
        "photos-",
        "call-",
        "altslots-",
        "visa",
        "doc-",
        "draft-",
        "lic-",
        "photoreq-",
        "decision-",
        "proposal-",
      ],
      [...list.map((n) => n.id), ...completedIds],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, leadsReady, leads, proc, realtors, email]);

  /* -------------------------------- admin side ------------------------------
     Kept in its own effect: partner registrations and their correspondence are
     independent of client lead data, so admins must not wait for it to load. */
  useEffect(() => {
    if (!user || !isAdmin) return;
    const list: Draft[] = [];
    {
      for (const r of requests) {
        if (r.status === "pending") {
          list.push({
            id: `preq-${r.id}`,
            to: "admins",
            title: `New ${r.kind === "partner" ? "partner" : "corporate"} registration request`,
            body: `${r.companyName} — awaiting approval.`,
            href: `/admin-partner-requests?focus=${r.id}`,
            severity: "warning",
            createdAt: r.submittedAt,
          });
        }
        if (r.status === "approved" && r.agreementSignedAt && !r.agreementCountersignedAt) {
          list.push({
            id: `countersign-${r.id}`,
            to: "admins",
            title: "Partnership agreement awaiting Loqal countersignature",
            body: `${r.companyName} signed on ${formatDateTime(r.agreementSignedAt)}.`,
            href: `/admin-partner-requests?focus=${r.id}&open=profile`,
            severity: "warning",
            createdAt: r.agreementSignedAt,
          });
        }
        if (r.kyc) {
          list.push({
            id: `kyc-${r.id}`,
            to: "admins",
            title: "KYB questionnaire submitted",
            body: `${r.companyName} — director & shareholder information is ready for review.`,
            href: `/admin-partner-requests?focus=${r.id}&open=profile`,
            severity: "info",
            createdAt: r.kyc.submittedAt,
          });
        }
        /* The partner answered a follow-up Loqal raised — tell the reviewing
           Loqal manager (and the admin desk) so they can read the answer. */
        for (const a of r.adminRequests ?? []) {
          const who = `${r.firstName} ${r.lastName}`.trim();
          const type = r.kind === "corporate" ? "Corporate" : PARTNER_LABEL[r.partnerType ?? "other"];
          const reviewer = r.reviewerName ? ` — reviewer ${r.reviewerName}` : "";
          if (a.kind === "info" && a.answeredAt) {
            list.push({
              id: `areq-answered-${a.id}`,
              to: "admins",
              title: "Information request answered",
              body: `${who} · ${r.companyName} · ${type}${reviewer}. Open to read the answer${
                a.answerDocs?.length ? " and files" : ""
              }.`,
              href: `/admin-partner-requests?focus=${r.id}&open=correspondence&item=${a.id}`,
              severity: "info",
              createdAt: a.answeredAt,
            });
          }
          /* The partner picked a slot — the booking is automatic on both
             sides, so only Loqal needs to be told about it. */
          if (a.kind !== "info" && a.scheduledAt) {
            list.push({
              id: `areq-booked-${a.id}`,
              to: "admins",
              title: `Video call booked — ${formatDateTime(a.scheduledAt)}`,
              body: `${who} · ${r.companyName} · ${type}${reviewer} picked this slot. It is in your calendar${
                a.meetUrl ? " with the Meet link" : ""
              } — open to see the details.`,
              href: `/admin-partner-requests?focus=${r.id}&open=correspondence&item=${a.id}`,
              severity: "warning",
              createdAt: a.scheduledAt,
            });
          }
        }

      }
    }

    if (list.length) syncNotifications(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, requests, isAdmin]);

  /* Partner-side "agreement ready to sign" notices (addressed to the partner). */
  useEffect(() => {
    if (!user) return;
    const mine = requests.filter((r) => r.email.toLowerCase() === email);
    const list: Draft[] = [];
    for (const r of mine) {
      if (r.status === "approved" && !r.agreementSignedAt) {
        list.push({
          id: `sign-${r.id}`,
          to: email,
          title: "Your Loqal partnership agreement is ready to sign",
          body: "Sign it in your portal — Loqal countersigns right after.",
          href: "/profile?open=agreement",
          severity: "warning",
          createdAt: r.decidedAt ?? r.submittedAt,
        });
      }
      /* Documents Loqal is waiting for from a realtor partner. */
      const rv = r.realtorVerification;
      const isRealtor = r.partnerType === "realtor";
      if (isRealtor) {
        const idKey = `pdoc-identity-${r.id}`;
        const idSince = requestOpenedAt(idKey);
        if (!rv?.identityDoc && documentNoticeDue(idSince)) {
          const since = idSince;
          list.push({
            id: idKey,
            to: email,
            title: "Identity verification document needed",
            body: "Upload your driver's licence or passport in My profile.",
            href: "/profile?open=identity",
            severity: "warning",
            createdAt: since,
          });
          for (const rem of documentReminders(since)) {
            if (!rem.due) continue;
            list.push({
              id: `${idKey}-rem-${rem.hours}`,
              to: email,
              title: `Reminder: identity document still needed (${rem.label})`,
              body: "Upload your driver's licence or passport in My profile.",
              href: "/profile?open=identity",
              severity: rem.hours >= 168 ? "critical" : "warning",
              emailCopy: rem.email,
              createdAt: rem.dueAt,
            });
          }
        } else if (rv?.identityDoc) {
          /* The partner uploaded it themselves — no confirmation notification. */
          clearRequestOpenedAt(idKey);
        }

        const licKey = `pdoc-licences-${r.id}`;
        const licences = rv?.licenseDocs ?? [];
        const missing = licences.filter((l) => !l.doc);
        const licSince = requestOpenedAt(licKey);
        if (licences.length && missing.length && documentNoticeDue(licSince)) {
          const since = licSince;
          list.push({
            id: licKey,
            to: email,
            title: "State licence copies needed",
            body: `${missing.length} of ${licences.length} state(s) still need a copy.`,
            href: "/profile?open=licences",
            severity: "warning",
            createdAt: since,
          });
          for (const rem of documentReminders(since)) {
            if (!rem.due) continue;
            list.push({
              id: `${licKey}-rem-${rem.hours}`,
              to: email,
              title: `Reminder: state licence copies still needed (${rem.label})`,
              body: `${missing.length} of ${licences.length} state(s) still need a copy.`,
              href: "/profile?open=licences",
              severity: rem.hours >= 168 ? "critical" : "warning",
              emailCopy: rem.email,
              createdAt: rem.dueAt,
            });
          }
        } else if (licences.length && !missing.length) {
          /* Uploaded by the partner — no confirmation notification. */
          clearRequestOpenedAt(licKey);
        }
      }

      /* Follow-ups Loqal raised on this partner's registration. */
      for (const req of r.adminRequests ?? []) {
        const isInfo = req.kind === "info";
        const done = isInfo ? Boolean(req.answeredAt) : Boolean(req.scheduledAt);
        const href = `/profile?open=${isInfo ? "request" : "call"}&focus=${req.id}`;
        const title = isInfo
          ? "Loqal requested more information"
          : "Loqal requested a video call";
        const body = req.message.slice(0, 140) || "Open your profile to respond.";
        if (done) {
          /* Keep the original request notification in place (same id, same
             date, same position) and simply mark it completed — the partner
             answered or picked a slot themselves, and the booking confirms on
             both sides automatically, so no new notification is created. */
          clearRequestOpenedAt(`preq-${req.id}`);
          list.push({
            id: `preq-${req.id}`,
            to: email,
            title,
            body: isInfo
              ? body
              : `Booked for ${formatDateTime(req.scheduledAt!)}. Tap for the meeting link.`,
            href: isInfo
              ? `/profile?open=history&focus=${req.id}`
              : `/profile?open=call-details&focus=${req.id}`,
            severity: "info",
            completed: true,
            createdAt: req.requestedAt,
          });
          continue;
        }

        const since = requestOpenedAt(`preq-${req.id}`, req.requestedAt);
        list.push({
          id: `preq-${req.id}`,
          to: email,
          title,
          body,
          href,
          severity: "warning",
          createdAt: since,
        });
        for (const rem of documentReminders(since)) {
          if (!rem.due) continue;
          list.push({
            id: `preq-${req.id}-rem-${rem.hours}`,
            to: email,
            title: `Reminder: ${title.toLowerCase()} (${rem.label})`,
            body,
            href,
            severity: rem.hours >= 168 ? "critical" : "warning",
            emailCopy: rem.email,
            createdAt: rem.dueAt,
          });
        }
      }


      if (r.status === "approved" && r.agreementCountersignedAt) {
        list.push({
          id: `active-${r.id}`,
          to: email,
          title: "Your partnership is fully active 🎉",
          body: `${r.companyName} — the agreement is signed by both parties.`,
          href: "/partner?tab=home",
          severity: "info",
          createdAt: r.agreementCountersignedAt,
        });
      }
    }
    if (list.length) syncNotifications(list);
    pruneDerived(email, ["sign-", "pdoc-", "preq-", "active-"], list.map((n) => n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, requests, email]);

  /* ------------------------------- lender side ------------------------------
     A mortgage lender partner is told about every pre-approval inquiry routed
     to their desk (within their licensed state scope). Once the inquiry is
     picked up by someone on their team, the same notification is marked
     "Assigned" in place — same id, date and position in the list. */
  useEffect(() => {
    if (!user || !leadsReady) return;
    if (user.role !== "partner" || user.partnerType !== "lender") return;
    const list: Draft[] = [];
    for (const lead of leads) {
      if (lead.status === "annulled") continue;
      if (scopedStates && !scopedStates.includes(leadState(lead))) continue;
      const assigned = Boolean(lead.assignedToId);
      list.push({
        id: `lenderinq-${lead.id}`,
        to: email,
        title: "New pre-approval inquiry",
        body: `${clientDisplayForPartner(lead.clientName, lead.clientEmail)} · ${lead.propertyLabel}${
          assigned ? ` — assigned to ${lead.assignedToName ?? "your team"}.` : " — awaiting first review."
        }`,
        href: `/partner?tab=requests&focus=${lead.id}`,
        severity: assigned ? "info" : "warning",
        ...(assigned ? { badge: "Assigned" } : {}),
        createdAt: lead.submittedAt,
      });
    }
    if (list.length) syncNotifications(list);
    pruneDerived(email, ["lenderinq-"], list.map((n) => n.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.role, user?.partnerType, leads, leadsReady, scopedStates, email]);
}


export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const key = user?.email.toLowerCase();
  const own = useNotifications(key);
  const admins = useNotifications(user?.role === "admin" ? "admins" : undefined);

  useDerivedNotifications();

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const notifications = useMemo(() => {
    const map = new Map<string, AppNotification>();
    for (const n of [...own.notifications, ...admins.notifications]) map.set(n.id, n);
    return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [own.notifications, admins.notifications]);

  const unread = notifications.filter((n) => !n.readAt).length;

  if (!user) return null;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative rounded-full border border-border p-2 text-foreground transition-colors hover:bg-brand-tint"
      >
        <span className="text-base leading-none">🔔</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[380px] max-w-[92vw] overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              Notifications {unread ? `· ${unread} new` : ""}
            </span>
            {unread ? (
              <button
                type="button"
                onClick={() => {
                  own.markAllRead();
                  admins.markAllRead();
                }}
                className="text-xs font-semibold text-brand hover:underline"
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <ul className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing yet — platform updates, feedback and reminders land here.
              </li>
            ) : (
              notifications.slice(0, 40).map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      own.markRead(n.id);
                      admins.markRead(n.id);
                      setOpen(false);
                      if (n.href) openNotification(navigate, n.href);
                    }}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-tint ${
                      n.readAt ? "opacity-60" : ""
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEVERITY_DOT[n.severity]}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <span className="min-w-0 flex-1">{n.title}</span>
                        {n.completed ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" />
                            Completed
                          </span>
                        ) : n.badge ? (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-tint px-2 py-0.5 text-[11px] font-semibold text-brand">
                            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                            {n.badge}
                          </span>
                        ) : null}
                      </span>

                      {n.body ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {n.body}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-muted-foreground">
                        {formatDateTime(n.createdAt)}
                        {n.emailCopy ? " · also sent by e-mail" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Notifications deep-link with a query string so the target pop-up opens
 * itself. Shared with the rest of the app so repeat clicks always re-fire.
 */
function openNotification(
  navigate: ReturnType<typeof useNavigate>,
  href: string,
) {
  openDeepLink(navigate, href);
}
