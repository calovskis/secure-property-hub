/**
 * "Your planned calls" for the client side.
 *
 * Shows every call the buyer has on the table for their own files: confirmed
 * intro calls, live video tours and in-person visits, plus times still waiting
 * for the agent's confirmation. Rendered on the client dashboard and in
 * My Profile so the appointment is never hidden inside a property page.
 */
import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useLeads } from "@/lib/leads";
import { usePartnerRequests } from "@/lib/partner-requests";
import { currentPartner } from "@/lib/partner-assignments";
import { useBuyerProcess, type CallBooking } from "@/lib/buyer-process";
import { formatDateTime } from "@/lib/dates";
import { partnerDisplayForClient } from "@/lib/user-id";

const KIND_LABEL: Record<CallBooking["kind"], string> = {
  intro_call: "Live call with your buyer's agent",
  video_tour: "Live video tour of the property",
  in_person_visit: "In-person property visit",
};

const KIND_ICON: Record<CallBooking["kind"], string> = {
  intro_call: "📞",
  video_tour: "🎥",
  in_person_visit: "🚗",
};

export function UpcomingCallsCard({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const { leads } = useLeads();
  const { requests } = usePartnerRequests();
  const { bookings } = useBuyerProcess();

  const email = user?.email.toLowerCase() ?? "";

  const rows = useMemo(() => {
    const mine = leads.filter(
      (l) => l.clientEmail.toLowerCase() === email && l.status !== "annulled",
    );
    const byId = new Map(mine.map((l) => [l.id, l]));
    const cutoff = Date.now() - 60 * 60 * 1000;
    return bookings
      .filter((b) => byId.has(b.leadId) && !b.endedAt)
      .filter((b) => b.status === "proposed" || new Date(b.startAt).getTime() > cutoff)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((b) => {
        const lead = byId.get(b.leadId)!;
        const partner = currentPartner(lead, "realtor", requests);
        const agent = partner
          ? partnerDisplayForClient(`${partner.firstName} ${partner.lastName}`.trim(), partner.email)
          : "your buyer's agent";
        return { booking: b, lead, agent };
      });
  }, [bookings, leads, requests, email]);

  if (!user || user.role !== "client") return null;
  if (!rows.length) return null;

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">Your planned calls</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Calls and viewings arranged for your properties.
      </p>

      <div className={`mt-4 grid gap-3 ${compact ? "" : "md:grid-cols-2"}`}>
        {rows.map(({ booking: b, lead, agent }) => {
          const proposed = b.status === "proposed";
          return (
            <div
              key={b.id}
              className={`rounded-lg border p-4 ${
                proposed ? "border-gold/40 bg-gold-tint/30" : "border-border"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span aria-hidden className="text-lg">
                  {KIND_ICON[b.kind]}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{KIND_LABEL[b.kind]}</div>
                  <div className="truncate text-xs text-muted-foreground">{b.propertyLabel}</div>
                </div>
              </div>

              <div className="mt-3 text-xs text-foreground">
                {proposed ? (
                  <>
                    <strong>Times proposed</strong> — waiting for {agent} to confirm.
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {(b.proposedSlots ?? [b.startAt]).map((s, i) => (
                        <li key={s}>
                          {i + 1}. {formatDateTime(s)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <>
                    <strong>{formatDateTime(b.startAt)}</strong> · 1 hour · with {agent}
                  </>
                )}
              </div>

              {!proposed ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.meetUrl ? (
                    <a
                      href={b.meetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
                    >
                      Join Google Meet
                    </a>
                  ) : (
                    <span className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      Meet link is being prepared
                    </span>
                  )}
                  {b.calendarLink ? (
                    <a
                      href={b.calendarLink}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand"
                    >
                      Add to my calendar
                    </a>
                  ) : null}
                </div>
              ) : null}

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
