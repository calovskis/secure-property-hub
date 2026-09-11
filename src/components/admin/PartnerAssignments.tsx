/**
 * Admin views of the partner ↔ client relationship.
 *
 * • ClientPartnersTab — on a client profile: which partners serve each of the
 *   client's property files, what happened with each of them, and a manual
 *   change (which the receiving partner must accept) with a full change log.
 * • PartnerClientsTab — on a partner profile: every client the partner works
 *   with today plus the ones they worked with historically, with their
 *   activity and correspondence on file.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/dates";
import { useAuth } from "@/lib/auth";
import { useLeads, type MortgageLead } from "@/lib/leads";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { useBuyerProcess } from "@/lib/buyer-process";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import {
  PARTNER_ROLE_LABEL,
  approvedPartners,
  buildBriefing,
  currentPartner,
  historyForPartner,
  partnerLabel,
  useHandovers,
  type Handover,
  type PartnerRole,
} from "@/lib/partner-assignments";
import type { AdminPerson } from "@/components/admin/people-model";

const uid = () => Math.random().toString(36).slice(2, 10);

/* ------------------------------------------------------------------ */
/* Shared building blocks                                              */
/* ------------------------------------------------------------------ */

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Chip({ tone, children }: { tone: "ok" | "wait" | "off"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "bg-brand-tint text-brand"
      : tone === "wait"
        ? "bg-gold/15 text-gold"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>
  );
}

/** Plain-language list of what happened between this client and this partner. */
function activityFor(
  lead: MortgageLead,
  role: PartnerRole,
  proc: ReturnType<typeof useBuyerProcess>,
): { at: string; text: string }[] {
  const out: { at: string; text: string }[] = [];
  if (role === "lender") {
    out.push({ at: lead.submittedAt, text: "Pre-approval application received" });
    for (const r of lead.infoRequests) {
      out.push({ at: r.requestedAt, text: `Information requested: ${r.question}` });
      if (r.answeredAt) out.push({ at: r.answeredAt, text: "Client answered the request" });
    }
    if (lead.terms && lead.decidedAt)
      out.push({
        at: lead.decidedAt,
        text: `Terms issued — ${lead.terms.ratePct}% for ${lead.terms.termYears} years`,
      });
    if (lead.clientDecisionAt)
      out.push({ at: lead.clientDecisionAt, text: `Client answered the terms: ${lead.clientDecision}` });
    for (const q of lead.clientQuestions ?? []) {
      out.push({ at: q.askedAt, text: `Client question: ${q.text}` });
      if (q.answeredAt) out.push({ at: q.answeredAt, text: "Lender answered the question" });
    }
  } else {
    if (lead.buyerAgent?.assignedAt)
      out.push({ at: lead.buyerAgent.assignedAt, text: "Buyer's agent assigned to the file" });
    if (lead.buyerAgent?.kickoffAt)
      out.push({
        at: lead.buyerAgent.kickoffAt,
        text: `Client chose how to start: ${lead.buyerAgent.kickoff ?? lead.buyerAgent.representation ?? "—"}`,
      });
    const photo = proc.photos[lead.id];
    if (photo) out.push({ at: photo.requestedAt, text: `Photo visit — ${photo.status}` });
    for (const b of proc.bookings.filter((x) => x.leadId === lead.id))
      out.push({ at: b.createdAt, text: `${b.kind.replace(/_/g, " ")} — ${b.status}` });
    for (const a of proc.actions[lead.id] ?? [])
      out.push({ at: a.createdAt, text: `Buyer decision: ${a.kind.replace(/_/g, " ")}` });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/* ------------------------------------------------------------------ */
/* Client profile — partners on each file                              */
/* ------------------------------------------------------------------ */

export function ClientPartnersTab({ person }: { person: AdminPerson }) {
  const { leads } = useLeads();
  const { requests } = usePartnerRequests();
  const proc = useBuyerProcess();
  const { handovers } = useHandovers();
  const [change, setChange] = useState<{ lead: MortgageLead; role: PartnerRole } | null>(null);

  const own = useMemo(
    () =>
      leads
        .filter((l) => l.clientEmail.toLowerCase() === person.email.toLowerCase())
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [leads, person.email],
  );

  if (!own.length)
    return (
      <p className="text-sm text-muted-foreground">
        This client has no property file yet, so no partner is working for them.
      </p>
    );

  return (
    <div className="space-y-5">
      {own.map((lead) => (
        <Panel key={lead.id} title={lead.propertyLabel}>
          <div className="space-y-4">
            {(["lender", "realtor"] as PartnerRole[]).map((role) => {
              const partner = currentPartner(lead, role, requests);
              const pending = handovers.find(
                (h) => h.leadId === lead.id && h.role === role && h.status === "pending",
              );
              const events = activityFor(lead, role, proc);
              return (
                <div key={role} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {PARTNER_ROLE_LABEL[role]}
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-foreground">
                        {partner ? partnerLabel(partner) : "Not assigned yet"}
                      </div>
                      {partner ? (
                        <div className="text-xs text-muted-foreground">{partner.email}</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      {pending ? (
                        <Chip tone="wait">Waiting for {pending.toName} to accept</Chip>
                      ) : partner ? (
                        <Chip tone="ok">Active</Chip>
                      ) : (
                        <Chip tone="off">None</Chip>
                      )}
                      <button
                        type="button"
                        onClick={() => setChange({ lead, role })}
                        className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand hover:text-brand"
                      >
                        Change partner
                      </button>
                    </div>
                  </div>

                  {events.length ? (
                    <ul className="mt-3 space-y-1 text-xs">
                      {events.slice(0, 6).map((e, i) => (
                        <li key={`${e.at}-${i}`} className="flex gap-2">
                          <span className="w-32 shrink-0 text-muted-foreground">
                            {formatDateTime(e.at)}
                          </span>
                          <span className="text-foreground">{e.text}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">No activity recorded yet.</p>
                  )}
                </div>
              );
            })}

            <ChangeLog lead={lead} handovers={handovers} />
          </div>
        </Panel>
      ))}

      {change ? (
        <ChangePartnerDialog
          lead={change.lead}
          role={change.role}
          onClose={() => setChange(null)}
        />
      ) : null}
    </div>
  );
}

function ChangeLog({ lead, handovers }: { lead: MortgageLead; handovers: Handover[] }) {
  const rows = handovers
    .filter((h) => h.leadId === lead.id)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const recorded = lead.partnerChanges ?? [];
  if (!rows.length && !recorded.length) return null;
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Partner change record
      </div>
      <ul className="mt-1.5 space-y-1.5 text-xs">
        {rows.map((h) => (
          <li key={h.id} className="text-foreground">
            {formatDateTime(h.requestedAt)} · {PARTNER_ROLE_LABEL[h.role]} ·{" "}
            {h.fromName ?? "unassigned"} → {h.toName} · changed by {h.requestedBy} ·{" "}
            <span
              className={
                h.status === "accepted"
                  ? "font-semibold text-brand"
                  : h.status === "declined"
                    ? "font-semibold text-destructive"
                    : "font-semibold text-gold"
              }
            >
              {h.status === "pending"
                ? "awaiting new partner's confirmation"
                : `${h.status} ${h.respondedAt ? formatDate(h.respondedAt) : ""}`}
            </span>
            {h.reason ? <span className="text-muted-foreground"> · {h.reason}</span> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Change partner dialog                                               */
/* ------------------------------------------------------------------ */

function ChangePartnerDialog({
  lead,
  role,
  onClose,
}: {
  lead: MortgageLead;
  role: PartnerRole;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { requests } = usePartnerRequests();
  const { request } = useHandovers();
  const current = currentPartner(lead, role, requests);
  const options = approvedPartners(requests, role).filter((p) => p.id !== current?.id);
  const [toId, setToId] = useState(options[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [briefing, setBriefing] = useState(buildBriefing(lead, role));

  function submit() {
    const target = options.find((o) => o.id === toId);
    if (!target) return;
    request({
      leadId: lead.id,
      role,
      clientEmail: lead.clientEmail,
      clientName: lead.clientName,
      propertyLabel: lead.propertyLabel,
      ...(current ? { fromId: current.id, fromName: partnerLabel(current) } : {}),
      toId: target.id,
      toName: `${target.firstName} ${target.lastName}`.trim(),
      toEmail: target.email,
      toCompany: target.companyName,
      reason: reason.trim(),
      briefing,
      requestedBy: user?.email ?? "Loqal admin",
    });
    notify({
      id: `handover-offer-${lead.id}-${role}-${target.id}`,
      to: target.email.toLowerCase(),
      title: `New client offered to you — ${lead.clientName}`,
      body: `${lead.propertyLabel}. Review the briefing and confirm before the file moves to you.`,
      href: "/partner?tab=home&open=handover",
      severity: "warning",
    });
    logActivity(
      user?.email ?? "Loqal admin",
      `changed the ${PARTNER_ROLE_LABEL[role].toLowerCase()} on a client file`,
      `${lead.clientName} · ${current ? partnerLabel(current) : "unassigned"} → ${target.firstName} ${target.lastName}`,
    );
    toast("Change requested", {
      description: `${target.firstName} ${target.lastName} must confirm the client before the file moves.`,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-foreground">
          Change the {PARTNER_ROLE_LABEL[role].toLowerCase()}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {lead.clientName} · {lead.propertyLabel}. The new partner receives the briefing below and
          must accept the client. The client is informed once they do.
        </p>

        {options.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No other approved {PARTNER_ROLE_LABEL[role].toLowerCase()} partner is available yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                New partner
              </span>
              <select
                value={toId}
                onChange={(e) => setToId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {partnerLabel(o)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Reason for the change
              </span>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. client asked for a Russian-speaking agent"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Briefing for the new partner
              </span>
              <textarea
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                rows={8}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs outline-none focus:border-brand"
              />
            </label>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!toId}
            onClick={submit}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            Send to new partner
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Partner profile — clients they work with                            */
/* ------------------------------------------------------------------ */

export function PartnerClientsTab({ person }: { person: AdminPerson }) {
  const { leads } = useLeads();
  const { requests } = usePartnerRequests();
  const proc = useBuyerProcess();
  const { handovers } = useHandovers();

  const partnerId = person.request?.id;
  const role: PartnerRole | null =
    person.partnerType === "lender" || person.partnerType === "realtor"
      ? person.partnerType
      : null;

  const current = useMemo(() => {
    if (!role || !partnerId) return [];
    return leads
      .filter((l) => currentPartner(l, role, requests)?.id === partnerId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }, [leads, requests, role, partnerId]);

  const past = useMemo(() => {
    const movedAway = historyForPartner(handovers, partnerId).filter(
      (h) => h.fromId === partnerId && h.status === "accepted",
    );
    return movedAway
      .map((h) => ({ handover: h, lead: leads.find((l) => l.id === h.leadId) }))
      .filter((x) => x.lead)
      .sort((a, b) => (b.handover.respondedAt ?? "").localeCompare(a.handover.respondedAt ?? ""));
  }, [handovers, leads, partnerId]);

  if (!role)
    return (
      <p className="text-sm text-muted-foreground">
        Client files are tracked for mortgage lender and buyer's agent partners.
      </p>
    );

  return (
    <div className="space-y-5">
      <Panel title={`Clients currently on file (${current.length})`}>
        {current.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active clients right now.</p>
        ) : (
          <div className="space-y-3">
            {current.map((lead) => (
              <ClientRow key={lead.id} lead={lead} role={role} proc={proc} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`Past clients (${past.length})`}>
        {past.length === 0 ? (
          <p className="text-xs text-muted-foreground">No clients have moved away from this partner.</p>
        ) : (
          <div className="space-y-3">
            {past.map(({ handover, lead }) => (
              <div key={handover.id} className="rounded-lg border border-border/70 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">
                    {handover.clientName} · {handover.propertyLabel}
                  </div>
                  <Chip tone="off">
                    Moved to {handover.toName}
                    {handover.respondedAt ? ` · ${formatDate(handover.respondedAt)}` : ""}
                  </Chip>
                </div>
                {handover.reason ? (
                  <p className="mt-1 text-xs text-muted-foreground">Reason: {handover.reason}</p>
                ) : null}
                {lead ? (
                  <ul className="mt-2 space-y-1 text-xs">
                    {activityFor(lead, role, proc)
                      .slice(0, 4)
                      .map((e, i) => (
                        <li key={`${e.at}-${i}`} className="flex gap-2">
                          <span className="w-32 shrink-0 text-muted-foreground">
                            {formatDateTime(e.at)}
                          </span>
                          <span className="text-foreground">{e.text}</span>
                        </li>
                      ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function ClientRow({
  lead,
  role,
  proc,
}: {
  lead: MortgageLead;
  role: PartnerRole;
  proc: ReturnType<typeof useBuyerProcess>;
}) {
  const [open, setOpen] = useState(false);
  const events = activityFor(lead, role, proc);
  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{lead.clientName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {lead.propertyLabel} · ${lead.propertyPrice.toLocaleString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Chip tone="ok">{lead.status}</Chip>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand hover:text-brand"
          >
            {open ? "Hide activity" : "See activity"}
          </button>
        </div>
      </div>
      {open ? (
        events.length ? (
          <ul className="mt-3 space-y-1 text-xs">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="flex gap-2">
                <span className="w-32 shrink-0 text-muted-foreground">{formatDateTime(e.at)}</span>
                <span className="text-foreground">{e.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No activity recorded yet.</p>
        )
      ) : null}
    </div>
  );
}

export { uid as handoverUid };
