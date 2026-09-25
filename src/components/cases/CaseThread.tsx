/**
 * Chat line for a Loqal support case — styled like the client ↔ buyer's-agent
 * messages. Both sides write in one composer (text + files). Loqal also has
 * "New request" and "Request a call" pop-ups (same pattern as the realtor's
 * buyer actions); the client answers requests inline and can ask for a call.
 */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, FilePlus2, FileQuestion, Paperclip, Phone } from "lucide-react";
import { bookCaseCall } from "@/lib/google-calendar.functions";
import { GoogleCalendarCard } from "@/components/google/GoogleCalendarCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/dates";
import {
  caseFileName,
  markReadByLoqal,
  unreadByLoqal,
  openCaseFile,
  refreshCaseMessages,
  uploadCaseFile,
  useCaseMessages,
  useSendCaseMessage,
  type CaseKind,
  type CaseMessage,
} from "@/lib/case-messages";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand";

function Files({ paths }: { paths: string[] }) {
  if (!paths.length) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {paths.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => openCaseFile(p).catch(() => toast.error("Could not open the file"))}
          className="inline-flex items-center gap-1 rounded bg-background px-2 py-1 text-[11px] font-semibold text-brand underline"
        >
          <Paperclip className="h-3 w-3" aria-hidden />
          {caseFileName(p)}
        </button>
      ))}
    </div>
  );
}

function AttachButton({ onAdd, label = "Attach a file" }: { onAdd: (f: File[]) => void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-brand-tint">
      <Paperclip className="h-3.5 w-3.5" aria-hidden /> {label}
      <input
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
    </label>
  );
}

function FileList({ files, onRemove }: { files: File[]; onRemove: (i: number) => void }) {
  if (!files.length) return null;
  return (
    <ul className="mt-2 space-y-1.5">
      {files.map((f, i) => (
        <li key={i} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-1.5 text-[11px]">
          <span className="text-foreground">📎 {f.name}</span>
          <button type="button" onClick={() => onRemove(i)} className="font-semibold text-destructive">
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}

function ClientAnswer({ m, onSend }: { m: CaseMessage; onSend: (body: string, files: File[], slot?: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const isCall = m.kind === "call_request";
  const ok = isCall ? !!slot : !!body.trim() || files.length > 0;
  return (
    <div className="mt-2 space-y-2 rounded-md border border-border bg-background p-2.5">
      {isCall ? (
        <div className="space-y-1">
          <div className="text-[11px] font-semibold text-muted-foreground">Choose a time that suits you</div>
          {m.callSlots.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlot(s)}
              className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm ${slot === s ? "border-brand bg-brand-tint/60" : "border-border hover:border-brand/40"}`}
            >
              <CalendarClock className="size-3.5 text-brand" aria-hidden />
              {formatDateTime(s)}
              {slot === s ? <span className="ml-auto text-xs font-semibold text-brand">Your choice</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <textarea rows={2} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} placeholder={isCall ? "Optional comment" : "Your answer"} />
      {!isCall ? <FileList files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!isCall ? <AttachButton onAdd={(f) => setFiles([...files, ...f])} label="Upload" /> : <span />}
        <Button
          size="sm"
          disabled={!ok || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSend(body.trim(), files, slot || undefined);
            } finally {
              setBusy(false);
            }
          }}
        >
          {isCall ? "Confirm this time" : "Send answer"}
        </Button>
      </div>
    </div>
  );
}

export function CaseThread({
  caseKind,
  caseId,
  clientUserId,
  viewer,
  authorName,
  clientFirstName,
}: {
  caseKind: CaseKind;
  caseId: string;
  clientUserId: string;
  viewer: "loqal" | "client";
  authorName: string;
  clientFirstName?: string;
}) {
  const { messages } = useCaseMessages(caseKind, caseId);
  const send = useSendCaseMessage();
  const book = useServerFn(bookCaseCall);
  const isLoqal = viewer === "loqal";
  const other = isLoqal ? (clientFirstName || "the client") : "Loqal";
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [slots, setSlots] = useState<string[]>(["", "", ""]);
  const [answering, setAnswering] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const unreadIds = isLoqal ? unreadByLoqal(messages).map((m) => m.id).join(",") : "";
  useEffect(() => {
    if (unreadIds) void markReadByLoqal(unreadIds.split(","));
  }, [unreadIds]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);
  const byId = new Map(messages.map((m) => [m.id, m]));
  const upload = (fs: File[]) => Promise.all(fs.map((f) => uploadCaseFile(clientUserId, caseId, f)));
  const base = { caseKind, caseId, clientUserId, authorName, fromLoqal: isLoqal };

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch {
      toast.error("Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const sendMessage = () => {
    if (!body.trim() && !files.length) return;
    void run(async () => {
      const attachments = await upload(files);
      await send({ ...base, kind: "message", body: body.trim() || (files.length === 1 ? "Sent a file." : "Sent files."), attachments });
      setBody("");
      setFiles([]);
    }, `Message sent — ${other} has been notified`);
  };

  const sendRequest = () => {
    if (!subject.trim()) {
      toast("Add what you need from the client.");
      return;
    }
    void run(async () => {
      await send({ ...base, kind: "info_request", body: `${subject.trim()}${details.trim() ? `\n${details.trim()}` : ""}` });
      setSubject("");
      setDetails("");
      setReqOpen(false);
    }, `Request sent — ${other} will find it in the messages`);
  };

  const sendCall = () => {
    const valid = slots.filter(Boolean).map((s) => new Date(s).toISOString());
    if (!valid.length) {
      toast("Propose at least one time.");
      return;
    }
    void run(async () => {
      if (isLoqal) {
        await send({ ...base, kind: "call_request", body: details.trim() || "Loqal would like to schedule a call with you.", callSlots: valid });
      } else {
        await send({
          ...base,
          kind: "message",
          body: `📞 I'd like to schedule a call.\nPreferred times: ${valid.map((s) => formatDateTime(s)).join(" · ")}${details.trim() ? `\n${details.trim()}` : ""}`,
        });
      }
      setSlots(["", "", ""]);
      setDetails("");
      setCallOpen(false);
    }, isLoqal ? `Call request sent — ${other} picks a time` : "Call requested — Loqal will confirm the time");
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">💬 {isLoqal ? `Messages with ${other}` : "Messages with Loqal"}</h3>
        <div className="flex gap-1.5">
          {isLoqal ? (
            <Button variant="outline" size="sm" onClick={() => setReqOpen(true)}>
              <FilePlus2 /> New request
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={() => setCallOpen(true)}>
            <Phone /> Request a call
          </Button>
        </div>
      </div>

      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet.</p>
        ) : (
          messages.map((m) => {
            const own = isLoqal === m.fromLoqal;
            const isRequest = m.kind === "info_request" || m.kind === "call_request";
            const open = isRequest && !m.answeredAt;
            const parent = m.replyTo ? byId.get(m.replyTo) : undefined;
            return (
              <div key={m.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg border p-2.5 text-xs ${
                    isRequest ? (open ? "border-gold/50 bg-gold-tint/40" : "border-border bg-background") : own ? "border-brand/30 bg-brand-tint/40" : "border-border bg-background"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1 font-semibold text-foreground">
                      {m.kind === "call_request" ? <CalendarClock className="size-3.5 text-gold" aria-hidden /> : m.kind === "info_request" ? <FileQuestion className="size-3.5 text-gold" aria-hidden /> : null}
                      {own ? "You" : m.fromLoqal ? `${m.authorName || "Loqal"} · Loqal` : m.authorName}
                      {m.kind === "info_request" ? " · information request" : m.kind === "call_request" ? " · call request" : ""}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                  </div>
                  {parent ? <p className="mt-1 truncate border-l-2 border-border pl-2 italic text-muted-foreground">Re: {parent.body}</p> : null}
                  {m.body ? <p className="mt-1 whitespace-pre-wrap text-foreground">{m.body}</p> : null}
                  {m.kind === "call_request" && !m.chosenSlot ? (
                    <p className="mt-1 text-muted-foreground">Proposed: {m.callSlots.map((s) => formatDateTime(s)).join(" · ")}</p>
                  ) : null}
                  {m.kind === "call_request" && m.chosenSlot ? (
                    <div className="mt-1.5 space-y-1.5">
                      <p className="font-semibold text-success">Call agreed: {formatDateTime(m.chosenSlot)}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {m.meetUrl ? (
                          <a href={m.meetUrl} target="_blank" rel="noreferrer" className="rounded-md bg-brand px-3 py-1 font-semibold text-brand-foreground">
                            Join Google Meet
                          </a>
                        ) : (
                          <span className="text-muted-foreground">
                            {isLoqal ? "No calendar invitation sent — connect Google Calendar in the call request pop-up." : "Loqal will send you the meeting details."}
                          </span>
                        )}
                        {!isLoqal && new Date(m.chosenSlot) > new Date() ? (
                          <button
                            type="button"
                            onClick={() =>
                              void run(
                                () => send({ ...base, kind: "message", body: `Could we find a different time for the call on ${formatDateTime(m.chosenSlot!)}?` }),
                                "Loqal will propose new times",
                              )
                            }
                            className="rounded-md border border-border px-3 py-1 font-semibold text-foreground hover:bg-muted"
                          >
                            Ask to change the date
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {m.kind === "reply" && m.chosenSlot ? <p className="mt-1 font-semibold text-success">Chose {formatDateTime(m.chosenSlot)}</p> : null}
                  <Files paths={m.attachments} />
                  {isRequest ? (
                    <div className="mt-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.answeredAt ? "bg-success/15 text-success" : "bg-warning text-foreground"}`}>
                        {m.answeredAt ? "Answered" : isLoqal ? "Awaiting answer" : "Your answer is needed"}
                      </span>
                    </div>
                  ) : null}
                  {!isLoqal && open ? (
                    answering === m.id ? (
                      <ClientAnswer
                        m={m}
                        onSend={async (b, fs, slot) => {
                          try {
                            const attachments = await upload(fs);
                            await send({ ...base, kind: "reply", body: b, attachments, replyTo: m.id, ...(slot ? { chosenSlot: slot } : {}) });
                            setAnswering(null);
                            if (slot) {
                              try {
                                const r = await book({ data: { messageId: m.id, startAt: slot } });
                                toast.success(r.booked ? "Call confirmed — a calendar invitation with a Google Meet link is on its way" : "Call time confirmed — Loqal will send you the meeting details");
                              } catch {
                                toast.success("Call time confirmed — Loqal will send you the meeting details");
                              }
                              await refreshCaseMessages();
                              return;
                            }
                            toast.success("Thank you — Loqal has your answer");
                          } catch {
                            toast.error("Could not send. Please try again.");
                          }
                        }}
                      />
                    ) : (
                      <Button size="sm" className="mt-2" onClick={() => setAnswering(m.id)}>
                        {m.kind === "call_request" ? "Choose a time" : "Answer"}
                      </Button>
                    )
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={isLoqal ? `Write to ${other}…` : "Write to your Loqal team…"}
        className={`mt-3 ${inputClass}`}
      />
      <FileList files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <AttachButton onAdd={(f) => setFiles([...files, ...f])} />
        <Button size="sm" disabled={busy || (!body.trim() && !files.length)} onClick={sendMessage}>
          Send message
        </Button>
      </div>

      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New request for {other}</DialogTitle>
            <DialogDescription>Ask for a document, a decision or information. It appears in the messages and {other} can answer with uploads.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <input className={inputClass} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Passport copy of every owner" />
            <textarea className={inputClass} rows={4} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Details and deadline (optional)" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReqOpen(false)}>Cancel</Button>
              <Button disabled={busy} onClick={sendRequest}>Send request</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={callOpen} onOpenChange={setCallOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isLoqal ? `Request a call with ${other}` : "Request a call with Loqal"}</DialogTitle>
            <DialogDescription>
              {isLoqal
                ? `Propose up to three times. ${other} picks one; with Google Calendar connected a Meet invitation is sent automatically.`
                : "Suggest up to three times that suit you. Loqal confirms one and sends the meeting details."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {isLoqal ? <GoogleCalendarCard /> : null}
            {slots.map((s, i) => (
              <input
                key={i}
                type="datetime-local"
                value={s}
                onChange={(e) => setSlots(slots.map((x, j) => (j === i ? e.target.value : x)))}
                className={inputClass}
                aria-label={`Proposed time ${i + 1}`}
              />
            ))}
            <textarea className={inputClass} rows={2} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Purpose of the call (optional)" />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setCallOpen(false)}>Cancel</Button>
              <Button disabled={busy} onClick={sendCall}>Send call request</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

