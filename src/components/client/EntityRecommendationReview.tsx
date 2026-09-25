/** Client: review Loqal's entity recommendation — confirm, or pick specific items to change. */
import { useState } from "react";
import { toast } from "sonner";
import { Building2, Check, ChevronDown, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/dates";
import { useDeepLinkAction } from "@/lib/deep-link";
import { respondToRecommendation, type EntitySetupRequest } from "@/lib/entity-setup";
import { recommendationRows } from "@/lib/entity-recommendation";

export function EntityRecommendationReview({ request }: { request: EntitySetupRequest }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "changes">("view");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useDeepLinkAction("entity-recommendation", () => setOpen(true));
  const rec = request.recommendation;
  if (!rec) return null;
  const rows = recommendationRows(rec);
  const resp = request.response;
  const waiting = !resp;

  async function submit(decision: "confirmed" | "changes") {
    const items = rows.filter((r) => r.key in picked).map((r) => ({ key: r.key, label: r.label, note: picked[r.key]!.trim() }));
    if (decision === "changes" && (!items.length || items.some((i) => !i.note))) {
      toast("Choose what to change and describe it for each item.");
      return;
    }
    setBusy(true);
    try {
      await respondToRecommendation(request, { decision, at: new Date().toISOString(), ...(items.length ? { items } : {}), ...(note.trim() ? { note: note.trim() } : {}) });
      toast.success(decision === "confirmed" ? "Confirmed — Loqal starts the formation" : "Sent — your entity manager will revise the recommendation");
      setOpen(false);
      setMode("view");
      setPicked({});
      setNote("");
    } catch {
      toast.error("Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`mt-3 rounded-lg border p-3 ${waiting ? "border-gold/50 bg-gold-tint/40" : "border-border"}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Building2 className="size-4 text-brand" aria-hidden />
            Entity recommendation · {rec.entityType} in {rec.formationState}
          </div>
          <Button size="sm" variant={waiting ? "default" : "outline"} onClick={() => setOpen(true)}>
            {waiting ? "Review and confirm" : "View recommendation"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {resp?.decision === "confirmed"
            ? `You confirmed it on ${formatDateTime(resp.at)}.`
            : resp?.decision === "changes"
              ? "You asked for changes — your entity manager is revising it."
              : `Sent by ${rec.sentBy} on ${formatDateTime(rec.sentAt)} — please review.`}
        </p>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Your entity recommendation{rec.version > 1 ? ` (revised v${rec.version})` : ""}</DialogTitle>
            <DialogDescription>Prepared by {rec.sentBy}. Confirm it, or choose the exact items you would like changed.</DialogDescription>
          </DialogHeader>
          {mode === "view" ? (
            <div className="overflow-hidden rounded-lg border border-border">
              {rows.map((r) => (
                <div key={r.key} className="grid grid-cols-[10rem_1fr] gap-3 border-b border-border px-3 py-2 text-sm last:border-0">
                  <span className="text-xs font-semibold text-muted-foreground">{r.label}</span>
                  <span className="whitespace-pre-wrap text-foreground">{r.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <ul className="overflow-hidden rounded-lg border border-border">
              {rows.map((r) => {
                const on = r.key in picked;
                return (
                  <li key={r.key} className={`border-b border-border last:border-0 ${on ? "bg-brand-tint/30" : ""}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setPicked((p) => {
                          const n = { ...p };
                          if (on) delete n[r.key];
                          else n[r.key] = "";
                          return n;
                        })
                      }
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                    >
                      <span className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}>
                        {on ? <Check className="size-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{r.label}</span>
                        <span className="block text-xs text-muted-foreground">Now: {r.value}</span>
                      </span>
                      <ChevronDown className={`size-4 text-muted-foreground ${on ? "rotate-180" : ""}`} aria-hidden />
                    </button>
                    {on ? (
                      <div className="px-3 pb-3 pl-10">
                        <textarea
                          rows={2}
                          autoFocus
                          value={picked[r.key]}
                          onChange={(e) => setPicked((p) => ({ ...p, [r.key]: e.target.value }))}
                          placeholder="What would you like instead?"
                          className="w-full rounded-md border border-gold/50 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
                        />
                      </div>
                    ) : null}
                  </li>
                );
              })}
              <li className="p-3">
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything else (optional)" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand" />
              </li>
            </ul>
          )}
          {waiting ? (
            <div className="flex flex-wrap justify-end gap-2">
              {mode === "view" ? (
                <>
                  <Button variant="outline" onClick={() => setMode("changes")}>
                    <PencilLine /> Ask for changes
                  </Button>
                  <Button disabled={busy} onClick={() => submit("confirmed")}>
                    <Check /> Confirm recommendation
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setMode("view")}>Back to summary</Button>
                  <Button disabled={busy} onClick={() => submit("changes")}>Send change request</Button>
                </>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
