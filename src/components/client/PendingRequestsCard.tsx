/**
 * Client dashboard: Loqal support cases (visa, company set-up) with a brief
 * status and any requests awaiting the client's answer. Each opens the case
 * communication in a pop-up.
 */
import { useState } from "react";
import { CalendarClock, FileQuestion, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { pendingForClient, useCaseMessages, type CaseKind } from "@/lib/case-messages";
import { VISA_STATUS_LABEL, isVisaOpen, useVisaRequests } from "@/lib/visa-support";
import { ENTITY_STATUS_LABEL, isEntityOpen, useEntityRequests } from "@/lib/entity-setup";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaseThread } from "@/components/cases/CaseThread";

type Row = { kind: CaseKind; id: string; userId: string; title: string; status: string; open: boolean };

export function PendingRequestsCard() {
  const { user } = useAuth();
  const email = user?.email.toLowerCase() ?? "";
  const { requests: visa } = useVisaRequests();
  const { requests: entity } = useEntityRequests();
  const { all } = useCaseMessages();
  const [openCase, setOpenCase] = useState<Row | null>(null);

  const rows: Row[] = [
    ...visa
      .filter((v) => v.email === email)
      .map((v) => ({ kind: "visa" as const, id: v.id, userId: v.userId, title: "Visa support", status: VISA_STATUS_LABEL[v.status], open: isVisaOpen(v) })),
    ...entity
      .filter((e) => e.email === email)
      .map((e) => ({
        kind: "entity" as const,
        id: e.id,
        userId: e.userId,
        title: `Company set-up${e.propertyLabel ? ` · ${e.propertyLabel}` : ""}`,
        status: ENTITY_STATUS_LABEL[e.status],
        open: isEntityOpen(e),
      })),
  ];
  if (!rows.length) return null;
  const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "Client";

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h2 className="text-sm font-semibold text-foreground">Pending requests</h2>
      <p className="mb-3 text-xs text-muted-foreground">Your Loqal support cases and anything we need from you.</p>
      <div className="space-y-2">
        {rows.map((r) => {
          const msgs = all.filter((m) => m.caseKind === r.kind && m.caseId === r.id);
          const pending = pendingForClient(msgs);
          const nextCall = msgs.find((m) => m.kind === "call_request" && m.chosenSlot && new Date(m.chosenSlot) > new Date());
          return (
            <button
              key={`${r.kind}-${r.id}`}
              type="button"
              onClick={() => setOpenCase(r)}
              className={`block w-full rounded-lg border px-3 py-2.5 text-left hover:bg-muted/50 ${
                pending.length ? "border-warning bg-warning/10" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{r.title}</span>
                <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${r.open ? "bg-brand-tint text-brand" : "bg-success/10 text-success"}`}>
                  {r.status}
                </span>
              </div>
              {pending.map((p) => (
                <div key={p.id} className="mt-1.5 flex items-center gap-1.5 text-xs text-foreground">
                  {p.kind === "call_request" ? <CalendarClock className="h-3.5 w-3.5" /> : <FileQuestion className="h-3.5 w-3.5" />}
                  <span className="font-semibold">{p.kind === "call_request" ? "Choose a call time" : "Information requested"}</span>
                  <span className="truncate text-muted-foreground">— {p.body}</span>
                </div>
              ))}
              {nextCall ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-success">
                  <CalendarClock className="h-3.5 w-3.5" /> Call on {formatDateTime(nextCall.chosenSlot!)}
                </div>
              ) : null}
              {!pending.length && !nextCall ? (
                <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MessageSquare className="h-3.5 w-3.5" /> Open messages with Loqal
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
      <Dialog open={!!openCase} onOpenChange={(v) => !v && setOpenCase(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          {openCase ? (
            <>
              <DialogHeader>
                <DialogTitle>{openCase.title} — messages with Loqal</DialogTitle>
                <DialogDescription>Status: {openCase.status}</DialogDescription>
              </DialogHeader>
              <CaseThread caseKind={openCase.kind} caseId={openCase.id} clientUserId={openCase.userId} viewer="client" authorName={name} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
