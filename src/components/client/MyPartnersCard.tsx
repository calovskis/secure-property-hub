/**
 * "Your Loqal team" for the client dashboard.
 *
 * A client can have several partners working their file at once — a mortgage
 * lender and a buyer's agent — and, exactly like partners see their Loqal
 * manager, the client should always have a direct way to reach each of them.
 *
 * The card also carries the friendly note shown when a partner is replaced:
 * the notification about the change deep-links here with
 * `?open=partner-change&focus=<handover id>`, and the note explains in plain
 * words who now looks after the file and that nothing has to be repeated.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, ExternalLink, Headphones, Landmark, MessageSquareText, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useLeads, type MortgageLead } from "@/lib/leads";
import { usePartnerRequests } from "@/lib/partner-requests";
import {
  PARTNER_ROLE_LABEL,
  assignedPartner,
  useHandovers,
  type PartnerRole,
} from "@/lib/partner-assignments";
import { useDeepLinkAction } from "@/lib/deep-link";
import { formatDateTime } from "@/lib/dates";
import { firstNameOnly, partnerDisplayForClient } from "@/lib/user-id";
import { useRealtors } from "@/lib/realtors";
import { EntityManagerContact } from "@/components/client/EntityManagerContact";

const ROLE_ICON: Record<PartnerRole, typeof Landmark> = { lender: Landmark, realtor: UserRound };

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "L"
  );
}

type Seat = {
  key: string;
  role: PartnerRole;
  lead: MortgageLead;
  name: string;
  email?: string;
  company?: string;
};

export function MyPartnersCard() {
  const { user } = useAuth();
  const { leads } = useLeads();
  const { requests } = usePartnerRequests();
  const { realtors } = useRealtors();
  const { handovers } = useHandovers();
  const [noteId, setNoteId] = useState<string | null>(null);

  useDeepLinkAction("partner-change", (focus) => setNoteId(focus ?? null));

  const email = user?.email.toLowerCase() ?? "";

  const seats = useMemo<Seat[]>(() => {
    const mine = leads.filter(
      (l) => l.clientEmail.toLowerCase() === email && l.status !== "annulled",
    );
    const out: Seat[] = [];
    for (const lead of mine) {
      for (const role of ["lender", "realtor"] as PartnerRole[]) {
        const partner = assignedPartner(lead, role, requests);
        if (partner) {
          out.push({
            key: `${lead.id}-${role}`,
            role,
            lead,
            name: `${partner.firstName} ${partner.lastName}`.trim(),
            email: partner.email,
            company: partner.companyName,
          });
          continue;
        }
        if (role === "realtor" && lead.buyerAgent?.agentName) {
          const realtor = realtors.find((item) => item.id === lead.buyerAgent?.agentId);
          out.push({
            key: `${lead.id}-${role}`,
            role,
            lead,
            name: lead.buyerAgent.agentName,
            ...(realtor?.email ? { email: realtor.email } : {}),
          });
        }
        if (role === "lender" && (lead.lenderPartnerName || lead.terms?.lenderName)) {
          out.push({
            key: `${lead.id}-${role}`,
            role,
            lead,
            name: lead.lenderPartnerName ?? lead.terms?.lenderName ?? "Mortgage lender",
          });
        }
      }
    }
    return out;
  }, [leads, requests, realtors, email]);

  const change = noteId ? handovers.find((h) => h.id === noteId) : undefined;

  if (!user || user.role !== "client") return null;
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Your Loqal team</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Every active realtor and mortgage lender working on your files.
          </p>
        </div>
      </div>

      {change ? (
        <div className="mx-5 mt-4 rounded-lg border border-gold/40 bg-gold-tint/40 p-4">
          <h3 className="text-sm font-bold text-foreground">
            You have a new {PARTNER_ROLE_LABEL[change.role].toLowerCase()}
          </h3>
          <p className="mt-1 text-xs text-foreground">
            From now on <strong>{partnerDisplayForClient(change.toName, change.toEmail)}</strong>
            {change.toCompany ? ` (${change.toCompany})` : ""} looks after{" "}
            {change.propertyLabel}
            {change.fromName ? `, taking over from ${firstNameOnly(change.fromName)}` : ""}. They have already
            accepted your file and received the full history, so there is nothing for you to repeat
            or send again — everything continues exactly where it stopped.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Confirmed {change.respondedAt ? formatDateTime(change.respondedAt) : ""}. If anything
            feels unclear, your Loqal team is one message away.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/profile"
              search={{ focus: "correspondence" }}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
            >
              Message Loqal
            </Link>
            <button
              type="button"
              onClick={() => setNoteId(null)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 p-5 md:grid-cols-2">
        <EntityManagerContact variant="card" />
        {seats.map(({ key, role, lead, name, email: partnerEmail, company }) => {
          // Clients see first name + internal number only — never the family name.
          const person = partnerDisplayForClient(
            name,
            partnerEmail,
          );
          const RoleIcon = ROLE_ICON[role];
          return (
            <div key={key} className="flex min-h-48 flex-col rounded-lg border border-border bg-background/50 p-4 transition-colors hover:border-brand/30">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand ring-4 ring-card">
                  {initials(person)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-foreground">{person}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <RoleIcon className="size-3.5 shrink-0 text-brand" aria-hidden />
                    <span className="truncate">{PARTNER_ROLE_LABEL[role]}{company ? ` · ${company}` : ""}</span>
                  </div>
                </div>
                <span className="rounded bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">Active</span>
              </div>
              <div className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
                Working with you on <span className="font-medium text-foreground">{lead.propertyLabel}</span>
              </div>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                <Button asChild size="sm" variant="outline">
                  {role === "realtor" ? (
                    <Link to="/property/$propertyId/workspace" params={{ propertyId: String(lead.propertyId) }} search={{ open: "chat" } as never}>
                      <MessageSquareText aria-hidden /> Write
                    </Link>
                  ) : partnerEmail ? (
                    <a href={`mailto:${partnerEmail}?subject=${encodeURIComponent(`Loqal — ${lead.propertyLabel}`)}`}>
                      <MessageSquareText aria-hidden /> Write
                    </a>
                  ) : (
                    <Link to="/profile" search={{ focus: "correspondence" }}>
                      <MessageSquareText aria-hidden /> Write
                    </Link>
                  )}
                </Button>
                <Button asChild size="sm">
                  <Link
                    to="/property/$propertyId/workspace"
                    params={{ propertyId: String(lead.propertyId) }}
                    search={{ open: role === "realtor" ? "agent" : "feedback" } as never}
                  >
                    <CalendarPlus aria-hidden /> Request a call
                  </Link>
                </Button>
              </div>
              <Link
                to="/property/$propertyId/workspace"
                params={{ propertyId: String(lead.propertyId) }}
                className="mt-2 inline-flex text-[11px] font-semibold text-brand hover:underline"
              >
                Open the file <ExternalLink className="ml-1 size-3" aria-hidden />
              </Link>
            </div>
          );
        })}
        <div className="flex min-h-48 flex-col rounded-lg border border-border bg-background/50 p-4 transition-colors hover:border-brand/30">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-tint text-gold ring-4 ring-card">
              <Headphones className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">Loqal support</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Your concierge team</div>
            </div>
            <span className="rounded bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">Available</span>
          </div>
          <div className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
            Help with your profile, properties, partners, and next steps.
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
            <Button asChild size="sm" variant="outline">
              <Link to="/profile" search={{ focus: "correspondence" }}>
                <MessageSquareText aria-hidden /> Write
              </Link>
            </Button>
            <Button asChild size="sm">
              <a href="mailto:hello@loqal.com?subject=Call%20request%20from%20my%20Loqal%20dashboard">
                <CalendarPlus aria-hidden /> Request a call
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
