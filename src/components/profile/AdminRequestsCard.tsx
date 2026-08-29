/**
 * Partner-side inbox for follow-ups Loqal raised on an open registration:
 * written information requests (with optional document uploads) and video
 * call requests, which the partner books straight into the Loqal calendar.
 */
import { useState } from "react";
import { toast } from "sonner";
import { fullName, type LoqalUser } from "@/lib/auth";
import { usePartnerRequests, type PartnerAdminRequest } from "@/lib/partner-requests";
import { CallScheduler } from "@/components/buyer/CallScheduler";
import { logActivity } from "@/lib/activity";
import { formatDateTime } from "@/lib/dates";

const LOQAL_ADMIN_EMAIL = "it@loqal.global";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

/** Unsent answers survive a reload so nothing typed here is ever lost. */
const draftKey = (id: string) => `loqal.partner-request-draft.${id}`;

function loadDraft(id: string): { answer: string; docs: string[] } {
  try {
    const raw = window.localStorage.getItem(draftKey(id));
    if (raw) return JSON.parse(raw) as { answer: string; docs: string[] };
  } catch {
    /* ignore */
  }
  return { answer: "", docs: [] };
}

function saveDraft(id: string, draft: { answer: string; docs: string[] }) {
  try {
    if (!draft.answer && !draft.docs.length) window.localStorage.removeItem(draftKey(id));
    else window.localStorage.setItem(draftKey(id), JSON.stringify(draft));
  } catch {
    /* storage unavailable */
  }
}

export function AdminRequestsCard({ user }: { user: LoqalUser }) {
  const { requests, updateRequest } = usePartnerRequests();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const items = request?.adminRequests ?? [];
  if (!request) return null;

  function patch(id: string, changes: Partial<PartnerAdminRequest>) {
    if (!request) return;
    updateRequest(request.id, {
      adminRequests: request.adminRequests.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    });
  }

  const open = items.filter((i) => (i.kind === "info" ? !i.answeredAt : !i.scheduledAt));

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Requests &amp; correspondence with Loqal</h2>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            open.length ? "bg-gold-tint text-gold" : "bg-success/10 text-success"
          }`}
        >
          {open.length ? `${open.length} awaiting you` : items.length ? "All answered" : "Nothing open"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Everything Loqal asks you for — information requests, document requests and video calls —
        appears here, together with your answers. Unsent replies are kept as drafts.
      </p>

      {items.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No open requests. When a Loqal admin or manager needs something from you, it will show up
          here and in your notifications.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {items.map((item) =>
            item.kind === "info" ? (
              <InfoItem key={item.id} item={item} user={user} onAnswer={patch} />
            ) : (
              <CallItem key={item.id} item={item} user={user} onBooked={patch} />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function ItemShell({
  item,
  badge,
  children,
}: {
  item: PartnerAdminRequest;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand">
          {badge}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Sent {formatDateTime(item.requestedAt)}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{item.message}</p>
      {children}
    </div>
  );
}

function InfoItem({
  item,
  user,
  onAnswer,
}: {
  item: PartnerAdminRequest;
  user: LoqalUser;
  onAnswer: (id: string, changes: Partial<PartnerAdminRequest>) => void;
}) {
  const [answer, setAnswerState] = useState("");
  const [docs, setDocsState] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const d = loadDraft(item.id);
    setAnswerState(d.answer);
    setDocsState(d.docs);
    setRestored(Boolean(d.answer || d.docs.length));
  }, [item.id]);

  const setAnswer = (v: string) => {
    setAnswerState(v);
    saveDraft(item.id, { answer: v, docs });
  };
  const setDocs = (v: string[]) => {
    setDocsState(v);
    saveDraft(item.id, { answer, docs: v });
  };

  function send() {
    if (!answer.trim()) return setError("Write your answer before sending it.");
    if (item.requiresDocument && docs.length === 0)
      return setError("This request needs at least one document.");
    setError(null);
    onAnswer(item.id, {
      answer: answer.trim(),
      answerDocs: docs,
      answeredAt: new Date().toISOString(),
    });
    saveDraft(item.id, { answer: "", docs: [] });
    setRestored(false);
    logActivity(fullName(user), "answered a Loqal information request", docs.join(", "));
    toast("Answer sent to Loqal", { description: "Your registration stays in the review queue." });
  }

  return (
    <ItemShell item={item} badge="Information requested">
      {item.answeredAt ? (
        <div className="mt-3 rounded-md border border-success/40 bg-success/5 p-3">
          <p className="text-xs font-semibold text-success">
            Answered {formatDateTime(item.answeredAt)}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{item.answer}</p>
          {item.answerDocs?.length ? (
            <ul className="mt-1 text-xs text-muted-foreground">
              {item.answerDocs.map((d) => (
                <li key={d}>📎 {d}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <textarea
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Your answer to Loqal"
            className={inputClass}
          />
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint">
              <input
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const names = Array.from(e.target.files ?? []).map((f) => f.name);
                  if (names.length) setDocs([...docs, ...names]);
                  e.target.value = "";
                }}
              />
              Attach document{item.requiresDocument ? " (required)" : " (optional)"}
            </label>
            {docs.length ? (
              <ul className="mt-2 text-xs text-muted-foreground">
                {docs.map((d) => (
                  <li key={d} className="flex items-center gap-2">
                    📎 {d}
                    <button
                      type="button"
                      className="text-destructive"
                      onClick={() => setDocs(docs.filter((x) => x !== d))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
          <button
            type="button"
            onClick={send}
            className="rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            Send answer
          </button>
        </div>
      )}
    </ItemShell>
  );
}

function CallItem({
  item,
  user,
  onBooked,
}: {
  item: PartnerAdminRequest;
  user: LoqalUser;
  onBooked: (id: string, changes: Partial<PartnerAdminRequest>) => void;
}) {
  return (
    <ItemShell item={item} badge="Video call requested">
      {item.scheduledAt ? (
        <div className="mt-3 rounded-md border border-success/40 bg-success/5 p-3 text-sm">
          <p className="font-semibold text-success">
            Booked for {formatDateTime(item.scheduledAt)}
          </p>
          {item.meetUrl ? (
            <a
              href={item.meetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-semibold text-brand underline"
            >
              Join the Google Meet
            </a>
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <CallScheduler
            agentEmail={LOQAL_ADMIN_EMAIL}
            summary="Loqal — partner registration call"
            description={item.message}
            attendeeEmails={[user.email]}
            onBook={(startAt, meeting) => {
              onBooked(item.id, { scheduledAt: startAt, meetUrl: meeting?.meetUrl ?? null });
              logActivity(fullName(user), "booked a video call with Loqal", startAt);
              toast("Call booked", { description: "Loqal received your slot." });
            }}
          />
        </div>
      )}
    </ItemShell>
  );
}
