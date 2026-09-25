/**
 * Admin "Cases & files": every mortgage file / buyer case on the platform in
 * one monitor — status, parties, and a detail view with all documents and
 * the full correspondence timeline (lender info requests, client questions,
 * decisions, kickoff notes).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Calculator,
  ClipboardCheck,
  FileSearch,
  Globe2,
  Home,
  Landmark,
  LifeBuoy,
  UserPlus,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { useDeletions } from "@/lib/deletions";
import { countryLabel } from "@/data/countries";
import { VisaStatusDialog } from "@/components/admin/VisaStatusDialog";
import { VISA_STATUS_LABEL, isVisaOpen, useVisaRequests } from "@/lib/visa-support";
import { personActions } from "@/lib/person-actions";
import {
  KICKOFF_LABEL,
  LEAD_STATUS_LABEL,
  MORTGAGE_STAGE_LABEL,
  isMortgageFile,
  mortgageStage,
  useActiveLeads,
  type MortgageLead,
} from "@/lib/leads";
import { formatDate, formatDateTime } from "@/lib/dates";
import { ENTITY_PATH_LABEL, updateEntityPlan, useEntityPlans } from "@/lib/entity-structure";
import { notify } from "@/lib/notifications";
import { usd } from "@/lib/accounting";
import type { StoredDocument } from "@/lib/auth";

type TimelineItem = { at: string; who: string; what: string };

function documentsOf(lead: MortgageLead): { label: string; docs: StoredDocument[] }[] {
  const p = lead.profile;
  const groups: { label: string; docs: StoredDocument[] }[] = [];
  if (p.visaDocuments?.length) groups.push({ label: "Visa", docs: p.visaDocuments });
  if (p.idDocuments?.length)
    groups.push({ label: "ID / green card / passport", docs: p.idDocuments });
  if (p.bankruptcyDocuments?.length)
    groups.push({ label: "Bankruptcy discharge", docs: p.bankruptcyDocuments });
  const infoDocs = lead.infoRequests.flatMap((r) => r.documents);
  if (infoDocs.length) groups.push({ label: "Requested by lender", docs: infoDocs });
  return groups;
}

function timelineOf(lead: MortgageLead): TimelineItem[] {
  const items: TimelineItem[] = [
    { at: lead.submittedAt, who: lead.clientName, what: "Submitted the pre-approval inquiry" },
  ];
  for (const r of lead.infoRequests) {
    items.push({
      at: r.requestedAt,
      who: "Lender",
      what: `Requested ${r.needsDocument ? "a document" : "information"}: “${r.question}”`,
    });
    if (r.answeredAt)
      items.push({
        at: r.answeredAt,
        who: lead.clientName,
        what: `Answered: ${r.answer || `${r.documents.length} document(s) uploaded`}`,
      });
  }
  if (lead.decidedAt)
    items.push({
      at: lead.decidedAt,
      who: "Lender",
      what: `Decision: ${LEAD_STATUS_LABEL[lead.status]}${lead.lenderNote ? ` — ${lead.lenderNote}` : ""}`,
    });
  if (lead.terms)
    items.push({
      at: lead.terms.issuedAt,
      who: lead.terms.lenderName ?? "Lender",
      what: `Issued priced terms: ${lead.terms.ratePct}% · ${lead.terms.termYears}y · ${lead.terms.downPaymentPct}% down`,
    });
  for (const q of lead.clientQuestions ?? []) {
    items.push({ at: q.askedAt, who: lead.clientName, what: `Asked the lender: “${q.text}”` });
    if (q.answeredAt)
      items.push({ at: q.answeredAt, who: "Lender", what: `Replied: “${q.answer}”` });
  }
  if (lead.clientDecisionAt)
    items.push({
      at: lead.clientDecisionAt,
      who: lead.clientName,
      what: `Decision on terms: ${
        lead.clientDecision === "accepted"
          ? "Continuing"
          : lead.clientDecision === "hold"
            ? "Put on hold"
            : "Not continuing"
      }`,
    });
  const ba = lead.buyerAgent;
  if (ba?.agreedAt)
    items.push({
      at: ba.agreedAt,
      who: lead.clientName,
      what: "Confirmed the buyer's agent agreement (3% at closing)",
    });
  if (ba?.representation)
    items.push({
      at: ba.assignedAt ?? ba.agreedAt,
      who: "System",
      what:
        ba.representation === "loqal_rep"
          ? "Representation: Loqal personal advocate (+1% fee)"
          : `Representation: buyer works directly with ${ba.agentName ?? "the buyer's agent"}`,
    });
  if (ba?.kickoff)
    items.push({
      at: ba.kickoffAt ?? ba.assignedAt ?? ba.agreedAt,
      who: lead.clientName,
      what: `Kickoff: ${KICKOFF_LABEL[ba.kickoff]}${ba.kickoffNotes ? ` — “${ba.kickoffNotes}”` : ""}`,
    });
  return items.sort((a, b) => a.at.localeCompare(b.at));
}

function CaseDetail({ lead, onClose }: { lead: MortgageLead; onClose: () => void }) {
  const docs = documentsOf(lead);
  const timeline = timelineOf(lead);
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`File of ${lead.clientName}`}
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-foreground">{lead.clientName}</h3>
            <p className="text-sm text-muted-foreground">
              {lead.propertyLabel} · {usd(lead.propertyPrice)} ·{" "}
              {lead.usPerson ? "US person" : "Non-US person"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Status" value={LEAD_STATUS_LABEL[lead.status]} />
          <Mini
            label="Stage"
            value={
              isMortgageFile(lead) ? MORTGAGE_STAGE_LABEL[mortgageStage(lead)] : "Pre-approval"
            }
          />
          <Mini label="Lender owner" value={lead.assignedToName ?? "Unassigned"} />
          <Mini
            label="Buyer's side"
            value={
              lead.buyerAgent?.representation === "loqal_rep"
                ? "Loqal advocate"
                : (lead.buyerAgent?.agentName ?? "—")
            }
          />
        </div>

        <h4 className="mt-6 text-sm font-semibold text-foreground">Documents on file</h4>
        {docs.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {docs.map((g) => (
              <div key={g.label} className="rounded-md border border-border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </div>
                <ul className="mt-1 space-y-1">
                  {g.docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-sm">
                      <span className="text-foreground">📎 {d.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(d.uploadedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <OwnershipTask lead={lead} />

        <h4 className="mt-6 text-sm font-semibold text-foreground">Correspondence & history</h4>
        <ol className="mt-2 space-y-2 border-l-2 border-border pl-4">
          {timeline.map((t, i) => (
            <li key={i} className="text-sm">
              <span className="text-xs text-muted-foreground">{formatDateTime(t.at)}</span>
              <div>
                <strong className="text-foreground">{t.who}</strong>{" "}
                <span className="text-muted-foreground">{t.what}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/**
 * Ownership structure & purchase agreement on this file. When the client asks
 * Loqal to handle the company set-up it becomes an open task here, closed by
 * the admin once the structure is in place.
 */
function OwnershipTask({ lead }: { lead: MortgageLead }) {
  const { plans } = useEntityPlans();
  const plan = plans.find((p) => p.leadId === lead.id);
  if (!plan?.path && !plan?.termsProposedAt) return null;

  const setupOpen = Boolean(plan.loqalSetupRequestedAt) && !plan.loqalSetupHandledAt;

  function markHandled() {
    const now = new Date().toISOString();
    updateEntityPlan(lead.id, { loqalSetupHandledAt: now, loqalSetupHandledBy: "Loqal admin" });
    notify({
      id: `entitysetup-${lead.id}`,
      to: "admins",
      title: "Company set-up to be handled by Loqal",
      body: `${lead.clientName} — ${lead.propertyLabel}. Structure set up and confirmed.`,
      href: `/admin?tab=cases&focus=${lead.id}`,
      severity: "info",
      completed: true,
      badge: "Handled",
      createdAt: plan?.loqalSetupRequestedAt ?? now,
    });
  }

  return (
    <>
      <h4 className="mt-6 text-sm font-semibold text-foreground">
        Ownership structure & purchase agreement
      </h4>
      <div
        className={`mt-2 rounded-md border p-3 ${
          setupOpen ? "border-l-4 border-brand bg-brand-tint/40" : "border-border"
        }`}
      >
        {plan.path ? (
          <p className="text-sm font-semibold text-foreground">{ENTITY_PATH_LABEL[plan.path]}</p>
        ) : null}
        {plan.entityName ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {plan.entityName}
            {plan.entityState ? ` · ${plan.entityState}` : ""}
            {plan.entityEin ? ` · EIN ${plan.entityEin}` : ""}
          </p>
        ) : null}
        {setupOpen ? (
          <>
            <p className="mt-2 text-xs font-semibold text-brand">
              Task: set up the holding structure — requested{" "}
              {formatDateTime(plan.loqalSetupRequestedAt!)}. Choose the best set-up for the property
              location and the client profile, then confirm here.
            </p>
            <button
              type="button"
              onClick={markHandled}
              className="mt-2 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
            >
              Mark set-up as handled
            </button>
          </>
        ) : plan.loqalSetupHandledAt ? (
          <p className="mt-2 text-xs text-success">
            Structure set-up handled {formatDateTime(plan.loqalSetupHandledAt)}.
          </p>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Purchase terms:{" "}
          {plan.termsConfirmedAt
            ? `confirmed by ${plan.termsConfirmedBy ?? lead.clientName} on ${formatDateTime(
                plan.termsConfirmedAt,
              )} — the buyer's agent is putting them to the seller.`
            : plan.termsChangeRequestedAt
              ? `the buyer asked the agent to change: ${
                  plan.termsChangeItems?.length
                    ? plan.termsChangeItems.map((i) => `${i.label} (${i.from ? `${i.from} → ` : ""}${i.to})`).join(", ")
                    : plan.termsChangeNote ?? "no details"
                }.`
              : plan.termsProposedAt
                ? `proposed by the buyer's agent on ${formatDateTime(plan.termsProposedAt)} — awaiting the buyer's confirmation.`
                : "not proposed by the buyer's agent yet."}
        </p>
      </div>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Support lines — how Loqal organises its work                        */
/* ------------------------------------------------------------------ */

type Audience = "client" | "partner";
type LineId =
  | "registration"
  | "realtor"
  | "mortgage"
  | "direct"
  | "entity"
  | "visa"
  | "appraisal"
  | "inspection"
  | "accounting"
  | "errors"
  | "partner_onboarding";

type Line = {
  id: LineId;
  label: string;
  blurb: string;
  icon: LucideIcon;
  audiences: Audience[];
  soon?: boolean;
};

const STAGES: { title: string; lines: Line[] }[] = [
  {
    title: "Onboarding",
    lines: [
      {
        id: "registration",
        label: "Registration",
        blurb: "Partner and corporate-client registrations waiting for review or approval.",
        icon: UserPlus,
        audiences: ["partner", "client"],
      },
    ],
  },
  {
    title: "Buying a property",
    lines: [
      {
        id: "realtor",
        label: "Realtor support",
        blurb: "Buyer's-agent files — search, viewings, offers and purchase terms.",
        icon: Home,
        audiences: ["client", "partner"],
      },
      {
        id: "mortgage",
        label: "Mortgage support",
        blurb: "Pre-approval inquiries and mortgage files through to closing.",
        icon: Landmark,
        audiences: ["client", "partner"],
      },
      {
        id: "direct",
        label: "Direct purchase support",
        blurb: "All-cash and seller-financed purchases — no mortgage lender involved.",
        icon: Wallet,
        audiences: ["client", "partner"],
      },
      {
        id: "entity",
        label: "Company set-up support",
        blurb: "US LLC / holding structures Loqal is setting up for the purchase.",
        icon: Building2,
        audiences: ["client"],
      },
    ],
  },
  {
    title: "Relocation",
    lines: [
      {
        id: "visa",
        label: "Visa support",
        blurb: "Clients who asked Loqal to organise their US visa application.",
        icon: Globe2,
        audiences: ["client"],
      },
    ],
  },
  {
    title: "Coming soon",
    lines: [
      { id: "appraisal", label: "Appraisal support", blurb: "", icon: FileSearch, audiences: ["client"], soon: true },
      { id: "inspection", label: "Inspection support", blurb: "", icon: ClipboardCheck, audiences: ["client"], soon: true },
      { id: "accounting", label: "Accounting support", blurb: "", icon: Calculator, audiences: ["client"], soon: true },
      { id: "errors", label: "General error support", blurb: "", icon: LifeBuoy, audiences: ["client", "partner"], soon: true },
      { id: "partner_onboarding", label: "Partner registration support", blurb: "", icon: Briefcase, audiences: ["partner"], soon: true },
    ],
  },
];
const ALL_LINES = STAGES.flatMap((s) => s.lines);

/** One row in a support line. */
type CaseRow = {
  key: string;
  title: string;
  subtitle: string;
  status: string;
  needsLoqal: boolean;
  since: string;
  leadId?: string;
  href?: string;
  visaId?: string;
};

const AUDIENCE_LABEL: Record<Audience, string> = { client: "Client support", partner: "Partner support" };

function paymentModeOf(plan: { proposedTerms?: unknown } | undefined): string | undefined {
  const t = plan?.proposedTerms as { paymentMode?: string } | undefined;
  return t?.paymentMode;
}

export function AdminCases() {
  const { leads } = useActiveLeads();
  const { plans } = useEntityPlans();
  const { requests } = usePartnerRequests();
  const { deleted } = useDeletions();
  const { requests: visaRequests } = useVisaRequests();
  const [visaOpen, setVisaOpen] = useState<string | null>(null);
  useEffect(() => {
    const l = new URLSearchParams(window.location.search).get("line");
    if (l && ALL_LINES.some((x) => x.id === l)) setLineId(l as LineId);
  }, []);
  const [lineId, setLineId] = useState<LineId>("mortgage");
  const [audience, setAudience] = useState<Audience>("client");
  const [openId, setOpenId] = useState<string | null>(null);
  const [onlyOpen, setOnlyOpen] = useState(false);

  const gone = useMemo(
    () => new Set(deleted.map((d) => d.email.trim().toLowerCase())),
    [deleted],
  );

  const data = useMemo(() => {
    const planOf = (id: string) => plans.find((p) => p.leadId === id);
    const isDirect = (l: MortgageLead) => {
      const m = paymentModeOf(planOf(l.id));
      return m === "cash" || m === "seller_finance";
    };
    const livePartners = requests.filter(
      (r) => r.status !== "declined" && !gone.has(r.email.trim().toLowerCase()),
    );
    const partnerName = (r: PartnerRequest) => {
      const full = `${r.firstName} ${r.lastName}`.trim();
      return r.companyName ? `${full} · ${r.companyName}` : full;
    };
    const partnerRow = (r: PartnerRequest, files: number): CaseRow => {
      const loqal = personActions({ request: r, leads: [], name: partnerName(r) }).filter(
        (a) => a.owner === "loqal",
      );
      return {
        key: `p-${r.id}`,
        title: partnerName(r),
        subtitle: `${r.firstName} ${r.lastName} · ${files} active file${files === 1 ? "" : "s"}`,
        status: loqal[0]?.title ?? (r.agreementCountersignedAt ? "Active partner" : "Onboarding"),
        needsLoqal: loqal.length > 0,
        since: r.submittedAt,
        href: `/admin-people/${r.kind}-${r.id}`,
      };
    };
    const leadRow = (l: MortgageLead, status: string, needs: boolean): CaseRow => ({
      key: `l-${l.id}`,
      title: l.clientName,
      subtitle: `${l.propertyLabel} · ${usd(l.propertyPrice)}`,
      status,
      needsLoqal: needs,
      since: l.submittedAt,
      leadId: l.id,
    });
    const needsLender = (l: MortgageLead) =>
      (!l.lenderPartnerId && !l.terms) || (l.clientQuestions ?? []).some((q) => !q.answeredAt);

    const out: Record<LineId, Partial<Record<Audience, CaseRow[]>>> = {} as never;
    for (const l of ALL_LINES) out[l.id] = {};

    // Registration
    out.registration.partner = livePartners
      .filter((r) => r.kind === "partner" && r.status === "pending")
      .map((r) => ({ ...partnerRow(r, 0), status: "Approve or decline", needsLoqal: true }));
    out.registration.client = livePartners
      .filter((r) => r.kind === "corporate")
      .map((r) => ({
        ...partnerRow(r, 0),
        status: r.status === "pending" ? "Approve or decline" : "Approved",
        needsLoqal: r.status === "pending",
      }));

    // Realtor
    out.realtor.client = leads
      .filter((l) => l.buyerAgent)
      .map((l) =>
        leadRow(
          l,
          l.buyerAgent?.agentName
            ? `Agent: ${l.buyerAgent.agentName.split(" ")[0]}`
            : "Assign a buyer's agent",
          !l.buyerAgent?.agentId && !l.buyerAgent?.agentName,
        ),
      );
    out.realtor.partner = livePartners
      .filter((r) => r.kind === "partner" && r.partnerType === "realtor" && r.status === "approved")
      .map((r) =>
        partnerRow(r, leads.filter((l) => l.buyerAgent?.agentId === r.id).length),
      );

    // Mortgage
    out.mortgage.client = leads
      .filter((l) => !isDirect(l))
      .map((l) =>
        leadRow(
          l,
          isMortgageFile(l) ? MORTGAGE_STAGE_LABEL[mortgageStage(l)] : LEAD_STATUS_LABEL[l.status],
          needsLender(l),
        ),
      );
    out.mortgage.partner = livePartners
      .filter((r) => r.kind === "partner" && r.partnerType === "lender" && r.status === "approved")
      .map((r) => partnerRow(r, leads.filter((l) => l.lenderPartnerId === r.id).length));

    // Direct purchase
    out.direct.client = leads
      .filter(isDirect)
      .map((l) =>
        leadRow(
          l,
          paymentModeOf(planOf(l.id)) === "cash" ? "All-cash purchase" : "Part seller financing",
          false,
        ),
      );
    out.direct.partner = livePartners
      .filter((r) => r.kind === "partner" && r.status === "approved" && r.partnerType !== "realtor" && r.partnerType !== "lender")
      .map((r) => partnerRow(r, 0));

    // Company set-up
    out.entity.client = leads
      .filter((l) => planOf(l.id)?.path === "loqal_setup")
      .map((l) => leadRow(l, ENTITY_PATH_LABEL.loqal_setup, true));

    // Visa
    out.visa.client = visaRequests
      .filter((v) => !gone.has(v.email))
      .map((v) => ({
        key: `visa-${v.id}`,
        title: v.clientName,
        subtitle: `Citizenship ${countryLabel(v.citizenship ?? "") || "—"} · residence ${countryLabel(v.countryOfResidence ?? "") || "—"}`,
        status: VISA_STATUS_LABEL[v.status],
        needsLoqal: isVisaOpen(v),
        since: v.requestedAt,
        visaId: v.id,
      }));

    for (const l of ALL_LINES)
      for (const a of l.audiences)
        out[l.id][a] = [...(out[l.id][a] ?? [])].sort((x, y) =>
          x.needsLoqal === y.needsLoqal ? y.since.localeCompare(x.since) : x.needsLoqal ? -1 : 1,
        );
    return out;
  }, [leads, plans, requests, gone, visaRequests]);

  const line = ALL_LINES.find((l) => l.id === lineId)!;
  const aud: Audience = line.audiences.includes(audience) ? audience : line.audiences[0]!;
  const all = data[line.id][aud] ?? [];
  const rows = onlyOpen ? all.filter((r) => r.needsLoqal) : all;
  const count = (id: LineId) => ALL_LINES.find((l) => l.id === id)!.audiences.reduce(
    (n, a) => n + (data[id][a]?.length ?? 0), 0);
  const openCount = (id: LineId) => ALL_LINES.find((l) => l.id === id)!.audiences.reduce(
    (n, a) => n + (data[id][a]?.filter((r) => r.needsLoqal).length ?? 0), 0);
  const open = leads.find((l) => l.id === openId);

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-6">
        <h2 className="text-base font-semibold text-foreground">Cases by support line</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every case sorted by the support Loqal provides. Pick a line, then client or partner
          support — cases waiting on Loqal are always listed first.
        </p>
      </div>

      <div className="grid md:grid-cols-[240px_1fr]">
        <nav className="space-y-5 border-b border-border p-4 md:border-b-0 md:border-r">
          {STAGES.map((stage) => (
            <div key={stage.title}>
              <div className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {stage.title}
              </div>
              <ul className="space-y-0.5">
                {stage.lines.map((l) => {
                  const active = l.id === lineId;
                  const oc = l.soon ? 0 : openCount(l.id);
                  return (
                    <li key={l.id}>
                      <button
                        type="button"
                        disabled={l.soon}
                        onClick={() => {
                          setLineId(l.id);
                          setOpenId(null);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                          active
                            ? "bg-brand text-brand-foreground"
                            : l.soon
                              ? "cursor-not-allowed text-muted-foreground/60"
                              : "text-foreground hover:bg-brand-tint"
                        }`}
                      >
                        <l.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 truncate">{l.label}</span>
                        {l.soon ? (
                          <span className="text-[10px] uppercase">Soon</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px]">
                            {oc ? (
                              <span className="rounded-full bg-warning px-1.5 font-semibold text-foreground">
                                {oc}
                              </span>
                            ) : null}
                            <span className={active ? "" : "text-muted-foreground"}>{count(l.id)}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="min-w-0 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <line.icon className="h-4 w-4 text-brand" />
                {line.label}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">{line.blurb}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
              Only cases waiting on Loqal
            </label>
          </div>

          {line.audiences.length > 1 ? (
            <div className="mt-4 inline-flex rounded-full border border-border p-0.5">
              {line.audiences.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAudience(a)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    aud === a ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {line.id === "registration" && a === "client" ? "Corporate clients" : line.id === "registration" ? "Partners" : AUDIENCE_LABEL[a]}
                  <span className="ml-1.5 opacity-70">{data[line.id][a]?.length ?? 0}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {AUDIENCE_LABEL[aud]} only
            </div>
          )}

          {rows.length === 0 ? (
            <p className="mt-6 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {onlyOpen ? "Nothing is waiting on Loqal here." : "No cases in this line yet."}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
              {rows.map((r) => {
                const body = (
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${r.needsLoqal ? "bg-warning" : "bg-success"}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{r.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>
                    </div>
                    <span
                      className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline ${
                        r.needsLoqal ? "bg-warning/15 text-foreground" : "bg-brand-tint text-brand"
                      }`}
                    >
                      {r.needsLoqal ? "Loqal to act · " : ""}
                      {r.status}
                    </span>
                    <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                      {formatDate(r.since)}
                    </span>
                  </div>
                );
                return (
                  <li key={r.key} className="transition-colors hover:bg-brand-tint/40">
                    {r.visaId ? (
                      <button type="button" className="w-full text-left" onClick={() => setVisaOpen(r.visaId!)}>
                        {body}
                      </button>
                    ) : r.leadId ? (
                      <button type="button" className="w-full text-left" onClick={() => setOpenId(r.leadId!)}>
                        {body}
                      </button>
                    ) : r.href ? (
                      <Link to={r.href as never} className="block">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {open ? <CaseDetail lead={open} onClose={() => setOpenId(null)} /> : null}
          <VisaStatusDialog
            request={visaRequests.find((v) => v.id === visaOpen)}
            onClose={() => setVisaOpen(null)}
          />
        </div>
      </div>
    </section>
  );
}
