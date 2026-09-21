/**
 * "Active actions" for one person: everything open on their file, split into
 * what Loqal has to do and what Loqal is waiting on them for. Used both as a
 * section inside the profile and as a pop-up window opened from the People list
 * so an admin never has to hunt through tabs to find the pending work.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/dates";
import { personActions, type PersonAction } from "@/lib/person-actions";
import { useActiveLeads } from "@/lib/leads";
import type { AdminPerson } from "@/components/admin/people-model";
import { LicenceVerificationDialog } from "@/components/admin/LicenceVerificationPanel";
import { PartnerCountersignDialog } from "@/components/admin/PartnerCountersignDialog";
import { usePartnerRequests } from "@/lib/partner-requests";
import { notify } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";

export function usePersonActions(person: AdminPerson): PersonAction[] {
  const { leads } = useActiveLeads();
  const own = leads.filter(
    (l) => l.clientEmail.trim().toLowerCase() === person.email.trim().toLowerCase(),
  );
  return personActions({ request: person.request, leads: own, name: person.name });
}

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

/**
 * The list itself. `onOpenTab` is used when the action lives on another tab of
 * the profile; when it is absent (pop-up from the People list) those actions
 * link to the person's profile page instead.
 */
export function ActiveActionsList({
  person,
  onOpenTab,
}: {
  person: AdminPerson;
  onOpenTab?: (tab: "profile" | "correspondence" | "properties") => void;
}) {
  const actions = usePersonActions(person);
  const { updateRequest } = usePartnerRequests();
  const [licencesOpen, setLicencesOpen] = useState(false);
  const [countersignOpen, setCountersignOpen] = useState(false);

  const loqal = actions.filter((a) => a.owner === "loqal");
  const waiting = actions.filter((a) => a.owner === "person");
  const profileHref = `/admin-people/${encodeURIComponent(person.key)}`;

  const markAnswerRead = (a: PersonAction) => {
    const req = person.request;
    if (!a.marksReadRequestId || !req) return;
    const at = new Date().toISOString();
    updateRequest(req.id, {
      adminRequests: (req.adminRequests ?? []).map((r) =>
        r.id === a.marksReadRequestId && !r.answerReadAt
          ? { ...r, answerReadAt: at, answerReadBy: "Loqal admin" }
          : r,
      ),
    });
  };

  const run = (a: PersonAction) => {
    if (a.handler === "licences" && person.request) return setLicencesOpen(true);
    if (a.handler === "countersign" && person.request) return setCountersignOpen(true);
    markAnswerRead(a);
    const tab =
      a.handler === "correspondence"
        ? "correspondence"
        : a.handler === "properties"
          ? "properties"
          : "profile";
    if (onOpenTab) return onOpenTab(tab);
    window.open(profileHref, "_blank", "noopener");
  };


  const group = (title: string, items: PersonAction[], tone: "gold" | "muted") =>
    items.length ? (
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title} ({items.length})
        </h4>
        <ul className="mt-2 space-y-2">
          {items.map((a) => (
            <li
              key={a.id}
              className={`rounded-lg border p-3 ${
                tone === "gold" ? "border-gold/50 bg-gold-tint/40" : "border-border bg-background"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.detail}</p>
                  <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                    Waiting {ago(a.since)} · since {formatDateTime(a.since)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => run(a)}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${
                    tone === "gold"
                      ? "bg-brand text-background hover:bg-brand-soft"
                      : "border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {a.cta}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {actions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing open on this profile — no action is needed from Loqal and nothing is awaited from{" "}
          {person.name.split(/\s+/)[0]}.
        </p>
      ) : (
        <>
          {group("For Loqal to do", loqal, "gold")}
          {group(`Awaiting ${person.name.split(/\s+/)[0]}`, waiting, "muted")}
        </>
      )}

      {person.request ? (
        <>
          <LicenceVerificationDialog
            request={person.request}
            open={licencesOpen}
            onOpenChange={setLicencesOpen}
          />
          <PartnerCountersignDialog
            request={person.request}
            open={countersignOpen}
            onOpenChange={setCountersignOpen}
            onCountersign={(signatory) => {
              const req = person.request!;
              updateRequest(req.id, {
                agreementCountersignedAt: new Date().toISOString(),
                agreementCountersignedBy: signatory.name,
                agreementCountersignedTitle: signatory.title,
              });
              notify({
                id: `countersigned-${req.id}`,
                to: req.email.toLowerCase(),
                title: "Loqal countersigned your partnership agreement",
                body: `${signatory.name}, ${signatory.title}, signed for Loqal — your partnership is fully active.`,
                href: "/profile",
                severity: "info",
              });
              logActivity(signatory.name, "countersigned a partnership agreement", req.companyName);
              toast("Agreement countersigned", { description: req.companyName });
            }}
          />
        </>
      ) : null}
    </div>
  );
}

/** Pop-up window opened from the People list. */
export function PersonActionsDialog({
  person,
  open,
  onOpenChange,
}: {
  person: AdminPerson;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Active actions — {person.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {person.roleLabel}
          {person.company ? ` · ${person.company}` : ""} · {person.email}
        </p>
        <div className="mt-2">
          <ActiveActionsList person={person} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
