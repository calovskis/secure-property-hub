/**
 * Support inbox: every incoming question from clients and partners, answered
 * in writing from the admin console. This is the support side of the same
 * live chat the floating widget writes to — replies appear to the user in
 * real time.
 */
import { useEffect, useState } from "react";
import { useSupportInbox } from "@/lib/chat";
import { logActivity } from "@/lib/activity";
import { formatDateTime } from "@/lib/dates";

export function AdminSupport({ focusThread }: { focusThread?: string | null }) {
  const { threads, unreadTotal, reply, markSupportRead } = useSupportInbox();
  const [activeId, setActiveId] = useState<string | null>(focusThread ?? null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (focusThread) setActiveId(focusThread);
  }, [focusThread]);

  const active = threads.find((t) => t.id === activeId) ?? null;

  useEffect(() => {
    if (active) markSupportRead(active.id);
  }, [active, active?.messages.length, markSupportRead]);

  function send() {
    if (!active || !draft.trim()) return;
    reply(active.id, draft);
    logActivity("Loqal support", "replied in live chat", active.userName);
    setDraft("");
  }

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Support inbox & live chat</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Incoming questions from clients and partners. Answer here — the user sees your reply
            instantly in their chat widget.
          </p>
        </div>
        {unreadTotal ? (
          <span className="rounded-full bg-destructive/10 px-3 py-1 text-[11px] font-semibold text-destructive">
            {unreadTotal} unread
          </span>
        ) : null}
      </div>

      {threads.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No conversations yet — they appear as soon as a user writes to support.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
          <ul className="divide-y divide-border overflow-y-auto rounded-lg border border-border lg:max-h-[480px]">
            {threads.map((t) => {
              const unread = t.messages.filter((m) => m.from === "user" && !m.readBySupport).length;
              const last = t.messages[t.messages.length - 1];
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    className={`w-full px-4 py-3 text-left transition-colors hover:bg-brand-tint/50 ${
                      activeId === t.id ? "bg-brand-tint/60" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {t.userName}
                      </span>
                      {unread ? (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-background">
                          {unread}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t.role} · {last?.text}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex min-h-[380px] flex-col rounded-lg border border-border">
            {active ? (
              <>
                <div className="border-b border-border px-4 py-3">
                  <div className="text-sm font-semibold text-foreground">{active.userName}</div>
                  <div className="text-xs text-muted-foreground">
                    {active.role} · {active.id}
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 lg:max-h-[320px]">
                  {active.messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.from === "support"
                          ? "ml-auto bg-brand text-background"
                          : "bg-brand-tint text-foreground"
                      }`}
                    >
                      <div>{m.text}</div>
                      <div
                        className={`mt-1 text-[10px] ${
                          m.from === "support" ? "text-background/70" : "text-muted-foreground"
                        }`}
                      >
                        {formatDateTime(m.at)}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 border-t border-border p-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder="Write an answer… (Enter to send)"
                    aria-label="Answer"
                    className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={send}
                    disabled={!draft.trim()}
                    className="self-end rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                Choose a conversation on the left.
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
