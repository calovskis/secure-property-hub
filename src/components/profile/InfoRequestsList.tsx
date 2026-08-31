/**
 * Written information / document provision requests Loqal raised on the
 * partner's registration. These live inside the "Open requests" card, next to
 * the missing verification documents, and move to a request history once
 * answered.
 */
import { useState } from "react";
import type { LoqalUser } from "@/lib/auth";
import { usePartnerRequests, type PartnerAdminRequest } from "@/lib/partner-requests";
import { useDeepLinkAction } from "@/lib/deep-link";
import {
  HistoryDetailDialog,
  HistorySection,
  InfoItem,
  isOpenItem,
} from "@/components/profile/partner-request-parts";

export function InfoRequestsList({ user }: { user: LoqalUser }) {
  const { requests, updateRequest } = usePartnerRequests();
  const request = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const items = (request?.adminRequests ?? []).filter((i) => i.kind === "info");
  const [historyItem, setHistoryItem] = useState<PartnerAdminRequest | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // A notification pointing at an already-answered request opens its history detail.
  useDeepLinkAction("request", (focus) => {
    const done = items.find((i) => i.id === focus && !isOpenItem(i));
    if (done) {
      setShowHistory(true);
      setHistoryItem(done);
    }
  });
  useDeepLinkAction("history", (focus) => {
    const done = items.find((i) => i.id === focus);
    if (!focus || done) {
      setShowHistory(true);
      if (done) setHistoryItem(done);
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

  if (!open.length && !past.length) return null;

  return (
    <div className="mt-4">
      {open.length ? (
        <div className="space-y-4">
          {open.map((item) => (
            <InfoItem
              key={item.id}
              item={item}
              requestId={request.id}
              user={user}
              onAnswer={patch}
            />
          ))}
        </div>
      ) : null}

      <HistorySection
        past={past}
        label="Request history"
        open={showHistory}
        onToggle={() => setShowHistory((v) => !v)}
        onPick={setHistoryItem}
      />

      <HistoryDetailDialog item={historyItem} onClose={() => setHistoryItem(null)} />
    </div>
  );
}
