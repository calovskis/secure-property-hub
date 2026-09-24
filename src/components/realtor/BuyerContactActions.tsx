import { useState } from "react";
import { toast } from "sonner";
import { FilePlus2, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CallScheduler } from "@/components/buyer/CallScheduler";
import { sendFileMessage } from "@/lib/file-chat";
import { notify } from "@/lib/notifications";
import { formatDateTime } from "@/lib/dates";
import { useBuyerProcess } from "@/lib/buyer-process";

const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-brand";

/** Realtor → buyer: raise a new request or book a call. */
export function BuyerContactActions({ leadId, propertyId, propertyLabel, buyerName, buyerEmail, clientName, agentName, realtorId, agentEmail }: {
  leadId: string; propertyId: number; propertyLabel: string; buyerName: string; buyerEmail?: string | undefined;
  clientName: string; agentName: string; realtorId: string; agentEmail?: string | undefined;
}) {
  const [reqOpen, setReqOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [booked, setBooked] = useState<string | undefined>();
  const { bookCall } = useBuyerProcess();
  const href = `/property/${propertyId}/workspace?open=chat`;

  function sendRequest() {
    if (!subject.trim()) { toast("Add what you need from the buyer."); return; }
    sendFileMessage({ leadId, from: "agent", authorName: agentName, kind: "info_request", body: `${subject.trim()}${details.trim() ? `\n${details.trim()}` : ""}` });
    if (buyerEmail) notify({ id: `agent-request-${leadId}-${Date.now()}`, to: buyerEmail.toLowerCase(), title: "Your agent has a new request", body: `${propertyLabel} — ${subject.trim()}`, href, severity: "warning" });
    setSubject(""); setDetails(""); setReqOpen(false);
    toast("Request sent", { description: `${buyerName} will find it in your messages.` });
  }

  return <>
    <Button variant="outline" size="sm" onClick={() => setReqOpen(true)}><FilePlus2 /> New request</Button>
    <Button variant="outline" size="sm" onClick={() => setCallOpen(true)}><Phone /> Request a call</Button>

    <Dialog open={reqOpen} onOpenChange={setReqOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New request for {buyerName}</DialogTitle><DialogDescription>Ask for a document, a decision or information. It appears in your messages and {buyerName} is notified.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <input className={input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Proof of funds for the earnest money deposit" />
          <textarea className={input} rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details and deadline (optional)" />
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setReqOpen(false)}>Cancel</Button><Button onClick={sendRequest}>Send request</Button></div>
        </div>
      </DialogContent>
    </Dialog>

    <Dialog open={callOpen} onOpenChange={setCallOpen}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Request a call with {buyerName}</DialogTitle><DialogDescription>Pick a time from your calendar. {buyerName} gets the invitation and a Google Meet link.</DialogDescription></DialogHeader>
        <CallScheduler realtorId={realtorId} agentEmail={agentEmail} {...(booked ? { booked } : {})} summary={`Loqal — call about ${propertyLabel}`} description={`Call with your Loqal buyer's agent about ${propertyLabel}.`} onBook={(startAt, meeting) => {
          bookCall({ leadId, realtorId, clientName, ...(buyerEmail ? { clientEmail: buyerEmail } : {}), propertyLabel, kind: "intro_call", startAt, ...(meeting?.eventId ? { googleEventId: meeting.eventId } : {}), ...(meeting?.meetUrl ? { meetUrl: meeting.meetUrl } : {}), ...(meeting?.htmlLink ? { calendarLink: meeting.htmlLink } : {}) });
          setBooked(startAt);
          if (buyerEmail) notify({ id: `agent-call-${leadId}-${startAt}`, to: buyerEmail.toLowerCase(), title: "Your agent scheduled a call", body: `${propertyLabel} · ${formatDateTime(startAt)}`, href: "/", severity: "info" });
          toast("Call booked", { description: `${buyerName} · ${formatDateTime(startAt)}` });
        }} />
      </DialogContent>
    </Dialog>
  </>;
}
