/**
 * "Correspondence with Loqal" — everything that is not a document or
 * information provision request: video calls, live/e-mail chats and
 * help & support tickets. Open items are shown; finished calls and closed
 * chats move to the history below.
 */
import { useState } from "react";
import type { LoqalUser } from "@/lib/auth";
import { usePartnerRequests, type PartnerAdminRequest } from "@/lib/partner-requests";
import {
  CallItem,
  HistoryDetailDialog,
  HistorySection,
  isOpenItem,
} from "@/components/profile/partner-request-parts";
import { useDeepLinkAction } from "@/lib/deep-link";
import { useStaff } from "@/lib/staff";

export function CorrespondenceCard({ user }: { user: LoqalUser }) {
  const { requests, updateRequest } = usePartnerRequests();
  const { members } = useStaff();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  // The slot books into the calendar of the Loqal manager assigned to the file.
  const reviewerEmail = members.find((m) => m.id === request?.reviewerId)?.email;
  const items = (request?.adminRequests ?? []).filter((i) => i.kind !== "info");
  const [historyItem, setHistoryItem] = useState<PartnerAdminRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useDeepLinkAction("call", (focus) => {
    const done = items.find((i) => i.id === focus && !isOpenItem(i));
    if (done) {
      setShowHistory(true);
      setHistoryItem(done);
    }
  });

  if (!request) return null;

  function patch(id: string, changes: Partial<PartnerAdminRequest>) {
    if (!request) return;
    updateRequest(request.id, {
      adminRequests: request.adminRequests.map((i) => (i.id === id ? { ...i, ...changes } : i)),
    });
  }

  const open = items.filter(isOpenItem);
  const past = items
    .filter((i) => !isOpenItem(i))
    .slice()
    .sort((a, b) => (b.requestedAt > a.requestedAt ? 1 : -1));

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Correspondence with Loqal</h2>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
            open.length ? "bg-gold-tint text-gold" : "bg-success/10 text-success"
          }`}
        >
          {open.length ? `${open.length} open` : items.length ? "All handled" : "Nothing open"}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Video calls, live and e-mail chats and help &amp; support tickets. Document and information
        requests live under Open requests. Once a call has been held or a chat is closed, it moves to
        the history.
      </p>

      {open.length === 0 ? (
        <p className="mt-4 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          No open correspondence. Upcoming video calls and ongoing chats with Loqal show up here.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {open.map((item) => (
            <CallItem
              key={item.id}
              item={item}
              user={user}
              onBooked={patch}
              {...(reviewerEmail ? { agentEmail: reviewerEmail } : {})}
            />
          ))}
        </div>
      )}

      <HistorySection
        past={past}
        label="View history"
        open={showHistory}
        onToggle={() => setShowHistory((v) => !v)}
        onPick={setHistoryItem}
      />

      <HistoryDetailDialog item={historyItem} onClose={() => setHistoryItem(null)} />
    </section>
  );
}
