/**
 * "Get Started" widget — a compact progress card on every dashboard that opens
 * the role-specific onboarding checklist: the set-up tasks that make a profile
 * complete, plus the short explanations of how Loqal works. Finished items are
 * ticked with a green circle and stay visible, so people can see what is left.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Rocket, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useLeads } from "@/lib/leads";
import { usePartnerRequests } from "@/lib/partner-requests";
import { useEntityIntent } from "@/lib/entity-onboarding";
import { useGettingStarted } from "@/lib/getting-started";

type Item = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  /** Completed from real platform state (not something to "read"). */
  done: boolean;
  /** Informational item: reading it completes it. */
  info?: boolean;
  to?: string;
  actionLabel?: string;
};

export function GetStartedCard({ className = "" }: { className?: string }) {
  const { user } = useAuth();
  const { leadsForClient } = useLeads();
  const { requests } = usePartnerRequests();
  const { intent } = useEntityIntent(user?.email);
  const { read, markRead, dismiss, dismissed } = useGettingStarted(user?.email);
  const [open, setOpen] = useState(false);

  const items = useMemo<Item[]>(() => {
    if (!user) return [];
    const email = user.email.toLowerCase();

    if (user.role === "partner") {
      const req = requests.find((r) => (r.email ?? "").toLowerCase() === email);
      const licenceDocs =
        (req?.verificationDocs?.length ?? 0) > 0 || Boolean(req?.realtorVerification);
      return [
        {
          id: "p-registration",
          title: "Submit your partner registration",
          desc: "Company details, licences and contacts — reviewed by the Loqal team.",
          icon: "🤝",
          done: Boolean(req),
          to: "/partner-access",
          actionLabel: "Open registration",
        },
        {
          id: "p-verification",
          title: "Identity & licence verification",
          desc: "Upload your ID document and a licence copy for every state you work in.",
          icon: "🪪",
          done: licenceDocs,
          to: "/profile",
          actionLabel: "Open my profile",
        },
        {
          id: "p-agreement",
          title: "Sign the Loqal partner agreement",
          desc: "Your cooperation terms with Loqal — signed once, countersigned by us.",
          icon: "✍️",
          done: Boolean(req?.agreementSignedAt),
          to: "/profile",
          actionLabel: "Open agreement",
        },
        {
          id: "p-manager",
          title: "Meet your Loqal manager",
          desc: "Every partner has a named manager who assigns work and answers questions.",
          icon: "👤",
          done: read.has("p-manager"),
          info: true,
        },
        {
          id: "p-privacy",
          title: "How buyer files and client privacy work",
          desc: "Clients are shown by first name and internal Loqal number; contact details stay with Loqal.",
          icon: "🔒",
          done: read.has("p-privacy"),
          info: true,
        },
        {
          id: "p-requests",
          title: "Requests & correspondence with Loqal",
          desc: "Document requests, information requests and video calls all live in your profile.",
          icon: "💬",
          done: read.has("p-requests"),
          info: true,
          to: "/profile",
          actionLabel: "Open my profile",
        },
        {
          id: "p-calendar",
          title: "Connect your calendar",
          desc: "Link Google Calendar so client calls and viewings land straight in your agenda.",
          icon: "🗓",
          done: read.has("p-calendar"),
          info: true,
        },
      ];
    }

    if (user.role === "admin") {
      return [
        {
          id: "a-queue",
          title: "Review the partner registration queue",
          desc: "Assign a Loqal reviewer, request documents and approve new partners.",
          icon: "📋",
          done: read.has("a-queue"),
          info: true,
          to: "/admin-partner-requests",
          actionLabel: "Open queue",
        },
        {
          id: "a-people",
          title: "Get to know People",
          desc: "Clients, corporates and partners with their filters, profiles and activity history.",
          icon: "👥",
          done: read.has("a-people"),
          info: true,
          to: "/admin",
          actionLabel: "Open admin",
        },
        {
          id: "a-cases",
          title: "Cases and entity set-ups",
          desc: "Purchase files, company formation requests and the tasks Loqal owns.",
          icon: "🏢",
          done: read.has("a-cases"),
          info: true,
        },
      ];
    }

    // Clients and corporate clients
    const leads = leadsForClient(user.email);
    const mp = user.mortgageProfile;
    /* An identity document may have been attached to the profile itself or to a
     * submitted pre-approval application — both count. A visa copy is a
     * separate requirement and never completes the identity item. */
    const idDone =
      (mp?.idDocuments?.length ?? 0) > 0 ||
      leads.some((l) => (l.profile?.idDocuments?.length ?? 0) > 0);
    const clientItems: Item[] = [
      {
        id: "c-details",
        title: "Confirm your contact details",
        desc: "Your registered name, e-mail and phone number — used on every document.",
        icon: "📇",
        done: Boolean(user.firstName && user.phone),
        to: "/settings",
        actionLabel: "Open settings",
      },
      {
        id: "c-profile",
        title: "Complete your profile & financial data",
        desc: "Address history, income, assets and liabilities — the basis of every estimate.",
        icon: "📄",
        done: Boolean(mp?.submittedAt),
        to: "/profile",
        actionLabel: "Open my profile",
      },
      {
        id: "c-identity",
        title: "Upload your identity document",
        desc: "Passport or ID card (plus a visa copy where it applies).",
        icon: "🪪",
        done: idDone,
        to: "/profile",
        actionLabel: "Upload",
      },
      {
        id: "c-preapproval",
        title: "Get your mortgage pre-approval",
        desc: "One guided questionnaire; our lending partners revert within 48 hours.",
        icon: "🏦",
        done: leads.length > 0,
        to: "/marketplace",
        actionLabel: "Find a property",
      },
    ];

    if (!user.usPerson) {
      clientItems.push({
        id: "c-entity",
        title: "Learn about holding property through a US entity",
        desc: "Why foreign nationals hold property in an LLC or trust — and how Loqal sets it up.",
        icon: "🏢",
        done:
          Boolean(intent?.entityProvidedAt ?? intent?.supportRequestedAt) || read.has("c-entity"),
        info: true,
        to: "/entity-structure-faq",
        actionLabel: "Learn more",
      });
    }

    clientItems.push(
      {
        id: "c-fee",
        title: "How the 3% buyer's agent fee works",
        desc: "What your Loqal realtor partner does for you and how seller credits can cover the fee.",
        icon: "🤝",
        done: read.has("c-fee"),
        info: true,
        to: "/faq",
        actionLabel: "Read",
      },
      {
        id: "c-team",
        title: "Meet your Loqal team",
        desc: "Your lender, your buyer's agent and your Loqal contact — all reachable from the dashboard.",
        icon: "👥",
        done: read.has("c-team"),
        info: true,
      },
      {
        id: "c-documents",
        title: "Keep your documents in one place",
        desc: "Everything you upload or sign is stored securely in Documents.",
        icon: "🗂",
        done: read.has("c-documents"),
        info: true,
        to: "/documents",
        actionLabel: "Open documents",
      },
    );

    return clientItems;
  }, [user, requests, leadsForClient, intent, read]);

  if (!user || dismissed || items.length === 0) return null;

  const completed = items.filter((i) => i.done).length;
  const pct = Math.round((completed / items.length) * 100);
  const next = items.find((i) => !i.done);
  const allDone = !next;

  return (
    <>
      <section
        className={`relative rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] ${className}`}
      >
        <button
          type="button"
          aria-label="Hide Get Started"
          onClick={dismiss}
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full pr-8 text-left"
          aria-label="Open Get Started checklist"
        >
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
              <Rocket className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold text-foreground">Get Started</span>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${allDone ? "bg-success" : "bg-brand"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">{pct}%</span>
          </div>

          <div className="mt-2 text-[13px]">
            {allDone ? (
              <span className="font-semibold text-success">All set — your profile is complete</span>
            ) : (
              <>
                <span className="font-semibold text-foreground">{next.title}</span>
                <span className="text-muted-foreground"> · In progress</span>
              </>
            )}
          </div>
        </button>
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-brand" /> Get Started
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${allDone ? "bg-success" : "bg-brand"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">
              {completed}/{items.length}
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            Set-up tasks and the key things to know on Loqal. Items tick themselves off as you go.
          </p>

          <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex items-start gap-3 rounded-lg border p-3 ${
                  item.done ? "border-border bg-muted/40" : "border-border bg-card"
                }`}
              >
                <span
                  aria-hidden
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${
                    item.done ? "bg-success text-background" : "bg-brand-tint text-brand"
                  }`}
                >
                  {item.done ? <Check className="h-4 w-4" /> : item.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-sm font-semibold ${
                      item.done ? "text-muted-foreground" : "text-foreground"
                    }`}
                  >
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{item.desc}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {item.to ? (
                      <Link
                        to={item.to as "/profile"}
                        onClick={() => {
                          if (item.info) markRead(item.id);
                          setOpen(false);
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint hover:text-brand"
                      >
                        {item.actionLabel ?? "Open"}
                      </Link>
                    ) : null}
                    {item.info && !item.done ? (
                      <button
                        type="button"
                        onClick={() => markRead(item.id)}
                        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
                      >
                        Mark as read
                      </button>
                    ) : null}
                    {item.done ? (
                      <span className="text-xs font-semibold text-success">Completed</span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
