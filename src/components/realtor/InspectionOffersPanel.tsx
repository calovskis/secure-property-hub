/** Buyer's agent: compare inspection offers, talk to companies, recommend one to the client. */
import { useState } from "react";
import { toast } from "sonner";
import { ClipboardCheck, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notifications";
import { formatDateTime } from "@/lib/dates";
import { InspectionThread } from "@/components/inspections/InspectionThread";
import { INSPECTION_STATUS_LABEL, selectInspectionOffer, useInspectionMessages, useInspectionOffers, useInspectionRequests, type InspectionOffer, type InspectionRequest } from "@/lib/inspections";

export function InspectionOffersPanel({ leadId, agentName }: { leadId: string; agentName: string }) {
  const { items, refresh } = useInspectionRequests(leadId);
  const live = items.filter((i) => i.status !== "cancelled");
  if (!live.length) return null;
  return (
    <div className="space-y-3 rounded-md border border-border bg-background p-3 text-xs">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><ClipboardCheck className="size-4 text-brand" aria-hidden /> Inspections</p>
      {live.map((r) => <RequestOffers key={r.id} r={r} agentName={agentName} onDone={refresh} />)}
    </div>
  );
}

function RequestOffers({ r, agentName, onDone }: { r: InspectionRequest; agentName: string; onDone: () => void }) {
  const { offers, refresh } = useInspectionOffers([r.id]);
  const { messages } = useInspectionMessages(r.id);
  const [note, setNote] = useState(r.agentNote ?? "");
  const [chatWith, setChatWith] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canChoose = r.status === "open" || r.status === "awaiting_client";
  const active = offers.filter((o) => o.status !== "withdrawn");
  const best = (key: (o: InspectionOffer) => number) => Math.min(...active.map(key));
  const firstVisit = (o: InspectionOffer) => (o.visitSlots[0] ? new Date(o.visitSlots[0]).getTime() : o.visitFlexible ? Number.MAX_SAFE_INTEGER - 1 : Number.MAX_SAFE_INTEGER);
  /* Threads include companies that only asked questions, without an offer yet. */
  const threads = new Map<string, { email: string; name: string }>();
  active.forEach((o) => threads.set(o.inspectorUserId, { email: o.contact?.email ?? "", name: o.company }));
  messages.forEach((m) => { if (!threads.has(m.inspectorUserId)) threads.set(m.inspectorUserId, { email: m.inspectorEmail, name: m.fromSide === "inspector" ? m.authorName : "Inspection company" }); });

  async function recommend(o: InspectionOffer) {
    setBusy(true);
    try {
      await selectInspectionOffer(o.id, note);
      notify({ id: `inspection-recommended-${r.id}`, to: r.clientEmail, title: "Confirm your inspection", body: `${r.propertyLabel} — your agent recommends ${o.company}: $${o.price.toLocaleString("en-US")}, report in ${o.reportDays} business days. Please confirm the price and timing.`, href: r.propertyId ? `/property/${r.propertyId}/workspace` : "/my-properties", severity: "warning" });
      toast("Recommendation sent to your buyer");
      await refresh(); onDone();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't send"); } finally { setBusy(false); }
  }

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-foreground">{r.inspectionTypes.join(", ")}{r.outsideAgreement ? <span className="ml-2 rounded bg-gold-tint px-1.5 py-0.5 text-[10px] text-gold">Outside agreement</span> : null}</p>
        <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand">{r.status === "awaiting_client" ? "Waiting for buyer's confirmation" : INSPECTION_STATUS_LABEL[r.status]}</span>
      </div>
      {r.status === "open" && r.offersDueAt ? <p className="mt-1 text-muted-foreground">Offers due {formatDateTime(r.offersDueAt)} · {active.length} received</p> : null}
      {r.inspectorCompany && r.status !== "awaiting_client" && r.status !== "open" ? <p className="mt-1 text-success">Confirmed: {r.inspectorCompany} · ${r.fee?.toLocaleString("en-US")}{r.proposedAt ? ` · ${formatDateTime(r.proposedAt)}` : ""}</p> : null}
      {active.length ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead className="text-[10px] uppercase text-muted-foreground"><tr><th className="py-1.5">Company</th><th>Price</th><th>Visit options</th><th>Report</th><th></th></tr></thead>
            <tbody className="divide-y divide-border">
              {active.map((o) => (
                <tr key={o.id} className={r.selectedOfferId === o.id ? "bg-brand-tint/30" : ""}>
                  <td className="py-2 pr-2"><p className="font-semibold text-foreground">{o.company}</p><p className="text-[10px] text-muted-foreground">{[o.contact?.name, o.contact?.phone].filter(Boolean).join(" · ")}</p>{o.note ? <p className="mt-1 text-[10px] text-muted-foreground">“{o.note}”</p> : null}</td>
                  <td className="pr-2 font-semibold text-foreground">${o.price.toLocaleString("en-US")}{o.price === best((x) => x.price) && active.length > 1 ? <span className="ml-1 text-[10px] text-success">lowest</span> : null}</td>
                  <td className="pr-2 text-muted-foreground">{o.visitFlexible ? <p>Flexible</p> : null}{o.visitSlots.map((s, i) => <p key={s}>{i + 1}. {formatDateTime(s)}</p>)}{firstVisit(o) === best(firstVisit) && active.length > 1 ? <p className="text-[10px] text-success">earliest</p> : null}</td>
                  <td className="pr-2 text-muted-foreground">{o.reportDays} business days{o.reportDays === best((x) => x.reportDays) && active.length > 1 ? <span className="ml-1 text-[10px] text-success">fastest</span> : null}</td>
                  <td className="space-y-1 text-right">
                    {canChoose ? <Button size="sm" disabled={busy} variant={r.selectedOfferId === o.id ? "secondary" : "default"} onClick={() => recommend(o)}><Star aria-hidden /> {r.selectedOfferId === o.id ? "Recommended" : "Recommend"}</Button> : r.selectedOfferId === o.id ? <span className="text-[10px] font-semibold text-success">Chosen</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-2 text-muted-foreground">No offers yet — inspection companies covering {r.state} have been notified.</p>}
      {canChoose && active.length ? <label className="mt-2 block text-muted-foreground">Note to your buyer (optional, shown with your recommendation)<input className="mt-1 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground" value={note} onChange={(e) => setNote(e.target.value)} placeholder="E.g. best balance of price and earliest visit" /></label> : null}
      {threads.size ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">{[...threads].map(([id, t]) => <Button key={id} size="sm" variant={chatWith === id ? "secondary" : "outline"} onClick={() => setChatWith(chatWith === id ? null : id)}><MessageSquare aria-hidden /> {t.name}</Button>)}</div>
          {chatWith ? <InspectionThread r={r} side="agent" inspectorUserId={chatWith} inspectorEmail={threads.get(chatWith)?.email ?? ""} authorName={agentName} counterpartEmail={threads.get(chatWith)?.email} /> : null}
        </div>
      ) : null}
    </div>
  );
}
