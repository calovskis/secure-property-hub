/**
 * Direct message thread between a buyer and their Loqal buyer's agent on one
 * property file — used on the client's property page and inside the realtor
 * portal, so both sides see exactly the same conversation.
 *
 * Either side can write while a call or video showcasing is still being agreed:
 * the buyer asks a question or contacts the agent, the agent asks the buyer for
 * information or answers back. Every message notifies the other side and
 * deep-links straight back into this thread.
 */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { useFileChat, type ChatAttachment, type ChatSide } from "@/lib/file-chat";

const readFile = (file: File) =>
  new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  });

export function FileChatPanel({
  leadId,
  side,
  myName,
  otherName,
  otherEmail,
  propertyId,
  propertyLabel,
}: {
  leadId: string;
  side: ChatSide;
  /** How the author is shown to the other side. */
  myName: string;
  otherName: string;
  /** Where the notification about a new message goes. */
  otherEmail?: string | undefined;
  propertyId: number;
  propertyLabel: string;
}) {
  const { messages, unread, send, markRead } = useFileChat(leadId, side);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<ChatAttachment[]>([]);
  const [kind, setKind] = useState<"message" | "info_request">("message");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (unread) markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread, leadId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  function submit() {
    const text = body.trim();
    if (!text && !files.length) return;
    send({
      authorName: myName,
      kind: side === "agent" ? kind : "message",
      body: text || (files.length === 1 ? "Sent a file." : "Sent files."),
      ...(files.length ? { attachments: files } : {}),
    });
    setFiles([]);
    setBody("");
    setKind("message");
    if (otherEmail) {
      const href =
        side === "agent"
          ? `/property/${propertyId}?open=chat`
          : `/partner?tab=buyers&focus=${leadId}`;
      notify({
        id: `filechat-${leadId}-${Date.now()}`,
        to: otherEmail.toLowerCase(),
        title:
          side === "agent"
            ? kind === "info_request"
              ? `Your buyer's agent needs some information`
              : `New message from your buyer's agent`
            : `New message from your buyer`,
        body: `${propertyLabel} — ${text.slice(0, 140)}`,
        href,
        severity: kind === "info_request" ? "warning" : "info",
      });
    }
    toast("Message sent", { description: `${otherName} has been notified.` });
  }

  return (
    <section id="file-chat" className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">
          💬 {side === "agent" ? "Messages with your buyer" : "Messages with your buyer's agent"}
        </h3>
        <span className="text-[11px] text-muted-foreground">{otherName}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {side === "agent"
          ? "Ask your buyer for information or send an update while the viewing time is being agreed."
          : "Ask a question or contact your agent directly — you do not have to wait for the call."}
      </p>

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {messages.length ? (
          messages.map((m) => {
            const own = m.from === side;
            return (
              <div
                key={m.id}
                className={`rounded-lg border p-2.5 text-xs ${
                  own
                    ? "border-brand/30 bg-brand-tint/40"
                    : m.kind === "info_request"
                      ? "border-gold/40 bg-gold-tint/40"
                      : "border-border bg-background"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">
                    {own ? "You" : m.authorName}
                    {m.kind === "info_request" ? " · information request" : ""}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDateTime(m.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-foreground">{m.body}</p>
                {m.attachments?.length ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.attachments.map((a) => (
                      <a
                        key={a.id}
                        href={a.url}
                        download={a.name}
                        className="rounded bg-background px-2 py-1 text-[11px] font-semibold text-brand underline"
                      >
                        📎 {a.name}
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground">No messages yet.</p>
        )}
        <div ref={endRef} />
      </div>

      {side === "agent" ? (
        <div className="mt-3 flex gap-2">
          {(
            [
              ["message", "Message"],
              ["info_request", "Request information"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                kind === id
                  ? "border-brand bg-brand-tint text-brand"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={
          side === "agent"
            ? kind === "info_request"
              ? "What do you need from the buyer?"
              : "Write to your buyer…"
            : "Ask your agent a question…"
        }
        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand"
      />
      {files.length ? (
        <ul className="mt-2 space-y-1.5">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-1.5 text-[11px]"
            >
              <span className="text-foreground">📎 {f.name}</span>
              <button
                type="button"
                onClick={() => setFiles((cur) => cur.filter((x) => x.id !== f.id))}
                className="font-semibold text-destructive"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-brand-tint">
          📎 Attach a file
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={async (e) => {
              const selected = Array.from(e.target.files ?? []);
              e.currentTarget.value = "";
              const next = await Promise.all(
                selected.map(async (file) => ({
                  id: Math.random().toString(36).slice(2, 10),
                  name: file.name,
                  url: await readFile(file),
                })),
              );
              setFiles((cur) => [...cur, ...next]);
            }}
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={!body.trim() && !files.length}
          className="rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
        >
          {side === "agent" && kind === "info_request" ? "Send request" : "Send message"}
        </button>
      </div>
    </section>
  );
}
