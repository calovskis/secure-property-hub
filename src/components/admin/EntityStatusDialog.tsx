import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileText, UserCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  ENTITY_STATUS_LABEL,
  MANUAL_ENTITY_STATUSES,
  useEntityRequests,
  type EntitySetupRequest,
  type EntityStatus,
} from "@/lib/entity-setup";
import { recommendationRows } from "@/lib/entity-recommendation";
import { useMyPermissions, useStaff } from "@/lib/staff";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaseThread } from "@/components/cases/CaseThread";
import { EntityRecommendationDialog } from "@/components/admin/EntityRecommendationDialog";

const select = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand";

export function EntityStatusDialog({ request, onClose }: { request: EntitySetupRequest | undefined; onClose: () => void }) {
  const { user } = useAuth();
  const { update, assignManager } = useEntityRequests();
  const { members } = useStaff();
  const { can } = useMyPermissions(user?.email, user?.role === "admin");
  const [status, setStatus] = useState<EntityStatus>("requested");
  const [note, setNote] = useState("");
  const [managerId, setManagerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [recOpen, setRecOpen] = useState(false);

  useEffect(() => {
    if (!request) return;
    setStatus(request.status);
    setNote("");
    setManagerId(request.manager?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request?.id]);

  if (!request) return null;
  const by = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "Loqal";
  const first = request.clientName.split(" ")[0] ?? "";
  const canAssign = can("entity.assign");
  const rec = request.recommendation;
  const resp = request.response;

  const saveStatus = async () => {
    setBusy(true);
    try {
      await update(request, status, by, note.trim() || undefined);
      toast.success(`Status updated — ${first} can see the progress`);
      setNote("");
    } catch {
      toast.error("Could not update the status. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const saveManager = async () => {
    const m = members.find((x) => x.id === managerId);
    if (!m) return;
    setBusy(true);
    try {
      await assignManager(request, { id: m.id, name: m.name, email: m.email, title: m.title }, by);
      toast.success(`${m.name} assigned — ${first} is notified and sees the contact`);
    } catch {
      toast.error("Could not assign the manager. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const statusOptions = MANUAL_ENTITY_STATUSES.includes(request.status) ? MANUAL_ENTITY_STATUSES : [request.status, ...MANUAL_ENTITY_STATUSES];

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Company set-up support — {request.clientName}</DialogTitle>
          <DialogDescription>
            Requested {formatDate(request.requestedAt)}
            {request.propertyLabel ? ` · ${request.propertyLabel}` : ""}. Current status:{" "}
            <span className="font-semibold text-foreground">{ENTITY_STATUS_LABEL[request.status]}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <UserCheck className="size-4 text-brand" aria-hidden /> Entity manager
            </div>
            {request.manager ? (
              <p className="mb-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{request.manager.name}</span> · {request.manager.title} — assigned {formatDate(request.manager.assignedAt)} by {request.manager.assignedBy}
              </p>
            ) : (
              <p className="mb-2 text-xs text-warning">No manager yet — {first} sees "assigning your entity manager".</p>
            )}
            {canAssign ? (
              <div className="flex gap-2">
                <select className={select} value={managerId} onChange={(e) => setManagerId(e.target.value)} aria-label="Entity manager">
                  <option value="">Choose a Loqal employee…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.title}
                    </option>
                  ))}
                </select>
                <Button size="sm" disabled={busy || !managerId || managerId === request.manager?.id} onClick={saveManager}>
                  {request.manager ? "Reassign" : "Assign"}
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">Only employees allowed to assign entity managers can change this.</p>
            )}
          </section>

          <section className="rounded-lg border border-border p-3">
            <div className="mb-2 text-sm font-semibold text-foreground">Progress status</div>
            <select className={select} value={status} onChange={(e) => setStatus(e.target.value as EntityStatus)} aria-label="Progress status">
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {ENTITY_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <input className={`${select} mt-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the client (optional)" />
            <div className="mt-2 flex justify-end">
              <Button size="sm" disabled={busy || (status === request.status && !note.trim())} onClick={saveStatus}>
                Update status
              </Button>
            </div>
          </section>
        </div>

        <section className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <FileText className="size-4 text-brand" aria-hidden /> Entity recommendation
              {rec ? <span className="text-xs font-normal text-muted-foreground">· v{rec.version} sent {formatDate(rec.sentAt)}</span> : null}
            </div>
            {resp?.decision === "confirmed" ? null : (
              <Button size="sm" variant={rec ? "outline" : "default"} disabled={!request.manager} onClick={() => setRecOpen(true)}>
                {!rec ? "Prepare recommendation" : resp?.decision === "changes" ? "Revise recommendation" : "Edit and resend"}
              </Button>
            )}
          </div>
          {!request.manager ? <p className="mt-1 text-xs text-muted-foreground">Assign an entity manager first.</p> : null}
          {resp ? (
            <p className={`mt-2 rounded-md px-3 py-2 text-xs ${resp.decision === "confirmed" ? "bg-success/10 text-success" : "border border-gold/50 bg-gold-tint/40 text-foreground"}`}>
              {resp.decision === "confirmed"
                ? `Confirmed by ${first} on ${formatDateTime(resp.at)}`
                : `${first} asked for changes on ${formatDateTime(resp.at)}: ${(resp.items ?? []).map((i) => `${i.label} — ${i.note}`).join("; ")}${resp.note ? ` · “${resp.note}”` : ""}`}
            </p>
          ) : rec ? (
            <p className="mt-2 text-xs text-muted-foreground">Awaiting {first}'s review.</p>
          ) : null}
          {rec ? (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-semibold text-brand">Show sent recommendation</summary>
              <div className="mt-2 overflow-hidden rounded-md border border-border">
                {recommendationRows(rec).map((r) => (
                  <div key={r.key} className="grid grid-cols-[10rem_1fr] gap-3 border-b border-border px-3 py-1.5 text-xs last:border-0">
                    <span className="font-semibold text-muted-foreground">{r.label}</span>
                    <span className="text-foreground">{r.value}</span>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <CaseThread caseKind="entity" caseId={request.id} clientUserId={request.userId} viewer="loqal" authorName={by} clientFirstName={first} />

        {request.history.length ? (
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">History ({request.history.length})</summary>
            <ul className="mt-1 space-y-1 text-xs">
              {[...request.history].reverse().map((h, i) => (
                <li key={i} className="flex justify-between gap-3 border-b border-border pb-1">
                  <span className="text-foreground">
                    {ENTITY_STATUS_LABEL[h.status] ?? h.status}
                    {h.note ? <span className="text-muted-foreground"> — “{h.note}”</span> : null}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {h.by} · {formatDateTime(h.at)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <EntityRecommendationDialog open={recOpen} onOpenChange={setRecOpen} request={request} by={by} />
      </DialogContent>
    </Dialog>
  );
}
