/**
 * "Important tip" shown to every new international (non-US-person) client on
 * their dashboard: US property is customarily held in an LLC or a trust, Loqal
 * recommends it, and Loqal can structure it properly.
 *
 * Three ways forward from the card:
 *  - Learn more → the FAQ page, opened in a new tab;
 *  - I already have an entity in the US → we take its details on file;
 *  - Request Loqal support → the terms, then a confirmation that assigns a
 *    Loqal entity manager.
 */
import { useMemo, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, Lightbulb, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StateCombobox } from "@/components/form/StateCombobox";
import { useAuth } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { useDeepLinkAction } from "@/lib/deep-link";
import { formatDateTime } from "@/lib/dates";
import { ENTITY_TYPES, useEntityIntent } from "@/lib/entity-onboarding";
import {
  LOQAL_SETUP_FEE_USD,
  RELATED_SERVICES_MAX_USD,
  useEntityPlans,
} from "@/lib/entity-structure";
import { useLeads } from "@/lib/leads";

const TERM_POINTS = [
  `One-time Loqal Managerial Set-up fee of $${LOQAL_SETUP_FEE_USD} — we design the structure, coordinate every provider and keep you out of the paperwork.`,
  `All related services (company formation and state filings, registered agent, EIN, US bank account) are charged at cost and capped at $${RELATED_SERVICES_MAX_USD} in total.`,
  "We propose the structure to you in writing, based on the property location and your profile, before anything is filed. Nothing is charged until you approve it.",
  "A named Loqal entity manager is assigned to you and reaches out within three business days.",
  "Loqal coordinates licensed US providers and is not a law firm or tax adviser; you may involve your own advisers at any time.",
];

export function EntityTipCard() {
  const { user } = useAuth();
  const { intent, saveIntent } = useEntityIntent(user?.email);
  const { plans } = useEntityPlans();
  const { leadsForClient } = useLeads();
  const [entityOpen, setEntityOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [sentOpen, setSentOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({ name: "", type: "LLC", state: "", ein: "" });

  // "Request Loqal to help manage the structure" from the FAQ tab lands here.
  useDeepLinkAction("entity-support", () => setSupportOpen(true));

  const hasCompanyOnPropertyFile = useMemo(() => {
    if (!user) return false;
    const leadIds = new Set(leadsForClient(user.email).map((lead) => lead.id));
    return plans.some(
      (plan) =>
        leadIds.has(plan.leadId) && Boolean(plan.entityName || plan.loqalSetupRequestedAt),
    );
  }, [leadsForClient, plans, user]);

  if (!user || user.role !== "client" || user.usPerson) return null;

  const clientLabel = `${user.firstName} ${user.lastName}`.trim();
  const done = Boolean(
    intent?.entityProvidedAt || intent?.supportRequestedAt || hasCompanyOnPropertyFile,
  );
  /* The confirmation window must still show after the request, when the tip
     card itself is done and hides. */
  if (sentOpen)
    return (
      <Dialog open onOpenChange={setSentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request received</DialogTitle>
            <DialogDescription>
              Thank you for confirming. Loqal will revert to you within two days with the next
              steps for setting up your holding structure.
            </DialogDescription>
          </DialogHeader>
          <button
            type="button"
            onClick={() => setSentOpen(false)}
            className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            Close
          </button>
        </DialogContent>
      </Dialog>
    );
  if (done) return null;
  if (intent?.dismissedAt && !done) return null;

  function saveEntity() {
    if (!form.name.trim()) {
      toast.error("Please enter the name of your entity.");
      return;
    }
    saveIntent({
      hasEntity: true,
      entityName: form.name.trim(),
      entityType: form.type,
      entityState: form.state,
      entityEin: form.ein.trim(),
      entityProvidedAt: new Date().toISOString(),
    });
    notify({
      id: `entityintent-${user!.email.toLowerCase()}`,
      to: "admins",
      title: "Client already holds a US entity",
      body: `${clientLabel} will purchase through ${form.name.trim()}${
        form.state ? ` (${form.state})` : ""
      }. Details are on file.`,
      href: "/admin?tab=people",
      severity: "info",
    });
    setEntityOpen(false);
    toast.success("Thank you — your entity details are saved.");
  }

  function requestSupport() {
    const now = new Date().toISOString();
    saveIntent({ supportRequestedAt: now, termsAcceptedAt: now, hasEntity: false });
    notify({
      id: `entitysupport-${user!.email.toLowerCase()}`,
      to: "admins",
      title: "Entity structure support requested",
      body: `${clientLabel} accepted the set-up terms and needs a Loqal entity manager assigned.`,
      href: `/admin?tab=cases&line=entity&client=${encodeURIComponent(user!.email.toLowerCase())}`,
      severity: "warning",
    });
    setSupportOpen(false);
    setAgreed(false);
    setSentOpen(true);
  }

  return (
    <section className="relative rounded-xl border border-gold/50 bg-gold-tint/40 p-5">
      {!done ? (
        <button
          type="button"
          onClick={() => saveIntent({ dismissedAt: new Date().toISOString() })}
          aria-label="Hide this tip"
          className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-gold" aria-hidden />
        <h3 className="text-sm font-semibold text-foreground">
          Important tip — holding your US property in an entity
        </h3>
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        In the United States it is standard industry practice to hold property assets through an
        entity — most often an LLC, sometimes a trust — rather than in a personal name. We recommend
        it to every Loqal client: it keeps liability with the property, makes US banking, taxes and
        future transfers straightforward, and keeps your name out of public records. Loqal structures
        it properly for you, so the set-up is simple on your side and genuinely protects your
        interests.
      </p>

      {done ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
          <span className="text-sm text-foreground">
            {intent?.entityProvidedAt
              ? `Your entity ${intent.entityName} is on file (${formatDateTime(intent.entityProvidedAt)}). We will prepare the purchase in its name.`
              : `Terms confirmed on ${formatDateTime(intent!.supportRequestedAt!)} — a Loqal entity manager is being assigned and will reach out within three business days.`}
          </span>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <a
          href="/entity-structure-faq"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-background px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-tint"
        >
          Learn more about the practice
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </a>
        {!intent?.entityProvidedAt ? (
          <button
            type="button"
            onClick={() => setEntityOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted"
          >
            <Building2 className="h-3.5 w-3.5" aria-hidden />
            I already have an entity in the US
          </button>
        ) : null}
        {!intent?.supportRequestedAt ? (
          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
          >
            Request Loqal support
          </button>
        ) : null}
      </div>

      {/* Existing entity details */}
      <Dialog open={entityOpen} onOpenChange={setEntityOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Your US entity</DialogTitle>
            <DialogDescription>
              Tell us about the company or trust that will hold the property, so the agreement and
              the closing documents are issued in its name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Legal name</span>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Riverside Holdings LLC"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Type</span>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span className="text-xs font-semibold text-foreground">State of registration</span>
              <div className="mt-1">
                <StateCombobox
                  value={form.state}
                  onChange={(code) => setForm({ ...form, state: code })}
                />
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">
                EIN (federal tax number, optional)
              </span>
              <input
                value={form.ein}
                onChange={(e) => setForm({ ...form, ein: e.target.value })}
                placeholder="12-3456789"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={saveEntity}
              className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Save entity details
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Loqal support terms & confirmation */}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Loqal will structure it for you</DialogTitle>
            <DialogDescription>
              Please review our terms. Once you confirm, a Loqal entity manager is assigned to you
              and takes the process from here.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2">
            {TERM_POINTS.map((t, i) => (
              <li key={t} className="flex gap-2 text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-brand">{i + 1}.</span>
                {t}
              </li>
            ))}
          </ol>
          <label className="mt-1 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            I confirm these terms and would like Loqal to set up and manage the holding structure for
            my purchase.
          </label>
          <button
            type="button"
            disabled={!agreed}
            onClick={requestSupport}
            className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
          >
            Confirm and start the process
          </button>
          <p className="text-xs text-muted-foreground">
            Prefer to read the full explanation first?{" "}
            <a
              href="/entity-structure-faq"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-brand"
            >
              Open the FAQ in a new tab
            </a>
            .
          </p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
