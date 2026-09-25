/** Client entry point to a Loqal case communication line, opened in a pop-up. */
import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { pendingForClient, useCaseMessages, type CaseKind } from "@/lib/case-messages";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CaseThread } from "./CaseThread";

export function ClientCaseButton({
  caseKind,
  caseId,
  clientUserId,
  title,
}: {
  caseKind: CaseKind;
  caseId: string;
  clientUserId: string;
  title: string;
}) {
  const { user } = useAuth();
  const { messages } = useCaseMessages(caseKind, caseId);
  const [open, setOpen] = useState(false);
  const pending = pendingForClient(messages).length;
  const name = user ? `${user.firstName} ${user.lastName}`.trim() || user.email : "Client";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-3 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold ${
          pending ? "border-warning bg-warning/15 text-foreground" : "border-brand/40 bg-background text-brand hover:bg-brand-tint"
        }`}
      >
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        {pending ? `Loqal needs your answer (${pending})` : `Messages with Loqal${messages.length ? ` (${messages.length})` : ""}`}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Answer Loqal's requests, choose a call time, share documents or write to your Loqal team.
            </DialogDescription>
          </DialogHeader>
          <CaseThread caseKind={caseKind} caseId={caseId} clientUserId={clientUserId} viewer="client" authorName={name} />
        </DialogContent>
      </Dialog>
    </>
  );
}
