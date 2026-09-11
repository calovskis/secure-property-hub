/**
 * "A new client has been offered to you" card for partner portals.
 *
 * When a Loqal admin moves a client file to a different partner, the receiving
 * partner sees the offer here together with the situation briefing, and must
 * accept it before the client is onboarded to them. The client is informed
 * about the change only after that confirmation.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { useAuth } from "@/lib/auth";
import { useLeads, type PartnerChangeRecord } from "@/lib/leads";
import { usePartnerRequests } from "@/lib/partner-requests";
import { notify } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import {
  PARTNER_ROLE_LABEL,
  pendingFor,
  useHandovers,
  type Handover,
} from "@/lib/partner-assignments";

const uid = () => Math.random().toString(36).slice(2, 10);

export function ClientHandoverCard() {
  const { user } = useAuth();
  const { requests } = usePartnerRequests();
  const { leads, updateLead } = useLeads();
  const { handovers, respond } = useHandovers();
  const [openId, setOpenId] = useState<string | null>(null);

  const email = user?.email.toLowerCase() ?? "";
  const mine = requests.find((r) => r.email.toLowerCase() === email);
  const pending = useMemo(() => pendingFor(handovers, mine?.id), [handovers, mine?.id]);

  if (!user || user.role !== "partner" || !pending.length) return null;

  function accept(h: Handover) {
    respond(h.id, true);
    const lead = leads.find((l) => l.id === h.leadId);
    if (lead) {
      const record: PartnerChangeRecord = {
        id: uid(),
        role: h.role,
        ...(h.fromName ? { fromName: h.fromName } : {}),
        toName: h.toName,
        ...(h.reason ? { reason: h.reason } : {}),
        by: h.requestedBy,
        requestedAt: h.requestedAt,
        acceptedAt: new Date().toISOString(),
      };
      updateLead(lead.id, {
        ...(h.role === "realtor"
          ? {
              buyerAgent: {
                ...(lead.buyerAgent ?? { agreedAt: new Date().toISOString(), feePct: 3 }),
                agentId: h.toId,
                agentName: h.toName,
                assignedAt: new Date().toISOString(),
              },
            }
          : { lenderPartnerId: h.toId, lenderPartnerName: h.toName }),
        partnerChanges: [...(lead.partnerChanges ?? []), record],
      });
    }
    notify({
      id: `handover-client-${h.id}`,
      to: h.clientEmail.toLowerCase(),
      title: `You have a new ${PARTNER_ROLE_LABEL[h.role].toLowerCase()}`,
      body: `${h.toName}${h.toCompany ? ` (${h.toCompany})` : ""} now looks after ${h.propertyLabel}. They already have the full history of your file — nothing to repeat. Tap to read the note and contact them.`,
      href: `/?open=partner-change&focus=${h.id}`,
      severity: "info",
    });
    notify({
      id: `handover-admin-${h.id}`,
      to: "admins",
      title: "Partner change confirmed",
      body: `${h.toName} accepted ${h.clientName} · ${h.propertyLabel}.`,
      href: "/admin-people",
      severity: "info",
    });
    logActivity(user?.email ?? "partner", "accepted a client handover", `${h.clientName} · ${h.propertyLabel}`);
    toast("Client accepted", { description: `${h.clientName} is now on your desk.` });
  }

  function decline(h: Handover, note: string) {
    respond(h.id, false, note);
    notify({
      id: `handover-admin-${h.id}`,
      to: "admins",
      title: "Partner declined a client handover",
      body: `${h.toName} declined ${h.clientName} · ${h.propertyLabel}.${note ? ` Reason: ${note}` : ""}`,
      href: "/admin-people",
      severity: "warning",
    });
    toast("Declined", { description: "Loqal has been informed." });
  }

  return (
    <section className="rounded-xl border border-gold/40 bg-gold/5 p-4">
      <h2 className="text-sm font-bold text-foreground">
        New client{pending.length > 1 ? "s" : ""} offered to you
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Loqal would like to move {pending.length > 1 ? "these files" : "this file"} to you. Review
        the briefing and confirm before the client is onboarded.
      </p>
      <div className="mt-3 space-y-3">
        {pending.map((h) => (
          <div key={h.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  {h.clientName} · {h.propertyLabel}
                </div>
                <div className="text-xs text-muted-foreground">
                  {PARTNER_ROLE_LABEL[h.role]} · offered {formatDateTime(h.requestedAt)}
                  {h.fromName ? ` · previously with ${h.fromName}` : ""}
                </div>
                {h.reason ? (
                  <div className="mt-1 text-xs text-foreground">Reason: {h.reason}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpenId(openId === h.id ? null : h.id)}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-brand hover:text-brand"
              >
                {openId === h.id ? "Hide briefing" : "See briefing"}
              </button>
            </div>
            {openId === h.id ? (
              <pre className="mt-3 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-xs text-foreground">
                {h.briefing}
              </pre>
            ) : null}
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const note = window.prompt("Tell Loqal why you cannot take this client:") ?? "";
                  decline(h, note.trim());
                }}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => accept(h)}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
              >
                Accept client
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
