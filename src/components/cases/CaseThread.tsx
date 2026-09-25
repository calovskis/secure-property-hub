/**
 * Communication line for a Loqal support case. Loqal sees a composer with
 * Message / Information request / Call request; the client answers requests
 * (text + uploads, or picking a proposed call time) and can write back.
 */
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, FileQuestion, MessageSquare, Paperclip, X } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import {
  caseFileName,
  openCaseFile,
  uploadCaseFile,
  useCaseMessages,
  useSendCaseMessage,
  type CaseKind,
  type CaseMessage,
  type CaseMessageKind,
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
          className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-xs text-brand hover:bg-muted"
        >
          <Paperclip className="h-3 w-3" aria-hidden />
          {caseFileName(p)}
        </button>
      ))}
    </div>
  );
}

function FilePicker({
  files,
  setFiles,
}: {
  files: File[];
  setFiles: (f: File[]) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">
        <Paperclip className="h-3.5 w-3.5" aria-hidden /> Attach files
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            setFiles([...files, ...Array.from(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </label>
      {files.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
          {f.name}
          <button type="button" aria-label="Remove file" onClick={() => setFiles(files.filter((_, j) => j !== i))}>
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

const KIND_LABEL: Record<CaseMessageKind, string> = {
  message: "Message",
  info_request: "Information request",
  call_request: "Call request",
  reply: "Reply",
};

function ClientAnswer({
  m,
  onSend,
}: {
  m: CaseMessage;
  onSend: (body: string, files: File[], slot?: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [slot, setSlot] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const isCall = m.kind === "call_request";
  const ok = isCall ? !!slot : !!body.trim() || files.length > 0;
  return (
    <div className="mt-2 space-y-2 rounded-md border border-brand/30 bg-background p-2.5">
      {isCall ? (
        <div className="space-y-1">
          <div className="text-xs font-medium text-muted-foreground">Choose a time that suits you</div>
          {m.callSlots.map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-sm ${
                slot === s ? "border-brand bg-brand-tint/60" : "border-border"
              }`}
            >
              <input type="radio" checked={slot === s} onChange={() => setSlot(s)} />
              {formatDateTime(s)}
              {slot === s ? <span className="ml-auto text-xs font-semibold text-brand">Your choice</span> : null}
            </label>
          ))}
        </div>
      ) : null}
      <textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={inputClass}
        placeholder={isCall ? "Optional comment" : "Your answer"}
      />
      {isCall ? null : <FilePicker files={files} setFiles={setFiles} />}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!ok || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSend(body.trim(), files, slot || undefined);
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground disabled:opacity-50"
        >
          {isCall ? "Confirm this time" : "Send answer"}
        </button>
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
  const [kind, setKind] = useState<"message" | "info_request" | "call_request">("message");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [slots, setSlots] = useState<string[]>(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const isLoqal = viewer === "loqal";
  const byId = new Map(messages.map((m) => [m.id, m]));

  const upload = async (fs: File[]) => Promise.all(fs.map((f) => uploadCaseFile(clientUserId, caseId, f)));

  const submit = async () => {
    const validSlots = slots.filter(Boolean).map((s) => new Date(s).toISOString());
    if (kind === "call_request" && !validSlots.length) return toast.error("Add at least one proposed time");
    if (kind !== "call_request" && !body.trim()) return toast.error("Please write the message");
    setBusy(true);
    try {
      const attachments = await upload(files);
      await send({
        caseKind,
        caseId,
        clientUserId,
        authorName,
        fromLoqal: isLoqal,
        kind: isLoqal ? kind : "message",
        body: body.trim() || (kind === "call_request" ? "Loqal would like to schedule a call with you." : ""),
        attachments,
        callSlots: isLoqal && kind === "call_request" ? validSlots : [],
      });
      setBody("");
      setFiles([]);
      setSlots(["", "", ""]);
      toast.success(isLoqal ? `Sent — ${clientFirstName ?? "the client"} will see it on My Profile` : "Sent to Loqal");
    } catch {
      toast.error("Could not send. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            No communication yet.
          </p>
        ) : (
          messages.map((m) => {
            const mine = isLoqal === m.fromLoqal;
            const isRequest = m.kind === "info_request" || m.kind === "call_request";
            const parent = m.replyTo ? byId.get(m.replyTo) : undefined;
            return (
              <div
                key={m.id}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  isRequest && !m.answeredAt
                    ? "border-warning/60 bg-warning/10"
                    : mine
                      ? "border-brand/30 bg-brand-tint/40"
                      : "border-border bg-card"
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {m.kind === "call_request" ? (
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                  ) : m.kind === "info_request" ? (
                    <FileQuestion className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                  )}
                  <span className="font-semibold text-foreground">
                    {m.fromLoqal ? "Loqal" : m.authorName}
                  </span>
                  <span>· {KIND_LABEL[m.kind]}</span>
                  {isRequest ? (
                    <span className={`rounded-full px-1.5 text-[10px] font-semibold ${m.answeredAt ? "bg-success/15 text-success" : "bg-warning text-foreground"}`}>
                      {m.answeredAt ? "Answered" : "Awaiting answer"}
                    </span>
                  ) : null}
                  <span className="ml-auto">{formatDateTime(m.createdAt)}</span>
                </div>
                {parent ? (
                  <p className="mt-1 truncate border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                    Re: {parent.body}
                  </p>
                ) : null}
                {m.body ? <p className="mt-1 whitespace-pre-wrap text-foreground">{m.body}</p> : null}
                {m.kind === "call_request" && m.chosenSlot ? (
                  <p className="mt-1 text-xs font-semibold text-success">Call agreed: {formatDateTime(m.chosenSlot)}</p>
                ) : m.kind === "call_request" && isLoqal ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Proposed: {m.callSlots.map((s) => formatDateTime(s)).join(" · ")}
                  </p>
                ) : null}
                {m.kind === "reply" && m.chosenSlot ? (
                  <p className="mt-1 text-xs font-semibold text-success">Chose {formatDateTime(m.chosenSlot)}</p>
                ) : null}
                <Files paths={m.attachments} />
                {!isLoqal && isRequest && !m.answeredAt ? (
                  <ClientAnswer
                    m={m}
                    onSend={async (b, fs, slot) => {
                      try {
                        const attachments = await upload(fs);
                        await send({
                          caseKind,
                          caseId,
                          clientUserId,
                          authorName,
                          fromLoqal: false,
                          kind: "reply",
                          body: b,
                          attachments,
                          replyTo: m.id,
                          ...(slot ? { chosenSlot: slot } : {}),
                        });
                        toast.success("Thank you — Loqal has your answer");
                      } catch {
                        toast.error("Could not send. Please try again.");
                      }
                    }}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-2 rounded-lg border border-border p-3">
        {isLoqal ? (
          <div className="flex flex-wrap gap-1.5">
            {(["message", "info_request", "call_request"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  kind === k ? "border-brand bg-brand text-brand-foreground" : "border-border text-foreground hover:bg-muted"
                }`}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-xs font-medium text-muted-foreground">Write to Loqal</div>
        )}
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={inputClass}
          placeholder={
            isLoqal && kind === "info_request"
              ? "Describe the information or documents you need"
              : isLoqal && kind === "call_request"
                ? "Purpose of the call (optional)"
                : "Your message"
          }
        />
        {isLoqal && kind === "call_request" ? (
          <div className="grid gap-1.5 sm:grid-cols-3">
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
          </div>
        ) : (
          <FilePicker files={files} setFiles={setFiles} />
        )}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-md bg-brand px-4 py-1.5 text-sm font-semibold text-brand-foreground disabled:opacity-50"
          >
            {isLoqal && kind !== "message" ? `Send ${KIND_LABEL[kind].toLowerCase()}` : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
