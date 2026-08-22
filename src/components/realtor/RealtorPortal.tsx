import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/layout/AppHeader";
import { fullName, type LoqalUser } from "@/lib/auth";
import { useLeads, type MortgageLead } from "@/lib/leads";
import {
  activeLicenseStates,
  isRealtorOnVacation,
  useRealtors,
  type Realtor,
} from "@/lib/realtors";
import { formatDate, formatDateTime } from "@/lib/dates";
import { DateInput } from "@/components/form/DateInput";

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

function Row({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-brand">{value}</div>
      {note ? <div className="mt-1 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  );
}

/**
 * A buyer file shared with the assigned agent. Deliberately excludes SSN,
 * uploaded documents and the questionnaire answers — the agent gets contact
 * details, the property and the agreed terms, nothing more.
 */
function BuyerFile({ lead }: { lead: MortgageLead }) {
  const [open, setOpen] = useState(false);
  const t = lead.terms;
  const ba = lead.buyerAgent!;

  return (
    <li className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full flex-wrap items-center gap-4 p-5 text-left hover:bg-brand-tint/30"
      >
        <div className="min-w-[220px] flex-1">
          <div className="text-sm font-semibold text-foreground">{lead.clientName}</div>
          <div className="text-xs text-muted-foreground">
            {lead.propertyLabel} · {money(lead.propertyPrice)}
          </div>
        </div>
        {ba.nextStep === "live_call" ? (
          <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
            📞 Live call requested
          </span>
        ) : (
          <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
            Active buyer
          </span>
        )}
        <span className="text-xs text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="grid gap-4 border-t border-border bg-background/50 p-5 lg:grid-cols-2">
          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Property</h3>
            <div className="mt-2">
              <Row label="Property" value={lead.propertyLabel} />
              <Row label="Purchase price" value={money(lead.propertyPrice)} />
              {t ? (
                <>
                  <Row label="Rate / term" value={`${t.ratePct}% · ${t.termYears} years`} />
                  <Row label="Down payment" value={`${t.downPaymentPct}%`} />
                </>
              ) : null}
              <Row label="Your fee" value={`${ba.feePct}% at closing`} />
              <Row label="Assigned" value={formatDateTime(ba.assignedAt)} />
            </div>
            <Link
              to="/property/$propertyId"
              params={{ propertyId: String(lead.propertyId) }}
              className="mt-3 inline-flex rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint"
            >
              Open property page ↗
            </Link>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Buyer</h3>
            <div className="mt-2">
              <Row label="Name" value={lead.clientName} />
              <Row label="E-mail" value={lead.clientEmail} />
              <Row label="US status" value={lead.usPerson ? "US citizen / green card" : "Non-US person"} />
              {ba.nextStep === "live_call" ? (
                <Row label="Live call" value={`Requested ${formatDateTime(ba.liveCallRequestedAt)}`} />
              ) : (
                <Row label="Kickoff" value="Starts in writing — no call requested" />
              )}
            </div>
            <p className="mt-3 rounded-md bg-brand-tint/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
              Not shared with buyer's agents: SSN, uploaded documents and the client's mortgage
              questionnaire answers.
            </p>
          </section>
        </div>
      ) : null}
    </li>
  );
}

function VacationMode({ me }: { me: Realtor }) {
  const { updateRealtor } = useRealtors();
  const [from, setFrom] = useState(me.vacationFrom ?? "");
  const [until, setUntil] = useState(me.vacationUntil ?? "");
  const active = isRealtorOnVacation(me);

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Vacation mode</h2>
        {active ? (
          <span className="rounded-full bg-gold-tint px-3 py-1 text-[11px] font-semibold text-gold">
            On vacation — excluded from new assignments
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        While on vacation you keep your current buyers but no new buyer files are assigned to you.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            From
          </span>
          <DateInput
            value={from}
            onChange={setFrom}
            className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Until
          </span>
          <DateInput
            value={until}
            onChange={setUntil}
            className="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
          />
        </label>
        <button
          type="button"
          disabled={!from || !until}
          onClick={() => updateRealtor(me.id, { vacationFrom: from, vacationUntil: until })}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
        >
          Set vacation
        </button>
        {me.vacationFrom || me.vacationUntil ? (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setUntil("");
              updateRealtor(me.id, { vacationFrom: "", vacationUntil: "" });
            }}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-destructive"
          >
            Clear
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function RealtorPortal({ user }: { user: LoqalUser }) {
  const { realtors, ensureSeat } = useRealtors();
  const { leads, ready: leadsReady } = useLeads();

  const me = realtors.find((r) => r.email.toLowerCase() === user.email.toLowerCase());

  useEffect(() => {
    if (!me && user.email) ensureSeat(user.email, user.firstName, user.lastName, user.phone);
  }, [me, user, ensureSeat]);

  const mine = useMemo(
    () => (me ? leads.filter((l) => l.buyerAgent?.agentId === me.id) : []),
    [leads, me],
  );
  const liveCalls = mine.filter((l) => l.buyerAgent?.nextStep === "live_call").length;

  if (!leadsReady || !me) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader navSlot={<span className="text-sm font-semibold text-brand">Buyer's agent workspace</span>} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        navSlot={<span className="text-sm font-semibold text-brand">Buyer's agent workspace</span>}
      />
      <main className="mx-auto max-w-[1400px] px-4 py-8 md:px-7">
        <div className="mb-8">
          <span className="rounded-full bg-gold-tint px-3 py-1 text-xs font-semibold text-gold">
            Realtor partner
          </span>
          <h1 className="mt-3 text-2xl font-bold text-foreground md:text-[32px]">
            Welcome back, {fullName(user)}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Buyers assigned to you, your licenses and your availability.
          </p>
        </div>

        {!me.approvedAt ? (
          <div className="mb-6 rounded-lg border border-gold/40 bg-gold-tint/50 p-4 text-sm text-foreground">
            <strong>Registration pending.</strong> A Loqal admin reviews every partner registration
            before access is granted. Once approved, buyer files can be assigned to you.
          </div>
        ) : null}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Active buyers" value={mine.length} note="Assigned to you right now" />
          <Stat
            label="Live calls requested"
            value={liveCalls}
            note={liveCalls ? "Reach out to schedule" : "None pending"}
          />
          <Stat
            label="Licensed states"
            value={activeLicenseStates(me).length || "—"}
            note={activeLicenseStates(me).join(", ") || "Add licenses to receive assignments"}
          />
        </section>

        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">My buyer files</h2>
            <span className="text-xs text-muted-foreground">
              Assigned by Loqal based on your licenses, pipeline and languages
            </span>
          </div>
          {mine.length ? (
            <ul className="space-y-4">
              {mine.map((l) => (
                <BuyerFile key={l.id} lead={l} />
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-border bg-card p-10 text-center text-sm text-muted-foreground">
              No buyer files assigned yet. When a client confirms their pre-approval terms in a
              state you are licensed in, the file appears here.
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <VacationMode me={me} />

          <section className="rounded-lg border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">My licenses & languages</h2>
            {me.licenses.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-4 font-semibold">State</th>
                      <th className="py-2 pr-4 font-semibold">License №</th>
                      <th className="py-2 pr-4 font-semibold">Issued</th>
                      <th className="py-2 font-semibold">Valid until</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {me.licenses.map((l) => (
                      <tr key={`${l.state}-${l.number}`}>
                        <td className="py-2.5 pr-4 font-semibold text-foreground">{l.state}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{l.number}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(l.issuedAt)}</td>
                        <td className="py-2.5 text-muted-foreground">{formatDate(l.validUntil)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No licenses on file yet. They are added from your approved partner registration.
              </p>
            )}
            <div className="mt-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Languages
              </span>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {me.languages.map((l) => (
                  <span
                    key={l}
                    className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand"
                  >
                    {l}
                  </span>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
