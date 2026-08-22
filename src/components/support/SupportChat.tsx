/**
 * Floating live-chat widget for signed-in clients and partners. Messages go
 * to the Loqal support inbox in the admin console; admins answer there and
 * the reply lands here in real time.
 */
import { useEffect, useRef, useState } from "react";
import { fullName, PARTNER_LABEL, useAuth } from "@/lib/auth";
import { useChatThread } from "@/lib/chat";
import { formatDateTime } from "@/lib/dates";

export function SupportChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const roleLabel = user
    ? user.role === "partner"
      ? `Partner · ${PARTNER_LABEL[user.partnerType ?? "other"]}`
      : user.role
    : "";

  const { messages, unread, send, markUserRead } = useChatThread(
    user?.email ?? "",
    user ? fullName(user) : "",
    roleLabel,
  );

  useEffect(() => {
    if (open) markUserRead();
  }, [open, messages.length, markUserRead]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, open]);

  if (!user || user.role === "admin") return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60]">
      {open ? (
        <div className="mb-3 flex h-[420px] w-[340px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border bg-brand px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-background">Loqal live support</div>
              <div className="text-[11px] text-background/80">We answer as soon as possible</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-background/80 hover:text-background"
            >
              ✕
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === "user" ? "justify-end" : ""}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.from === "user"
                      ? "bg-brand text-background"
                      : "border border-border bg-background text-foreground"
                  }`}
                >
                  <p>{m.text}</p>
                  <div
                    className={`mt-1 text-[10px] ${
                      m.from === "user" ? "text-background/70" : "text-muted-foreground"
                    }`}
                  >
                    {formatDateTime(m.at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <form
            className="flex gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
              setText("");
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write to Loqal support…"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-brand"
            />
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open live chat"
        className="relative ml-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand text-xl text-background shadow-lg hover:bg-brand-soft"
      >
        💬
        {unread > 0 && !open ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        ) : null}
      </button>
    </div>
  );
}
