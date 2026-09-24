import { useActiveLeads } from "@/lib/leads";
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { fullName, useAuth, type LoqalUser } from "@/lib/auth";
import { KICKOFF_LABEL, useLeads, type MortgageLead } from "@/lib/leads";
import {
  CLIENT_ACTION_LABEL,
  INSPECTION_OPTIONS,
  PROPERTY_CHANGE_LABEL,
  useBuyerProcess,
} from "@/lib/buyer-process";
import {
  activeLicenseStates,
  isRealtorOnVacation,
  useRealtors,
  type Realtor,
} from "@/lib/realtors";
import { usePartnerRequests } from "@/lib/partner-requests";
import { formatDate, formatDateTime } from "@/lib/dates";
import { DateInput } from "@/components/form/DateInput";
import { CallScheduler } from "@/components/buyer/CallScheduler";
import { TourProposalPanel } from "@/components/buyer/TourProposalPanel";
import { FileChatPanel } from "@/components/messaging/FileChatPanel";
import { BuyerRequestsPanel } from "@/components/realtor/BuyerRequestsPanel";
import { Button } from "@/components/ui/button";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FileText,
  Home,
  MessageSquare,
  UserRound,
} from "lucide-react";
import { useFileRequests } from "@/lib/property-requests";
import { useAllFileChat, useFileChat } from "@/lib/file-chat";
import { usePropertyRequests } from "@/lib/property-requests";
import { useEntityPlans } from "@/lib/entity-structure";
import { STATUS_CLS, realtorFileStatus } from "@/lib/realtor-file-status";

import { GoogleCalendarCard } from "@/components/google/GoogleCalendarCard";
import { RealtorAnalytics } from "@/components/realtor/RealtorAnalytics";
import { RealtorAccounting } from "@/components/realtor/RealtorAccounting";
import { RealtorFinancialAnalytics } from "@/components/realtor/RealtorFinancialAnalytics";
import { useGreeting } from "@/lib/greeting";
import { PointOfContactCard } from "@/components/partner/PointOfContactCard";
import { TaskTracker } from "@/components/tasks/TaskTracker";
import { GetStartedCard } from "@/components/onboarding/GetStartedCard";
import { clientDisplayForPartner } from "@/lib/user-id";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-brand">{value}</div>
      {note ? <div className="mt-1 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  );
}

/** Badge describing how the buyer is represented on this file. */
function RepresentationBadge({ lead }: { lead: MortgageLead }) {
  const ba = lead.buyerAgent!;
  if (ba.representation === "loqal_rep") {
    return (
      <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
        🛡 Loqal personal advocate
      </span>
    );
  }
  if (ba.kickoff === "photo_visit") {
    return (
      <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
        📷 Photos requested
      </span>
    );
  }
  if (ba.kickoff === "video_showcase") {
    return (
      <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
        🎥 Video tour requested
      </span>
    );
  }
  if (ba.kickoff === "live_call" || ba.nextStep === "live_call") {
    return (
      <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
        📞 Live call
      </span>
    );
  }
  return (
    <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
      Active buyer
    </span>
  );
}

/**
 * Photo visit workflow: deliver within 3 days, or set a new date with a
 * reason when the seller cannot receive the agent. Photos go out together
 * with the agent's comments and recommended next moves.
 */
function PhotoPanel({ lead }: { lead: MortgageLead }) {
  const { photos, delayPhotos, deliverPhotos } = useBuyerProcess();
  const photo = photos[lead.id];
  const [mode, setMode] = useState<"none" | "deliver" | "delay">("none");
  const [names, setNames] = useState<string[]>([]);
  const [comments, setComments] = useState("");
  const [inspections, setInspections] = useState<string[]>([]);
  const [appraisal, setAppraisal] = useState("");
  const [negotiation, setNegotiation] = useState("");
  const [price, setPrice] = useState("");
  const [reason, setReason] = useState("");
  const [eta, setEta] = useState("");

  if (!photo) return null;

  if (photo.status === "delivered") {
    return (
      <section className="rounded-lg border border-success/40 bg-success/5 p-4">
        <h3 className="text-sm font-semibold text-foreground">Photos delivered</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {photo.photos.length} photo{photo.photos.length === 1 ? "" : "s"} sent to the buyer on{" "}
          {formatDateTime(photo.deliveredAt)}.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {photo.photos.map((p) => (
            <span
              key={p.id}
              className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand"
            >
              📷 {p.name}
            </span>
          ))}
        </div>
        {photo.comments ? (
          <p className="mt-2 text-xs text-muted-foreground">Your comments: {photo.comments}</p>
        ) : null}
      </section>
    );
  }

  const overdue = new Date(photo.dueAt).getTime() < Date.now();

  return (
    <section
      className={`rounded-lg border p-4 ${
        overdue ? "border-destructive/40 bg-destructive/5" : "border-gold/40 bg-gold-tint/40"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">📷 Property photos requested</h3>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            overdue ? "bg-destructive/10 text-destructive" : "bg-gold-tint text-gold"
          }`}
        >
          {photo.status === "delayed"
            ? `Rescheduled — new date ${photo.etaAt ? formatDate(photo.etaAt) : "open"}`
            : overdue
              ? `Overdue — was due ${formatDate(photo.dueAt)}`
              : `Due ${formatDate(photo.dueAt)} (3 days)`}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Visit the property and upload updated photos within 3 days of the request. If the seller
        cannot receive you in time, set a new date and tell the buyer why.
      </p>
      {photo.status === "delayed" && photo.delayReason ? (
        <p className="mt-2 rounded-md bg-background/70 p-2 text-xs text-muted-foreground">
          Buyer was informed: {photo.delayReason}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode(mode === "deliver" ? "none" : "deliver")}
          className={btnPrimary}
        >
          Upload photos & recommendations
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "delay" ? "none" : "delay")}
          className={btnGhost}
        >
          Can't visit within 3 days?
        </button>
      </div>

      {mode === "delay" ? (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-card p-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Reason (shown to the buyer)
            </span>
            <textarea
              rows={2}
              placeholder="e.g. Seller is travelling and cannot receive visitors before…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              New photo date
            </span>
            <DateInput
              value={eta}
              onChange={setEta}
              className="w-44 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <button
            type="button"
            disabled={!reason.trim() || !eta}
            onClick={() => {
              delayPhotos(lead.id, reason.trim(), eta);
              setMode("none");
              setReason("");
              setEta("");
            }}
            className={btnPrimary}
          >
            Update the buyer
          </button>
        </div>
      ) : null}

      {mode === "deliver" ? (
        <div className="mt-3 space-y-3 rounded-md border border-border bg-card p-3">
          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Property photos
            </span>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? []).map((f) => f.name);
                setNames([...names, ...picked]);
                e.currentTarget.value = "";
              }}
              className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-xs file:font-semibold file:text-background"
            />
            {names.map((n, i) => (
              <div
                key={`${n}-${i}`}
                className="mt-1 flex items-center justify-between rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <span className="text-brand">📷 {n}</span>
                <button
                  type="button"
                  onClick={() => setNames(names.filter((_, idx) => idx !== i))}
                  className="font-semibold text-destructive"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Comments & suggested next moves
            </span>
            <textarea
              rows={3}
              placeholder="Condition of the property, what you recommend, what you think you can negotiate…"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className={inputClass}
            />
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Inspections you recommend
            </span>
            <div className="flex flex-wrap gap-1.5">
              {INSPECTION_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() =>
                    setInspections(
                      inspections.includes(opt)
                        ? inspections.filter((x) => x !== opt)
                        : [...inspections, opt],
                    )
                  }
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                    inspections.includes(opt)
                      ? "bg-brand text-background"
                      : "border border-border text-muted-foreground hover:bg-brand-tint"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Appraisal — when to proceed
              </span>
              <input
                placeholder="e.g. After the general inspection"
                value={appraisal}
                onChange={(e) => setAppraisal(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Suggested negotiation price ($)
              </span>
              <input
                inputMode="numeric"
                placeholder="e.g. 465000"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
                className={inputClass}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Negotiation notes
            </span>
            <input
              placeholder="What you believe can be negotiated down and why"
              value={negotiation}
              onChange={(e) => setNegotiation(e.target.value)}
              className={inputClass}
            />
          </label>

          <button
            type="button"
            disabled={!names.length}
            onClick={() => {
              deliverPhotos(lead.id, names, {
                comments: comments.trim(),
                inspectionsSuggested: inspections,
                appraisalNote: appraisal.trim(),
                negotiationNote: negotiation.trim(),
                ...(price ? { suggestedPrice: Number(price) } : {}),
              });
              setMode("none");
            }}
            className={btnPrimary}
          >
            Send photos & recommendations to the buyer
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** Decisions the buyer took after receiving photos / during the process. */
function ClientDecisions({ lead }: { lead: MortgageLead }) {
  const { actions } = useBuyerProcess();
  const list = actions[lead.id] ?? [];
  if (!list.length) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Client decisions</h3>
      <ul className="mt-2 space-y-2">
        {list.map((a) => (
          <li key={a.id} className="rounded-md bg-background p-2.5 text-xs">
            <span className="font-semibold text-foreground">{CLIENT_ACTION_LABEL[a.action]}</span>{" "}
            <span className="text-muted-foreground">· {formatDateTime(a.createdAt)}</span>
            {a.propertyChangeMode ? (
              <span className="block mt-0.5 text-muted-foreground">
                {PROPERTY_CHANGE_LABEL[a.propertyChangeMode]}
              </span>
            ) : null}
            {a.details ? <p className="mt-1 text-muted-foreground">{a.details}</p> : null}
            {a.extraInspections?.length ? (
              <p className="mt-1 text-muted-foreground">
                Inspections: {a.extraInspections.join(", ")}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * A buyer file shared with the assigned agent. Deliberately excludes SSN,
 * uploaded documents, the questionnaire answers and the buyer's direct
 * e-mail / phone — those stay with Loqal admins only.
 */
function BuyerFile({ lead, me }: { lead: MortgageLead; me: Realtor }) {
  const [open, setOpen] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<
    "overview" | "requests" | "visits" | "messages" | "activity"
  >("overview");
  const { bookings, bookCall } = useBuyerProcess();
  const process = useBuyerProcess();
  const fileRequests = useFileRequests(lead.id);
  const fileChat = useFileChat(lead.id, "agent");
  const [tourSlot, setTourSlot] = useState<string | null>(null);
  const t = lead.terms;
  const ba = lead.buyerAgent!;
  const loqalManaged = ba.representation === "loqal_rep";
  const introCall = bookings.find((b) => b.leadId === lead.id && b.kind === "intro_call");
  const videoTour = bookings.find((b) => b.leadId === lead.id && b.kind === "video_tour");
  const photo = process.photos[lead.id];
  const decisions = process.actions[lead.id] ?? [];
  const purchase = fileRequests.purchases[0];
  const change = fileRequests.changes[0];
  const { plans } = useEntityPlans();
  const plan = plans.find((p) => p.leadId === lead.id);
  const openRequestCount =
    (purchase && (purchase.status === "pending" || purchase.status === "buyer_raised") ? 1 : 0) +
    (change?.status === "pending" ? 1 : 0);
  const displayName = clientDisplayForPartner(lead.clientName, lead.clientEmail);
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const stage = purchase
    ? purchase.status === "price_supported"
      ? "Price confirmed"
      : "Purchase negotiation"
    : photo?.status === "delivered"
      ? "Buyer reviewing property"
      : ba.kickoff
        ? "Property due diligence"
        : "Active buyer";
  const stageStep = purchase?.status === "price_supported" ? 4 : purchase ? 3 : photo ? 2 : 1;
  const fileStatus = realtorFileStatus({
    lead,
    purchase,
    change,
    plan,
    photo,
    hasVideoTour: !!videoTour,
    hasIntroCall: !!introCall,
    unread: fileChat.unread,
  });
  const nextAction = fileStatus.task
    ? fileStatus.task
    : openRequestCount
    ? {
        title: `Review ${openRequestCount === 1 ? "buyer request" : `${openRequestCount} buyer requests`}`,
        detail: "A response is needed before the purchase can move forward.",
        tab: "requests" as const,
      }
    : photo && photo.status !== "delivered"
      ? {
          title: "Complete the property visit",
          detail: `Updated photos are due ${formatDate(photo.etaAt ?? photo.dueAt)}.`,
          tab: "visits" as const,
        }
      : ba.kickoff === "video_showcase" && !videoTour
        ? {
            title: "Arrange the video tour",
            detail: "Choose a suitable time and share it with the buyer.",
            tab: "visits" as const,
          }
        : {
            title: "Keep the buyer updated",
            detail: "Send an update or request anything needed for the next step.",
            tab: "messages" as const,
          };

  const tabs: {
    id: "overview" | "requests" | "visits" | "messages" | "activity";
    label: string;
    icon: typeof Home;
    count?: number;
  }[] = [
    { id: "overview", label: "Overview", icon: Home },
    { id: "requests", label: "Purchase process", icon: ClipboardCheck, count: openRequestCount },
    { id: "visits", label: "Visits & media", icon: CalendarDays },
    { id: "messages", label: "Messages", icon: MessageSquare, count: fileChat.unread },
    { id: "activity", label: "Activity", icon: FileText, count: decisions.length },
  ];

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-4 p-5 text-left hover:bg-brand-tint/30"
      >
        {fileStatus.task ? (
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-warning" aria-label="Task for you" />
        ) : null}
        <div className="min-w-[220px] flex-1">
          <div className="text-sm font-semibold text-foreground">
            {clientDisplayForPartner(lead.clientName, lead.clientEmail)}
          </div>
          <div className="text-xs text-muted-foreground">
            {lead.propertyLabel} · {money(lead.propertyPrice)}
          </div>
          {fileStatus.task ? (
            <div className="mt-1 text-xs font-semibold text-warning">
              Your task: {fileStatus.task.title}
            </div>
          ) : null}
        </div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${STATUS_CLS[fileStatus.tone]}`}>
          {fileStatus.label}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="border-t border-border bg-background/50">
          <div className="border-b border-border bg-card px-4 py-5 md:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-background">
                  {initials || "LQ"}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-foreground">{displayName}</h3>
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                      {stage}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {lead.propertyLabel} · {money(lead.propertyPrice)}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="outline" size="sm" onClick={() => setWorkspaceTab("messages")}>
                  <MessageSquare /> Message
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWorkspaceTab("requests")}>
                  <ClipboardCheck /> Requests
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWorkspaceTab("visits")}>
                  <CalendarDays /> Visits
                </Button>
                <Button asChild size="sm">
                  <Link to="/property/$propertyId" params={{ propertyId: String(lead.propertyId) }}>
                    <ArrowUpRight /> Property
                  </Link>
                </Button>
              </div>
            </div>

            <div className="mt-5">
              <div className="grid grid-cols-4 gap-1.5" aria-label={`Purchase stage: ${stage}`}>
                {[1, 2, 3, 4].map((step) => (
                  <div
                    key={step}
                    className={`h-1.5 rounded-full ${step <= stageStep ? "bg-brand" : "bg-muted"}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] font-medium text-muted-foreground">
                <span>Assigned</span>
                <span>Due diligence</span>
                <span>Negotiation</span>
                <span>Terms agreed</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border-b border-border bg-card px-3 md:px-5">
            <div className="flex min-w-max gap-1">
              {tabs.map(({ id, label, icon: Icon, count }) => (
                <Button
                  key={id}
                  type="button"
                  variant="ghost"
                  onClick={() => setWorkspaceTab(id)}
                  className={`h-11 rounded-none border-b-2 px-3 text-xs ${
                    workspaceTab === id
                      ? "border-brand text-brand"
                      : "border-transparent text-muted-foreground"
                  }`}
                >
                  <Icon />
                  {label}
                  {count ? (
                    <span className="min-w-5 rounded-full bg-brand-tint px-1.5 py-0.5 text-[10px] font-bold text-brand">
                      {count}
                    </span>
                  ) : null}
                </Button>
              ))}
            </div>
          </div>

          <div className="p-4 md:p-6">
            {workspaceTab === "overview" ? (
              <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
                <div className="space-y-5">
                  <section className="overflow-hidden rounded-lg border border-brand/25 bg-card">
                    <div className="border-l-4 border-brand p-4 md:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                            Next action
                          </p>
                          <h4 className="mt-1 text-base font-bold text-foreground">{nextAction.title}</h4>
                          <p className="mt-1 text-xs text-muted-foreground">{nextAction.detail}</p>
                        </div>
                        <Button size="sm" onClick={() => setWorkspaceTab(nextAction.tab)}>
                          Open task <ArrowUpRight />
                        </Button>
                      </div>
                    </div>
                  </section>

                  <section>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Deal snapshot
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        Assigned {formatDate(ba.assignedAt)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      {[
                        ["Purchase price", money(lead.propertyPrice)],
                        ["Down payment", t ? `${t.downPaymentPct}%` : "—"],
                        ["Loan", t ? `${t.ratePct}% · ${t.termYears} years` : "Pending"],
                        ["Your fee", `${ba.feePct}% at closing`],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-border bg-card p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                          </p>
                          <p className="mt-1.5 text-sm font-bold text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-brand" aria-hidden />
                      <h4 className="text-sm font-semibold text-foreground">Buyer context</h4>
                    </div>
                    <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
                      <Row label="Buyer" value={displayName} />
                      <Row label="US status" value={lead.usPerson ? "US citizen / green card" : "Non-US person"} />
                      <Row label="Representation" value={loqalManaged ? "Loqal personal advocate" : "Works with you directly"} />
                      <Row label="Starting point" value={ba.kickoff ? KICKOFF_LABEL[ba.kickoff] : "Active file"} />
                    </div>
                    {ba.kickoffNotes ? (
                      <p className="mt-3 border-l-2 border-gold bg-gold-tint/40 px-3 py-2 text-xs text-muted-foreground">
                        {ba.kickoffNotes}
                      </p>
                    ) : null}
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-lg border border-border bg-card p-4">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      At a glance
                    </h4>
                    <div className="mt-3 space-y-3">
                      <button type="button" onClick={() => setWorkspaceTab("requests")} className="flex w-full items-center justify-between gap-3 text-left">
                        <span className="text-xs text-foreground">Open buyer requests</span>
                        <span className={`text-xs font-bold ${openRequestCount ? "text-brand" : "text-success"}`}>{openRequestCount || "None"}</span>
                      </button>
                      <button type="button" onClick={() => setWorkspaceTab("messages")} className="flex w-full items-center justify-between gap-3 text-left">
                        <span className="text-xs text-foreground">Unread messages</span>
                        <span className={`text-xs font-bold ${fileChat.unread ? "text-brand" : "text-success"}`}>{fileChat.unread || "None"}</span>
                      </button>
                      <button type="button" onClick={() => setWorkspaceTab("visits")} className="flex w-full items-center justify-between gap-3 text-left">
                        <span className="text-xs text-foreground">Photos / visit</span>
                        <span className="text-right text-xs font-bold text-foreground">{photo ? photo.status : ba.kickoff ? KICKOFF_LABEL[ba.kickoff] : "Not requested"}</span>
                      </button>
                    </div>
                  </section>
                  {loqalManaged ? (
                    <section className="rounded-lg border border-gold/40 bg-gold-tint/40 p-4">
                      <h4 className="text-sm font-semibold text-foreground">Loqal advocate assigned</h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        The advocate directs inspections, negotiations and the next steps with you.
                      </p>
                    </section>
                  ) : null}
                  <section className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                      <p className="text-[11px] leading-relaxed text-muted-foreground">
                        Private identity documents and mortgage questionnaire answers remain visible only to Loqal and authorized lending partners.
                      </p>
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}

            {workspaceTab === "requests" ? (
              <BuyerRequestsPanel
                leadId={lead.id}
                propertyId={lead.propertyId}
                propertyLabel={lead.propertyLabel}
                buyerName={displayName}
                buyerEmail={lead.clientEmail}
                agentName={`${me.firstName} ${me.lastName}`.trim()}
              />
            ) : null}

            {workspaceTab === "visits" ? (
              <div className="space-y-4">
                {!loqalManaged && ba.kickoff === "live_call" ? (
                  <section className="rounded-lg border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">Intro call</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {introCall ? `Booked for ${formatDateTime(introCall.startAt)}.` : "The buyer requested a live call but has not picked a slot yet."}
                    </p>
                  </section>
                ) : null}
                {!loqalManaged && ba.kickoff === "video_showcase" ? (
                  <section className="rounded-lg border border-border bg-card p-4">
                    <h3 className="text-sm font-semibold text-foreground">Real-time video showcasing</h3>
                    {videoTour?.status === "proposed" ? (
                      <div className="mt-3"><TourProposalPanel booking={videoTour} side="agent" realtorId={me.id} agentEmail={me.email} /></div>
                    ) : videoTour ? (
                      <div className="mt-2 text-sm text-muted-foreground">
                        Scheduled for <strong className="text-foreground">{formatDateTime(videoTour.startAt)}</strong>.
                        {videoTour.meetUrl ? <a href={videoTour.meetUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-md bg-brand px-3 py-2 text-xs font-semibold text-background">Join Google Meet</a> : null}
                      </div>
                    ) : (
                      <div className="mt-3"><CallScheduler realtorId={me.id} {...(tourSlot ? { booked: tourSlot } : {})} agentEmail={me.email} summary={`Loqal video walkthrough — ${lead.propertyLabel}`} description={`Live video walkthrough of ${lead.propertyLabel} with your Loqal buyer's agent.`} onBook={(startAt, meeting) => { bookCall({ leadId: lead.id, realtorId: me.id, clientName: lead.clientName, clientEmail: lead.clientEmail, propertyLabel: lead.propertyLabel, kind: "video_tour", startAt, ...(meeting?.eventId ? { googleEventId: meeting.eventId } : {}), ...(meeting?.meetUrl ? { meetUrl: meeting.meetUrl } : {}), ...(meeting?.htmlLink ? { calendarLink: meeting.htmlLink } : {}) }); setTourSlot(startAt); }} /></div>
                    )}
                  </section>
                ) : null}
                {!loqalManaged ? <PhotoPanel lead={lead} /> : null}
                {!photo && ba.kickoff !== "video_showcase" && ba.kickoff !== "live_call" ? (
                  <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">No visit or media work is open for this file.</div>
                ) : null}
              </div>
            ) : null}

            {workspaceTab === "messages" ? (
              <FileChatPanel leadId={lead.id} side="agent" myName={`${me.firstName} ${me.lastName}`.trim()} otherName={displayName} otherEmail={lead.clientEmail} propertyId={lead.propertyId} propertyLabel={lead.propertyLabel} />
            ) : null}

            {workspaceTab === "activity" ? (
              decisions.length ? <ClientDecisions lead={lead} /> : <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">No buyer decisions have been recorded yet.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

function CalendarSection({ me, myLeads }: { me: Realtor; myLeads: MortgageLead[] }) {
  const { bookings } = useBuyerProcess();
  const leadIds = useMemo(() => new Set(myLeads.map((l) => l.id)), [myLeads]);
  const mine = bookings.filter((b) => b.realtorId === me.id || leadIds.has(b.leadId));
  const pending = mine
    .filter((b) => b.status === "proposed")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const upcoming = mine
    .filter((b) => b.status !== "proposed")
    .filter((b) => new Date(b.endAt).getTime() > Date.now() - 24 * 60 * 60 * 1000)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <div className="space-y-6">
      <GoogleCalendarCard agentRef={me.id} agentEmail={me.email} />

      {pending.length ? (
        <section className="rounded-lg border border-gold/40 bg-card p-6">
          <h2 className="text-base font-semibold text-foreground">Times to agree with your buyers</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your buyers ranked their preferred times. Confirm one, or propose your own options with a
            note.
          </p>
          <div className="mt-4 space-y-4">
            {pending.map((b) => (
              <div key={b.id} id={b.id}>
                <div className="text-sm font-semibold text-foreground">
                  {clientDisplayForPartner(b.clientName, b.clientEmail)} · {b.propertyLabel}
                </div>
                <div className="mt-2">
                  <TourProposalPanel booking={b} side="agent" realtorId={me.id} agentEmail={me.email} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}


      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">My calendar</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Intro calls and video tours booked with your buyers — 1 hour per booking. Buyers only see
          your free slots, so there are no conflicts.
        </p>
        {upcoming.length ? (
          <ul className="mt-4 space-y-3">
            {upcoming.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-background p-4"
              >
                <span className="text-xl">{b.kind === "video_tour" ? "🎥" : "📞"}</span>
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    {b.kind === "video_tour" ? "Video property tour" : "Intro call"} —{" "}
                    {clientDisplayForPartner(b.clientName, b.clientEmail)}
                  </div>
                  <div className="text-xs text-muted-foreground">{b.propertyLabel}</div>
                </div>
                {b.meetUrl ? (
                  <a
                    href={b.meetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md bg-brand px-3 py-1.5 text-[11px] font-semibold text-background hover:bg-brand-soft"
                  >
                    Join Google Meet
                  </a>
                ) : null}
                <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
                  {formatDateTime(b.startAt)} –{" "}
                  {new Date(b.endAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground">
            No calls or video tours scheduled. When a buyer books a slot it appears here instantly.
          </p>
        )}
      </section>
    </div>
  );
}

function VacationMode({ me }: { me: Realtor }) {
  const { updateRealtor } = useRealtors();
  const [from, setFrom] = useState(me.vacationFrom ?? "");
  const [until, setUntil] = useState(me.vacationUntil ?? "");
  const active = isRealtorOnVacation(me);

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Vacation mode</h2>
        {active ? (
          <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
            On vacation — excluded from new assignments
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        While on vacation you keep your current buyers but no new buyer files are assigned to you.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            From
          </span>
          <DateInput
            value={from}
            onChange={setFrom}
            className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Until
          </span>
          <DateInput
            value={until}
            onChange={setUntil}
            className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button
          type="button"
          disabled={!from || !until}
          onClick={() => updateRealtor(me.id, { vacationFrom: from, vacationUntil: until })}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
        >
          Set vacation
        </button>
        {me.vacationFrom || me.vacationUntil ? (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setUntil("");
              updateRealtor(me.id, { vacationFrom: "", vacationUntil: "" });
            }}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-destructive"
          >
            Clear
          </button>
        ) : null}
      </div>
    </section>
  );
}


export type RealtorTabId =
  | "home"
  | "buyers"
  | "calendar"
  | "analytics"
  | "financial"
  | "accounting";

export const REALTOR_TABS: { id: RealtorTabId; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "buyers", label: "Buyer files", icon: "🗂" },
  { id: "calendar", label: "My calendar", icon: "🗓" },
  { id: "analytics", label: "Performance analytics", icon: "📈" },
  { id: "financial", label: "Financial analytics", icon: "💹" },
  { id: "accounting", label: "Accounting", icon: "💳" },
];

export function RealtorPortal({
  user,
  tab,
  onTabChange,
}: {
  user: LoqalUser;
  tab: RealtorTabId;
  onTabChange: (tab: RealtorTabId) => void;
}) {
  const { realtors, ensureSeat } = useRealtors();
  const { leads, ready: leadsReady } = useActiveLeads();
  const { photos } = useBuyerProcess();
  const { requests } = usePartnerRequests();

  const registration = requests.find(
    (r) => r.email.toLowerCase() === user.email.toLowerCase(),
  );
  const greeting = useGreeting(registration?.firstName || user.firstName, user.email);

  const me = realtors.find((r) => r.email.toLowerCase() === user.email.toLowerCase());

  useEffect(() => {
    if (!me && user.email) ensureSeat(user.email, user.firstName, user.lastName, user.phone);
  }, [me, user, ensureSeat]);

  const mine = useMemo(
    () => (me ? leads.filter((l) => l.buyerAgent?.agentId === me.id) : []),
    [leads, me],
  );
  const photoWork = mine.filter((l) => {
    const p = photos[l.id];
    return p && p.status !== "delivered";
  }).length;

  if (!leadsReady || !me) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
      <div className="mb-8">
        <span className="rounded-full bg-gold-tint px-3 py-1 text-xs font-semibold text-gold">
          Realtor partner
        </span>
        <h1 className="mt-3 text-2xl font-bold text-foreground md:text-[32px]">
          {greeting}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Buyers assigned to you, your calendar, licenses and availability.
        </p>
      </div>

      {!me.approvedAt ? (
        <div className="mb-6 rounded-lg border border-gold/40 bg-gold-tint/50 p-4 text-sm text-foreground">
          <strong>Registration pending.</strong> A Loqal admin reviews every partner registration
          before access is granted. Once approved, buyer files can be assigned to you.
        </div>
      ) : null}

      {/* Secondary navigation for small screens — desktop uses the header menu */}
      <div className="mb-6 flex flex-wrap gap-2 lg:hidden">
        {REALTOR_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold ${
              tab === t.id
                ? "bg-brand text-background"
                : "border border-border text-muted-foreground hover:bg-brand-tint"
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "home" ? (
        <>
          <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Active buyers" value={mine.length} note="Assigned to you right now" />
            <Stat
              label="Photo requests open"
              value={photoWork}
              note={photoWork ? "Deliver within 3 days or update the buyer" : "None pending"}
            />
            <Stat
              label="Licensed states"
              value={activeLicenseStates(me).length || "—"}
              note={activeLicenseStates(me).join(", ") || "Add licenses to receive assignments"}
            />
          </section>

          <div className="mb-6">
            <GetStartedCard />
          </div>

          <div className="mb-6">
            <TaskTracker />
          </div>

          <div className="mb-6">
            <GoogleCalendarCard agentRef={me.id} agentEmail={me.email} />
          </div>

          <div className="mb-6">
            <VacationMode me={me} />
          </div>

          <div className="mb-6 md:w-1/2">
            <PointOfContactCard compact />
          </div>
        </>
      ) : tab === "buyers" ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">My buyer files</h2>
            <span className="text-xs text-muted-foreground">
              Assigned by Loqal based on your licenses, pipeline and languages
            </span>
          </div>
          {mine.length ? (
            <ul className="space-y-4">
              {mine.map((l) => (
                <BuyerFile key={l.id} lead={l} me={me} />
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No buyer files assigned yet. When a client confirms their pre-approval terms in a
              state you are licensed in, the file appears here.
            </div>
          )}
        </section>
      ) : tab === "calendar" ? (
        <CalendarSection me={me} myLeads={mine} />
      ) : tab === "analytics" ? (
        <RealtorAnalytics me={me} mine={mine} />
      ) : tab === "financial" ? (
        <RealtorFinancialAnalytics mine={mine} />
      ) : (
        <RealtorAccounting me={me} mine={mine} />
      )}
    </main>
  );
}
