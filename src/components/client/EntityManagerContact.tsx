/** Client: the assigned Loqal entity manager as a contact with Chat and Call. */
import { useState } from "react";
import { Building2, ChevronDown, MessageSquareText, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useMyEntityCase } from "@/lib/entity-setup";
import { CaseThread } from "@/components/cases/CaseThread";

export function EntityManagerContact({ variant = "compact" }: { variant?: "compact" | "card" }) {
  const { user } = useAuth();
  const c = useMyEntityCase(user?.email);
  const [expanded, setExpanded] = useState(false);
  const [chat, setChat] = useState(false);
  if (!user || !c?.manager) return null;
  const m = c.manager;
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
  const dialog = (
    <Dialog open={chat} onOpenChange={setChat}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{m.name} — your entity manager</DialogTitle>
          <DialogDescription>Write, answer requests, share documents or ask for a call about your company set-up.</DialogDescription>
        </DialogHeader>
        <CaseThread caseKind="entity" caseId={c.id} clientUserId={c.userId} viewer="client" authorName={name} />
      </DialogContent>
    </Dialog>
  );

  if (variant === "card") {
    return (
      <div className="flex min-h-48 flex-col rounded-lg border border-border bg-background/50 p-4 transition-colors hover:border-brand/30">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand ring-4 ring-card">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground">{m.name}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">Entity manager · Loqal</div>
          </div>
          <span className="rounded bg-success/10 px-2 py-1 text-[10px] font-semibold text-success">Active</span>
        </div>
        <div className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground">
          Leading your company set-up{c.propertyLabel ? <> for <span className="font-medium text-foreground">{c.propertyLabel}</span></> : null}
        </div>
        <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
          <Button size="sm" variant="outline" onClick={() => setChat(true)}>
            <MessageSquareText aria-hidden /> Write
          </Button>
          <Button size="sm" onClick={() => setChat(true)}>
            <Phone aria-hidden /> Request a call
          </Button>
        </div>
        {dialog}
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="h-auto w-full justify-start gap-3 rounded-md border border-border bg-background p-3 text-left hover:border-brand/40 hover:bg-brand-tint/20"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand">
          <Building2 className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-foreground">{m.name}</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">Entity manager · Loqal</span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden />
      </Button>
      {expanded ? (
        <div className="grid grid-cols-2 gap-2 px-1 pt-2">
          <Button size="sm" variant="outline" onClick={() => setChat(true)}>
            <MessageSquareText aria-hidden /> Chat
          </Button>
          <Button size="sm" variant="outline" onClick={() => setChat(true)}>
            <Phone aria-hidden /> Call
          </Button>
        </div>
      ) : null}
      {dialog}
    </div>
  );
}
