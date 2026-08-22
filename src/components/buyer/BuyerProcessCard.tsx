import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CLIENT_ACTION_LABEL,
  INSPECTION_OPTIONS,
  PROPERTY_CHANGE_LABEL,
  useBuyerProcess,
  type ClientNextAction,
  type PropertyChangeMode,
} from "@/lib/buyer-process";
import { KICKOFF_LABEL, type MortgageLead } from "@/lib/leads";
import { formatDate, formatDateTime } from "@/lib/dates";
import { CallScheduler } from "@/components/buyer/CallScheduler";
import { BuyerAgentDialog } from "@/components/mortgage/BuyerAgentDialog";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;
const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

const ACTION_TILES: { id: ClientNextAction; title: string; blurb: string }[] = [
  {
    id: "more_info",
    title: "Request more information",
    blurb: "Ask the agent anything else about the property.",
  },
  {
    id: "agree_inspections",
    title: "Agree to the proposed inspections",
    blurb: "Confirm the suggested inspections and/or request additional checks.",
  },
  {
    id: "agree_negotiation",
    title: "Agree to the negotiation price",
    blurb: "Authorise the agent to negotiate at the proposed price — before inspection results.",
  },
  {
    id: "sign_prepurchase",
    title: "Proceed to the Purchase Agreement",
    blurb: "Conditioned upon inspection results and the appraisal value.",
  },
  {
    id: "property_change",
    title: "Request a property change",
    blurb: "Pick another property, or let the agent propose options on your criteria.",
  },
  {
    id: "live_call",
    title: "Request a live call",
    blurb: "Book a 1-hour slot on the agent's calendar.",
  },
];

/**
 * Client-facing buyer's-agent workspace on the property page: representation
 * status, kickoff tracking, delivered photos with the agent's
 * recommendations, and the buyer's next-step decisions.
 */
export function BuyerProcessCard({ lead }: { lead: MortgageLead }) {
  const { photos, bookings, actions, addClientAction, bookCall } = useBuyerProcess();
  const [setupOpen, setSetupOpen] = useState(false);
  const [active, setActive] = useState<ClientNextAction | null>(null);
  const [details, setDetails] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [extraInspection, setExtraInspection] = useState("");
  const [changeMode, setChangeMode] = useState<PropertyChangeMode>("agent_propose");
  const [callSlot, setCallSlot] = useState<string | null>(null);

  const ba = lead.buyerAgent;
  if (!ba || lead.clientDecision !== "accepted") return null;

  /* Terms accepted but the representation choice was never finished. */
  if (!ba.representation) {
    return (
      <div className="mb-6 rounded-lg border border-gold/40 bg-gold-tint/50 p-4">
        <h4 className="text-sm font-semibold text-foreground">Finish your buyer's agent setup</h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose who steers your purchase — a Loqal personal manager or working with your buyer's
          agent directly — and how you would like to start.
        </p>
        <button
          type="button"
          onClick={() => setSetupOpen(true)}
          className={`${btnPrimary} mt-3`}
        >
          Complete setup
        </button>
        <BuyerAgentDialog lead={lead} open={setupOpen} onOpenChange={setSetupOpen} />
      </div>
    );
  }

  const photo = photos[lead.id];
  const history = actions[lead.id] ?? [];
  const callBooking = bookings.find((b) => b.leadId === lead.id && b.kind === "intro_call");

  function resetForms() {
    setActive(null);
    setDetails("");
    setPicked([]);
    setExtraInspection("");
    setChangeMode("agent_propose");
    setCallSlot(null);
  }

  function submit(action: ClientNextAction) {
    if (action === "agree_inspections") {
      const extras = [
        ...picked,
        ...(extraInspection.trim() ? [extraInspection.trim()] : []),
      ];
      addClientAction(lead.id, action, {
        details: details.trim() || undefined,
        extraInspections: extras,
      } as { details?: string; extraInspections?: string[] });
    } else if (action === "property_change") {
      addClientAction(lead.id, action, {
        propertyChangeMode: changeMode,
        details: details.trim() || undefined,
      });
    } else if (action === "agree_negotiation") {
      addClientAction(lead.id, action, {
        details: `Buyer authorised negotiations${
          photo?.suggestedPrice ? ` at ${money(photo.suggestedPrice)}` : ""
        } — price may be renegotiated if inspections come back negative.${
          details.trim() ? ` Note: ${details.trim()}` : ""
        }`,
      });
    } else if (action === "sign_prepurchase") {
      addClientAction(lead.id, action, {
        details:
          "Prepurchase agreement conditioned upon inspection results and appraisal value." +
          (details.trim() ? ` Note: ${details.trim()}` : ""),
      });
    } else if (action === "more_info") {
      addClientAction(lead.id, action, { details: details.trim() || undefined });
    } else if (action === "live_call") {
      addClientAction(lead.id, action, {
        details: callSlot ? `Booked for ${formatDateTime(callSlot)} (1 hour).` : undefined,
      });
    }
    resetForms();
  }

  return (
    <div className="mb-6 rounded-lg border border-brand/30 bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">Your purchase team</h4>
        <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
          {ba.representation === "loqal_rep"
            ? "Loqal personal manager (+1%)"
            : `You + ${ba.agentName ?? "your buyer's agent"}`}
        </span>
      </div>

      {ba.representation === "loqal_rep" ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Your Loqal personal manager is treating this property as their own investment and will
          come back to you with the best course of action — inspections, negotiations and next
          steps. {ba.agentName ? `${ba.agentName} remains your licensed buyer's agent of record.` : ""}
        </p>
      ) : (
        <>
          <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">Kickoff:</strong>{" "}
              {ba.kickoff ? KICKOFF_LABEL[ba.kickoff] : "—"}
              {ba.kickoff === "live_call" && callBooking
                ? ` — booked for ${formatDateTime(callBooking.startAt)} (1 hour)`
                : ""}
              {ba.kickoff === "photo_visit" && photo
                ? photo.status === "delivered"
                  ? ` — delivered ${formatDateTime(photo.deliveredAt)}`
                  : photo.status === "delayed"
                    ? ` — rescheduled to ${photo.etaAt ? formatDate(photo.etaAt) : "a new date"} (${photo.delayReason})`
                    : ` — photos due ${formatDate(photo.dueAt)}`
                : ""}
              {ba.kickoff === "video_showcase"
                ? " — the agent will confirm the tour time"
                : ""}
            </p>
            {ba.kickoffNotes ? (
              <p className="text-xs italic">Your notes: {ba.kickoffNotes}</p>
            ) : null}
          </div>

          {photo?.status === "delivered" ? (
            <div className="mt-4 rounded-lg border border-border bg-background p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Photos & recommendations from {ba.agentName ?? "your agent"}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {photo.photos.map((p) => (
                  <span
                    key={p.id}
                    className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand"
                  >
                    📷 {p.name}
                  </span>
                ))}
              </div>
              {photo.comments ? (
                <p className="mt-3 text-sm text-muted-foreground">{photo.comments}</p>
              ) : null}
              {photo.inspectionsSuggested.length ? (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Suggested inspections
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {photo.inspectionsSuggested.map((i) => (
                      <span
                        key={i}
                        className="rounded-full bg-gold-tint px-2.5 py-0.5 text-[11px] font-semibold text-gold"
                      >
                        {i}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {photo.appraisalNote ? <p>Appraisal: {photo.appraisalNote}</p> : null}
                {photo.negotiationNote ? <p>Negotiation: {photo.negotiationNote}</p> : null}
                {photo.suggestedPrice ? (
                  <p className="font-semibold text-foreground">
                    Suggested negotiation price: {money(photo.suggestedPrice)}
                  </p>
                ) : null}
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Decide your next step
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {ACTION_TILES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setActive(active === t.id ? null : t.id);
                        setPicked(
                          t.id === "agree_inspections" ? photo.inspectionsSuggested : [],
                        );
                      }}
                      className={`rounded-lg border p-3 text-left transition-colors ${
                        active === t.id
                          ? "border-brand bg-brand-tint/50"
                          : "border-border bg-card hover:border-brand hover:bg-brand-tint/30"
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground">{t.title}</div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t.blurb}</p>
                    </button>
                  ))}
                </div>

                {active === "more_info" ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      rows={3}
                      placeholder="What would you like to know about the property?"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!details.trim()}
                        onClick={() => submit("more_info")}
                        className={btnPrimary}
                      >
                        Send to agent
                      </button>
                      <button type="button" onClick={resetForms} className={btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {active === "agree_inspections" ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {INSPECTION_OPTIONS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() =>
                            setPicked(
                              picked.includes(opt)
                                ? picked.filter((x) => x !== opt)
                                : [...picked, opt],
                            )
                          }
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            picked.includes(opt)
                              ? "bg-brand text-background"
                              : "border border-border text-muted-foreground hover:bg-brand-tint"
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    <input
                      placeholder="Add another inspection or check (optional)"
                      value={extraInspection}
                      onChange={(e) => setExtraInspection(e.target.value)}
                      className={inputClass}
                    />
                    <textarea
                      rows={2}
                      placeholder="Comments for the agent (optional)"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!picked.length && !extraInspection.trim()}
                        onClick={() => submit("agree_inspections")}
                        className={btnPrimary}
                      >
                        Confirm inspections
                      </button>
                      <button type="button" onClick={resetForms} className={btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {active === "agree_negotiation" ? (
                  <div className="mt-3 space-y-2">
                    <p className="rounded-md border border-gold/40 bg-gold-tint/40 p-3 text-xs text-foreground">
                      You authorise {ba.agentName ?? "your agent"} to open negotiations
                      {photo.suggestedPrice ? (
                        <>
                          {" "}
                          at <strong>{money(photo.suggestedPrice)}</strong>
                        </>
                      ) : (
                        ""
                      )}{" "}
                      before inspection results are in. If inspections come back with negative
                      findings, the price can be renegotiated.
                    </p>
                    <textarea
                      rows={2}
                      placeholder="Comments for the agent (optional)"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submit("agree_negotiation")}
                        className={btnPrimary}
                      >
                        Authorise negotiations
                      </button>
                      <button type="button" onClick={resetForms} className={btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {active === "sign_prepurchase" ? (
                  <div className="mt-3 space-y-2">
                    <p className="rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
                      The Purchase Agreement will be conditioned upon satisfactory inspection
                      results and the appraisal value. Once it is signed, your lender issues the
                      final mortgage proposal.
                    </p>
                    <textarea
                      rows={2}
                      placeholder="Comments for the agent (optional)"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => submit("sign_prepurchase")}
                        className={btnPrimary}
                      >
                        Proceed to Purchase Agreement
                      </button>
                      <button type="button" onClick={resetForms} className={btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {active === "property_change" ? (
                  <div className="mt-3 space-y-2">
                    {(
                      [
                        ["platform", PROPERTY_CHANGE_LABEL.platform],
                        ["agent_propose", PROPERTY_CHANGE_LABEL.agent_propose],
                        ["change_criteria", PROPERTY_CHANGE_LABEL.change_criteria],
                      ] as [PropertyChangeMode, string][]
                    ).map(([id, label]) => (
                      <label key={id} className="flex items-start gap-2 text-sm text-foreground">
                        <input
                          type="radio"
                          name="change-mode"
                          checked={changeMode === id}
                          onChange={() => setChangeMode(id)}
                          className="mt-1"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                    {changeMode === "platform" ? (
                      <Link
                        to="/marketplace"
                        className="inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint"
                      >
                        Browse properties on the marketplace ↗
                      </Link>
                    ) : null}
                    {changeMode === "change_criteria" ? (
                      <textarea
                        rows={2}
                        placeholder="Describe your new criteria (budget, area, size…)"
                        value={details}
                        onChange={(e) => setDetails(e.target.value)}
                        className={inputClass}
                      />
                    ) : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={changeMode === "change_criteria" && !details.trim()}
                        onClick={() => submit("property_change")}
                        className={btnPrimary}
                      >
                        Send property change request
                      </button>
                      <button type="button" onClick={resetForms} className={btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {active === "live_call" ? (
                  <div className="mt-3 space-y-2">
                    <CallScheduler
                      realtorId={ba.agentId}
                      {...(callSlot ? { booked: callSlot } : {})}
                      onBook={(startAt) => {
                        bookCall({
                          leadId: lead.id,
                          clientName: lead.clientName,
                          propertyLabel: lead.propertyLabel,
                          kind: "intro_call",
                          startAt,
                          ...(ba.agentId ? { realtorId: ba.agentId } : {}),
                        });
                        setCallSlot(startAt);
                      }}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!callSlot}
                        onClick={() => submit("live_call")}
                        className={btnPrimary}
                      >
                        Confirm call request
                      </button>
                      <button type="button" onClick={resetForms} className={btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}

      {history.length ? (
        <div className="mt-4 border-t border-border pt-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your decisions
          </div>
          <ul className="mt-2 space-y-2">
            {history.map((a) => (
              <li key={a.id} className="rounded-md bg-background p-2.5 text-xs">
                <span className="font-semibold text-foreground">
                  {CLIENT_ACTION_LABEL[a.action]}
                </span>{" "}
                <span className="text-muted-foreground">· {formatDateTime(a.createdAt)}</span>
                {a.details ? <p className="mt-1 text-muted-foreground">{a.details}</p> : null}
                {a.extraInspections?.length ? (
                  <p className="mt-1 text-muted-foreground">
                    Inspections: {a.extraInspections.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
