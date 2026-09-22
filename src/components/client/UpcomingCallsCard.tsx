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
import { CalendarDays, Clock3, MapPin, Video } from "lucide-react";
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
    <section className="overflow-hidden rounded-lg border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
          <CalendarDays className="size-4" aria-hidden />
        </span>
        <div>
          <h2 className="text-base font-semibold text-foreground">Your planned calls</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Calls and viewings arranged for your properties.
          </p>
        </div>
      </div>

      <div className={`grid gap-3 p-4 ${!compact && rows.length > 1 ? "2xl:grid-cols-2" : "grid-cols-1"}`}>
        {rows.map(({ booking: b, lead, agent }) => {
          const proposed = b.status === "proposed";
          return (
            <div
              key={b.id}
              className={`relative overflow-hidden rounded-lg border p-4 ${
                proposed ? "border-gold/40 bg-gold-tint/30" : "border-brand/20 bg-brand-tint/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-lg shadow-sm ring-1 ring-border">
                  {b.kind === "video_tour" ? <Video className="size-4 text-brand" /> : KIND_ICON[b.kind]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{KIND_LABEL[b.kind]}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="size-3 shrink-0" aria-hidden />
                    <span className="truncate">{b.propertyLabel}</span>
                  </div>
                </div>
                <span className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${proposed ? "bg-gold-tint text-gold" : "bg-success/10 text-success"}`}>
                  {proposed ? "Awaiting confirmation" : "Confirmed"}
                </span>
              </div>

              <div className="mt-4 rounded-md border border-border/70 bg-card/80 p-3 text-xs text-foreground">
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
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Clock3 className="size-3.5 text-brand" aria-hidden />
                      {formatDateTime(b.startAt)}
                    </span>
                    <span className="mt-1 block text-muted-foreground">1 hour · with {agent}</span>
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
                to="/property/$propertyId" search={{ view: "deal" }}
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
