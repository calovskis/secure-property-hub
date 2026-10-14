/** Direct messages and call-time proposals between an inspection company and the buyer's agent. */
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/form/DateInput";
import { notify } from "@/lib/notifications";
import { formatDateTime } from "@/lib/dates";
import { chooseCallSlot, sendInspectionMessage, useInspectionMessages, type InspectionRequest } from "@/lib/inspections";

const input = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground";

export function InspectionThread({ r, side, inspectorUserId, inspectorEmail, authorName, counterpartEmail }: {
  r: InspectionRequest; side: "inspector" | "agent"; inspectorUserId: string; inspectorEmail: string; authorName: string; counterpartEmail?: string | undefined;
}) {
  const { messages, refresh } = useInspectionMessages(r.id, inspectorUserId);
  const [body, setBody] = useState("");
  const [proposing, setProposing] = useState(false);
  const [slots, setSlots] = useState([{ date: "", time: "10:00" }, { date: "", time: "14:00" }, { date: "", time: "11:00" }]);
  const [busy, setBusy] = useState(false);

  async function send() {
    const callSlots = proposing ? slots.filter((s) => s.date).map((s) => new Date(`${s.date}T${s.time}`).toISOString()) : [];
    if (!body.trim() && !callSlots.length) return;
    setBusy(true);
    try {
      await sendInspectionMessage({ requestId: r.id, inspectorUserId, inspectorEmail, fromSide: side, authorName, body: body.trim() || "Proposed call times", callSlots });
      if (counterpartEmail) notify({
        id: `inspection-msg-${r.id}-${Date.now()}`, to: counterpartEmail.toLowerCase(),
        title: callSlots.length ? "Call times proposed for an inspection" : side === "inspector" ? "Message from an inspection company" : "Message from the buyer's agent",
        body: `${r.propertyLabel} — ${authorName}: ${(body.trim() || "please choose a call time").slice(0, 120)}`,
        href: side === "inspector" ? `/partner?tab=buyers&focus=${r.leadId}` : "/partner?tab=cases", severity: "info",
      });
      setBody(""); setProposing(false); await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Message not sent"); } finally { setBusy(false); }
  }

  async function pick(id: string, slot: string, author: string) {
    try {
      await chooseCallSlot(id, slot);
      if (counterpartEmail) notify({ id: `inspection-call-${id}`, to: counterpartEmail.toLowerCase(), title: "Call time confirmed", body: `${r.propertyLabel} — ${authorName} confirmed ${formatDateTime(slot)}.`, href: side === "inspector" ? `/partner?tab=buyers&focus=${r.leadId}` : "/partner?tab=cases", severity: "info" });
      toast(`Call confirmed with ${author}`); await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't confirm"); }
  }

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {messages.length === 0 ? <p className="text-xs text-muted-foreground">No messages yet.</p> : messages.map((m) => {
          const mine = m.fromSide === side;
          return (
            <div key={m.id} className={`rounded-md px-3 py-2 text-xs ${mine ? "ml-8 bg-brand-tint/50" : "mr-8 bg-muted/50"}`}>
              <p className="font-semibold text-foreground">{m.authorName} <span className="font-normal text-muted-foreground">· {formatDateTime(m.createdAt)}</span></p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{m.body}</p>
              {m.callSlots.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.chosenSlot ? <span className="inline-flex items-center gap-1 rounded bg-success/10 px-2 py-1 font-semibold text-success"><CalendarClock className="size-3.5" aria-hidden /> Call {formatDateTime(m.chosenSlot)}</span>
                    : m.callSlots.map((s) => mine
                      ? <span key={s} className="rounded border border-border px-2 py-1 text-muted-foreground">{formatDateTime(s)}</span>
                      : <Button key={s} size="sm" variant="outline" onClick={() => pick(m.id, s, m.authorName)}>{formatDateTime(s)}</Button>)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      {proposing ? (
        <div className="mt-3 grid gap-2">
          {slots.map((s, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_110px] items-center gap-2 text-xs text-muted-foreground">
              <span>Option {i + 1}</span>
              <DateInput value={s.date} onChange={(v) => setSlots(slots.map((x, j) => (j === i ? { ...x, date: v } : x)))} />
              <input type="time" aria-label={`Option ${i + 1} time`} className={input} value={s.time} onChange={(e) => setSlots(slots.map((x, j) => (j === i ? { ...x, time: e.target.value } : x)))} />
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex gap-2">
        <input className={input} placeholder="Write a message…" value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} />
        <Button size="sm" variant="outline" onClick={() => setProposing((p) => !p)}><CalendarClock aria-hidden /> {proposing ? "No call" : "Schedule call"}</Button>
        <Button size="sm" disabled={busy} onClick={send}><Send aria-hidden /> Send</Button>
      </div>
    </div>
  );
}
