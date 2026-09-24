import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Landmark,
  MessageSquareText,
  UserRound,
} from "lucide-react";
import { AppHeader } from "@/components/layout/AppHeader";
import { BuyerProcessCard } from "@/components/buyer/BuyerProcessCard";
import { VideoCallDialog } from "@/components/calls/VideoCallDialog";
import { MortgageCaseCard } from "@/components/mortgage/MortgageCaseCard";
import { BuyerAgentDialog } from "@/components/mortgage/BuyerAgentDialog";
import { FeedbackDialog } from "@/components/mortgage/FeedbackDialog";
import { Button } from "@/components/ui/button";
import { formatPrice, getProperty } from "@/data/properties";
import { useAuth } from "@/lib/auth";
import { useBuyerProcess } from "@/lib/buyer-process";
import { openDeepLink } from "@/lib/deep-link";
import { useEntityPlan } from "@/lib/entity-structure";
import { hasPricedOffer, useLeads } from "@/lib/leads";
import { assignedPartner } from "@/lib/partner-assignments";
import { usePartnerRequests } from "@/lib/partner-requests";
import { useClientPropertyActivity } from "@/lib/property-activity";
import { useFileRequests } from "@/lib/property-requests";
import { partnerDisplayForClient } from "@/lib/user-id";
import { formatDateTime } from "@/lib/dates";

type WorkspaceSearch = {
  open?: "feedback" | "call" | "agent" | "chat" | "agreement";
  focus?: string;
  k?: string;
};

export const Route = createFileRoute("/property_/$propertyId/workspace")({
  component: PropertyWorkspacePage,
  validateSearch: (search: Record<string, unknown>): WorkspaceSearch => {
    const open = search["open"];
    const out: WorkspaceSearch = {};
    if (
      open === "feedback" ||
      open === "call" ||
      open === "agent" ||
      open === "chat" ||
      open === "agreement"
    ) out.open = open;
    if (typeof search["focus"] === "string") out.focus = search["focus"];
    if (typeof search["k"] === "string") out.k = search["k"];
    return out;
  },
  loader: ({ params }) => {
    const property = getProperty(Number(params.propertyId));
    if (!property) throw notFound();
    return { property };
  },
  head: ({ loaderData }) => {
    const title = loaderData
      ? `${loaderData.property.address} Deal Workspace — LOQAL`
      : "Property workspace unavailable — LOQAL";
    const description = loaderData
      ? `Track the purchase, mortgage, assigned team, actions, and documents for ${loaderData.property.address}.`
      : "This property deal workspace is unavailable.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
});

function WorkspaceCard({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`overflow-hidden rounded-lg border border-border bg-card ${className}`}>
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function PropertyWorkspacePage() {
  const { property } = Route.useLoaderData();
  const { open, focus, k } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { leadForProperty } = useLeads();
  const lead = user ? leadForProperty(user.email, property.id) : undefined;
  const activity = useClientPropertyActivity().find((item) => item.propertyId === property.id);
  const { bookings } = useBuyerProcess();
  const { requests } = usePartnerRequests();
  const { plan } = useEntityPlan(lead?.id ?? "");
  const { purchases } = useFileRequests(lead?.id ?? "");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const callBooking = bookings.find(
    (booking) =>
      booking.status === "confirmed" &&
      booking.propertyLabel.startsWith(property.address) &&
      (!focus || booking.id === focus),
  );

  useEffect(() => {
    if (open === "feedback") setFeedbackOpen(true);
    if (open === "call" && callBooking) setCallOpen(true);
    if (open === "agent") setAgentOpen(true);
    if (open === "agreement") {
      const timer = window.setTimeout(() => {
        document.getElementById("purchase-agreement")?.scrollIntoView({ behavior: "smooth" });
      }, 250);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, focus, k, callBooking]);

  const latestPurchase = purchases[0];
  const priced = hasPricedOffer(lead);
  const realtor = lead ? assignedPartner(lead, "realtor", requests) : undefined;
  const lender = lead ? assignedPartner(lead, "lender", requests) : undefined;
  const purchasePrice = latestPurchase?.offerPrice ?? lead?.propertyPrice ?? property.price;

  const steps = useMemo(() => {
    const hasPurchase = Boolean(latestPurchase);
    const priceConfirmed = latestPurchase?.status === "price_supported";
    const termsConfirmed = Boolean(plan?.termsConfirmedAt);
    const signed = Boolean(plan?.agreementSignedAt);
    return [
      { label: "Property selected", done: true },
      { label: "Mortgage review", done: priced },
      { label: "Purchase price", done: priceConfirmed, active: hasPurchase && !priceConfirmed },
      { label: "Purchase terms", done: termsConfirmed, active: priceConfirmed && !termsConfirmed },
      { label: "Agreement & closing", done: signed, active: termsConfirmed && !signed },
    ];
  }, [latestPurchase, plan, priced]);
  const completed = steps.filter((step) => step.done).length;
  const progress = Math.round((completed / steps.length) * 100);
  const progressClass = ["w-0", "w-1/5", "w-2/5", "w-3/5", "w-4/5", "w-full"][completed] ?? "w-0";
  const nextStep = steps.find((step) => !step.done)?.label ?? "Closing coordination";

  if (!user || user.role !== "client") {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="Properties" />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">Deal workspace unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This workspace is available to the client attached to the active property file.
          </p>
          <Button asChild className="mt-5">
            <Link to="/property/$propertyId" params={{ propertyId: String(property.id) }}>
              View initial listing
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader active="Properties" />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-foreground">No active deal for this property</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the initial listing to review the property or start a mortgage request.
          </p>
          <Button asChild className="mt-5">
            <Link to="/property/$propertyId" params={{ propertyId: String(property.id) }}>
              View initial listing
            </Link>
          </Button>
        </main>
      </div>
    );
  }

  const team = [
    realtor
      ? {
          role: "Buyer's agent",
          name: partnerDisplayForClient(`${realtor.firstName} ${realtor.lastName}`, realtor.email),
          company: realtor.companyName,
          Icon: UserRound,
        }
      : undefined,
    lender
      ? {
          role: "Mortgage lender",
          name: partnerDisplayForClient(`${lender.firstName} ${lender.lastName}`, lender.email),
          company: lender.companyName,
          Icon: Landmark,
        }
      : undefined,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader active="Properties" />
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-7 md:py-8">
        <Link
          to="/marketplace"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden /> Properties in action
        </Link>

        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="rounded bg-brand-tint px-2 py-1 text-[10px] font-semibold uppercase text-brand">
                Property in action
              </span>
              <span className="rounded bg-success/10 px-2 py-1 text-[10px] font-semibold uppercase text-success">
                Active file
              </span>
            </div>
            <h1 className="text-2xl font-bold text-foreground md:text-[30px]">{property.address}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {property.location} · Property deal workspace
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/property/$propertyId" params={{ propertyId: String(property.id) }}>
                <ExternalLink aria-hidden /> View initial listing
              </Link>
            </Button>
            {lead.buyerAgent ? (
              <Button
                variant="outline"
                onClick={() => openDeepLink(navigate, `/property/${property.id}/workspace?open=chat`)}
              >
                <MessageSquareText aria-hidden /> Message agent
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Deal status", activity?.awaitingClient ? "Action needed" : "In progress", activity?.headline ?? "Your property file is active"],
            ["Purchase price", formatPrice(purchasePrice), latestPurchase ? "Current buyer-side price" : "Initial listing price"],
            ["Mortgage", priced ? "Pre-approved" : "In review", priced ? "Lender terms available" : "File is being reviewed"],
            ["Next action", nextStep, activity?.awaitingClient ? `${activity.awaitingClient} item${activity.awaitingClient === 1 ? "" : "s"} need your answer` : "Team is moving the file forward"],
          ].map(([label, value, detail]) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4">
              <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
              <div className="mt-1.5 text-lg font-bold text-brand">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,.75fr)]">
          <div className="space-y-5">
            <WorkspaceCard title="Where the deal stands" action={<span className="text-xs font-semibold text-brand">{progress}% complete</span>}>
              {activity?.headline ? (
                <div className={`mb-5 rounded-md border p-3 text-sm font-medium ${activity.awaitingClient ? "border-gold/40 bg-gold-tint/50 text-foreground" : "border-success/30 bg-success/10 text-success"}`}>
                  {activity.headline}
                </div>
              ) : null}
              <div className="mb-5 h-2 overflow-hidden rounded-full bg-muted">
                <div className={`h-full bg-brand transition-all ${progressClass}`} />
              </div>
              <ol className="grid gap-2 sm:grid-cols-5">
                {steps.map((step, index) => (
                  <li key={step.label} className="relative rounded-md border border-border bg-background p-3">
                    <div className={`mb-2 flex size-6 items-center justify-center rounded-full text-[11px] font-bold ${step.done ? "bg-success text-success-foreground" : step.active ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {step.done ? <Check className="size-3.5" aria-hidden /> : index + 1}
                    </div>
                    <div className="text-xs font-semibold text-foreground">{step.label}</div>
                    <div className="mt-1 text-[10px] uppercase text-muted-foreground">
                      {step.done ? "Done" : step.active ? "Now" : "Upcoming"}
                    </div>
                  </li>
                ))}
              </ol>
            </WorkspaceCard>

            <WorkspaceCard title="Property information">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Property", property.type],
                  ["Layout", property.beds ? `${property.beds} bed · ${property.baths} bath` : "Commercial layout"],
                  ["Size", `${property.sqft.toLocaleString()} ${property.type === "Land" ? "acres" : "sqft"}`],
                  ["Initial listing", formatPrice(property.price)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-md border border-border bg-muted/30 p-3">
                    <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button asChild size="sm" variant="outline">
                  <Link to="/property/$propertyId" params={{ propertyId: String(property.id) }}>
                    View full initial listing <ChevronRight aria-hidden />
                  </Link>
                </Button>
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Mortgage and purchase file">
              {priced ? (
                <div className="mb-5 flex flex-col justify-between gap-3 rounded-md border border-success/30 bg-success/10 p-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="text-sm font-semibold text-success">Pre-approval terms are available</div>
                    <p className="mt-1 text-xs text-muted-foreground">Review the lender's feedback and continue your purchase file below.</p>
                  </div>
                  <Button size="sm" onClick={() => setFeedbackOpen(true)}>View feedback</Button>
                </div>
              ) : null}
              {priced ? (
                lead.buyerAgent ? <BuyerProcessCard lead={lead} /> : <MortgageCaseCard lead={lead} />
              ) : (
                <MortgageCaseCard lead={lead} />
              )}
            </WorkspaceCard>
          </div>

          <aside className="space-y-5 xl:sticky xl:top-5">
            <WorkspaceCard title="Open actions" action={activity?.awaitingClient ? <span className="rounded bg-gold-tint px-2 py-1 text-[10px] font-semibold text-gold">{activity.awaitingClient}</span> : undefined}>
              {activity?.items.filter((item) => item.tone === "pending").length ? (
                <div className="divide-y divide-border">
                  {activity.items.filter((item) => item.tone === "pending").slice(0, 4).map((item) => (
                    <div key={`${item.at}-${item.label}`} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex gap-3">
                        <Clock3 className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold text-foreground">{item.label}</div>
                          {item.detail ? <p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p> : null}
                          {item.action ? (
                            <Button size="sm" className="mt-2" onClick={() => openDeepLink(navigate, item.action?.href ?? "")}>
                              {item.action.cta}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-success"><Check className="size-4" aria-hidden /> Nothing is waiting on you.</div>
              )}
            </WorkspaceCard>

            <WorkspaceCard title="Property team">
              <div className="space-y-3">
                {team.map(({ role, name, company, Icon }) => (
                  <div key={role} className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-brand-tint text-brand"><Icon className="size-4" aria-hidden /></span>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-foreground">{name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{role}{company ? ` · ${company}` : ""}</div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-3 rounded-md border border-border bg-background p-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-gold-tint text-gold"><Building2 className="size-4" aria-hidden /></span>
                  <div><div className="text-xs font-semibold text-foreground">Loqal support</div><div className="text-[11px] text-muted-foreground">Available for coordination</div></div>
                </div>
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Recent activity">
              <div className="space-y-4">
                {(activity?.items ?? []).slice(0, 5).map((item) => (
                  <div key={`${item.at}-${item.label}`} className="flex gap-3">
                    <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.tone === "pending" ? "bg-gold" : item.tone === "update" ? "bg-brand" : "bg-success"}`} />
                    <div>
                      <div className="text-xs font-medium text-foreground">{item.label}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{formatDateTime(item.at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Related areas">
              <div className="grid grid-cols-2 gap-2">
                <Button asChild size="sm" variant="outline"><Link to="/documents"><FileText aria-hidden /> Documents</Link></Button>
                <Button asChild size="sm" variant="outline"><Link to="/my-services"><CalendarClock aria-hidden /> Services</Link></Button>
              </div>
            </WorkspaceCard>
          </aside>
        </div>
      </main>

      <FeedbackDialog lead={lead} open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <BuyerAgentDialog lead={lead} open={agentOpen} onOpenChange={setAgentOpen} />
      {callBooking ? (
        <VideoCallDialog
          open={callOpen}
          onOpenChange={setCallOpen}
          title={callBooking.kind === "video_tour" ? "Live video tour" : callBooking.kind === "intro_call" ? "Intro call" : "Property visit call"}
          startAt={callBooking.startAt}
          meetUrl={callBooking.meetUrl}
          withLabel="Your Loqal realtor partner"
          contextLabel={callBooking.propertyLabel}
        />
      ) : null}
    </div>
  );
}