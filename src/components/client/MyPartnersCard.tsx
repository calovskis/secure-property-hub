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
import { useAuth } from "@/lib/auth";
import { useLeads, type MortgageLead } from "@/lib/leads";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import {
  PARTNER_ROLE_LABEL,
  currentPartner,
  useHandovers,
  type PartnerRole,
} from "@/lib/partner-assignments";
import { useDeepLinkAction } from "@/lib/deep-link";
import { formatDateTime } from "@/lib/dates";
import { firstNameOnly, partnerDisplayForClient } from "@/lib/user-id";

const ROLE_ICON: Record<PartnerRole, string> = { lender: "🏦", realtor: "🤝" };

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
  partner: PartnerRequest | undefined;
};

export function MyPartnersCard() {
  const { user } = useAuth();
  const { leads } = useLeads();
  const { requests } = usePartnerRequests();
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
        const partner = currentPartner(lead, role, requests);
        if (!partner) continue;
        out.push({ key: `${lead.id}-${role}`, role, lead, partner });
      }
    }
    return out;
  }, [leads, requests, email]);

  const change = noteId ? handovers.find((h) => h.id === noteId) : undefined;

  if (!user || user.role !== "client") return null;
  if (!seats.length && !change) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-foreground">Your Loqal team</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The partners working on your file — reach any of them directly, or through Loqal.
          </p>
        </div>
      </div>

      {change ? (
        <div className="mt-4 rounded-lg border border-gold/40 bg-gold-tint/40 p-4">
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

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {seats.map(({ key, role, lead, partner }) => {
          // Clients see first name + internal number only — never the family name.
          const person = partnerDisplayForClient(
            `${partner!.firstName} ${partner!.lastName}`.trim(),
            partner!.email,
          );
          const phone = partner!.phone || partner!.companyPhone || "";
          const mail = partner!.email;
          return (
            <div key={key} className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand">
                  {initials(person)}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">{person}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {ROLE_ICON[role]} {PARTNER_ROLE_LABEL[role]}
                    {partner!.companyName ? ` · ${partner!.companyName}` : ""}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground">{lead.propertyLabel}</div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={`mailto:${mail}?subject=${encodeURIComponent(
                    `Loqal — ${lead.propertyLabel}`,
                  )}`}
                  className="rounded-md bg-muted px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-brand-tint"
                >
                  Send e-mail
                </a>
                {phone ? (
                  <a
                    href={`tel:${phone.replace(/[^\d+]/g, "")}`}
                    className="rounded-md bg-muted px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-brand-tint"
                  >
                    Call
                  </a>
                ) : (
                  <Link
                    to="/profile"
                    search={{ focus: "correspondence" }}
                    className="rounded-md bg-muted px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-brand-tint"
                  >
                    Message Loqal
                  </Link>
                )}
              </div>
              <Link
                to="/property/$propertyId"
                params={{ propertyId: String(lead.propertyId) }}
                className="mt-2 inline-flex text-[11px] font-semibold text-brand hover:underline"
              >
                Open the file →
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
