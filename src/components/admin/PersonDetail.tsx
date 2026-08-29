/**
 * Full admin view of one person on file: registration & personal data (with
 * inline editing), account/password controls, every uploaded document, the
 * property files they are involved in, their activity history and their
 * platform engagement metrics.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatDate, formatDateTime } from "@/lib/dates";
import { PARTNER_LABEL } from "@/lib/auth";
import { useLeads, LEAD_STATUS_LABEL, KICKOFF_LABEL, type MortgageLead } from "@/lib/leads";
import { usePartnerRequests, type PartnerRequest } from "@/lib/partner-requests";
import { useDirectory } from "@/lib/directory";
import { useActivity, logActivity } from "@/lib/activity";
import { engagementFor, usePresence } from "@/lib/presence";
import {
  getAccountInfo,
  requestPasswordChange,
  setAccountPassword,
  type AdminAccountInfo,
} from "@/lib/admin-users.functions";
import type { AdminPerson } from "@/components/admin/people-model";

type Tab = "profile" | "documents" | "properties" | "activity" | "metrics";

const TABS: [Tab, string, string][] = [
  ["profile", "👤", "Profile & registration"],
  ["documents", "📎", "Uploaded documents"],
  ["properties", "🏠", "Properties & files"],
  ["activity", "🕘", "Activity history"],
  ["metrics", "📊", "Engagement metrics"],
];

export function PersonDetail({
  person,
  onClose,
  onMessage,
}: {
  person: AdminPerson;
  onClose: () => void;
  onMessage: (p: { email: string; name: string; role: string }) => void;
}) {
  const [tab, setTab] = useState<Tab>("profile");

  return (
    <div
      className="fixed inset-0 z-[70] flex justify-end bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label={`Profile of ${person.name}`}
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-foreground">{person.name}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {person.roleLabel} · {person.email}
                {person.phone ? ` · ${person.phone}` : ""}
              </p>
              {person.company ? (
                <p className="text-xs text-muted-foreground">{person.company}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() =>
                  onMessage({ email: person.email, name: person.name, role: person.roleLabel })
                }
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-background hover:bg-brand-soft"
              >
                Message
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground"
              >
                Close
              </button>
            </div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {TABS.map(([id, icon, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  tab === id
                    ? "bg-brand-tint text-brand"
                    : "text-muted-foreground hover:bg-brand-tint hover:text-brand"
                }`}
              >
                <span aria-hidden>{icon}</span> {label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === "profile" ? <ProfileTab person={person} /> : null}
          {tab === "documents" ? <DocumentsTab person={person} /> : null}
          {tab === "properties" ? <PropertiesTab person={person} /> : null}
          {tab === "activity" ? <ActivityTab person={person} /> : null}
          {tab === "metrics" ? <MetricsTab person={person} /> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Profile & registration                                              */
/* ------------------------------------------------------------------ */

function ProfileTab({ person }: { person: AdminPerson }) {
  const { setOverride } = useDirectory();
  const { updateRequest } = usePartnerRequests();
  const req = person.request;

  const [name, setName] = useState(person.name);
  const [phone, setPhone] = useState(person.phone ?? "");
  const [company, setCompany] = useState(person.company ?? "");
  const [note, setNote] = useState(person.note ?? "");
  const [reg, setReg] = useState<Partial<PartnerRequest>>({});

  const regValue = <K extends keyof PartnerRequest>(key: K): PartnerRequest[K] | undefined =>
    (reg[key] ?? req?.[key]) as PartnerRequest[K] | undefined;

  function save() {
    setOverride(person.email, {
      displayName: name.trim(),
      phone: phone.trim() || undefined,
      company: company.trim() || undefined,
      note: note.trim() || undefined,
    });
    if (req) {
      const [firstName, ...rest] = name.trim().split(/\s+/);
      updateRequest(req.id, {
        ...reg,
        firstName: firstName || req.firstName,
        lastName: rest.join(" ") || req.lastName,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(company.trim() ? { companyName: company.trim() } : {}),
      });
    }
    logActivity("Loqal admin", "edited a profile", `${person.name} (${person.email})`);
    toast("Profile saved", { description: person.email });
  }

  return (
    <div className="space-y-6">
      <Card title="Contact & display data">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Full name" value={name} onChange={setName} />
          <Text label="Phone" value={phone} onChange={setPhone} />
          <Text label="Company" value={company} onChange={setCompany} />
          <Text label="Internal note (Loqal only)" value={note} onChange={setNote} />
        </div>
      </Card>

      {req ? (
        <Card title="Registration information">
          <div className="grid gap-3 sm:grid-cols-2">
            <Text
              label="Legal company name"
              value={regValue("companyName") ?? ""}
              onChange={(v) => setReg({ ...reg, companyName: v })}
            />
            <Text
              label="Company type"
              value={regValue("companyType") ?? ""}
              onChange={(v) => setReg({ ...reg, companyType: v })}
            />
            <Text
              label="Registration number"
              value={regValue("registrationNumber") ?? ""}
              onChange={(v) => setReg({ ...reg, registrationNumber: v })}
            />
            <Text
              label="Position"
              value={regValue("position") ?? ""}
              onChange={(v) => setReg({ ...reg, position: v })}
            />
            <Text
              label="Street"
              value={regValue("street") ?? ""}
              onChange={(v) => setReg({ ...reg, street: v })}
            />
            <Text
              label="City"
              value={regValue("city") ?? ""}
              onChange={(v) => setReg({ ...reg, city: v })}
            />
            <Text
              label="State"
              value={regValue("state") ?? ""}
              onChange={(v) => setReg({ ...reg, state: v })}
            />
            <Text
              label="ZIP"
              value={regValue("zip") ?? ""}
              onChange={(v) => setReg({ ...reg, zip: v })}
            />
            <Text
              label="Country"
              value={regValue("country") ?? ""}
              onChange={(v) => setReg({ ...reg, country: v })}
            />
            <Text
              label="Lender / NMLS licence"
              value={regValue("lenderLicence") ?? ""}
              onChange={(v) => setReg({ ...reg, lenderLicence: v })}
            />
            <Text
              label="Company licence"
              value={regValue("companyLicence") ?? ""}
              onChange={(v) => setReg({ ...reg, companyLicence: v })}
            />
            <Text
              label="Company phone"
              value={regValue("companyPhone") ?? ""}
              onChange={(v) => setReg({ ...reg, companyPhone: v })}
            />
          </div>
          <dl className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
            <Row label="Kind" value={req.kind === "corporate" ? "Corporate client" : "Partner"} />
            <Row
              label="Partner category"
              value={req.partnerType ? PARTNER_LABEL[req.partnerType] : "—"}
            />
            <Row label="Status" value={req.status} />
            <Row label="Submitted" value={formatDate(req.submittedAt)} />
            <Row
              label="Coverage"
              value={req.allStates ? "All states" : req.states.join(", ") || "—"}
            />
            <Row label="Languages" value={req.languages?.join(", ") || "—"} />
            <Row
              label="T&C accepted"
              value={req.tcAcceptedAt ? formatDateTime(req.tcAcceptedAt) : "—"}
            />
            <Row
              label="Agreement signed"
              value={
                req.agreementSignedAt
                  ? `${formatDateTime(req.agreementSignedAt)} by ${req.agreementSignedBy ?? "—"}`
                  : "not signed"
              }
            />
            <Row
              label="Countersigned by Loqal"
              value={
                req.agreementCountersignedAt ? formatDateTime(req.agreementCountersignedAt) : "—"
              }
            />
          </dl>
          {req.realtorLicenses?.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {req.realtorLicenses.map((l) => (
                <span
                  key={`${l.state}-${l.number}`}
                  className="rounded bg-brand-tint px-2 py-1 text-[11px] font-semibold text-brand"
                >
                  {l.state} · {l.number} · valid till {formatDate(l.validUntil)}
                </span>
              ))}
            </div>
          ) : null}
          {req.kyc ? (
            <div className="mt-4 rounded-lg border border-border p-3 text-xs">
              <div className="font-semibold text-foreground">KYB questionnaire</div>
              <Row label="Director" value={`${req.kyc.director.fullName} · ${req.kyc.director.citizenship}`} />
              <Row label="Director address" value={req.kyc.director.address} />
              {req.kyc.shareholders.map((s) => (
                <Row
                  key={s.fullName}
                  label={`Shareholder ${s.sharePct ? `${s.sharePct}%` : ""}`}
                  value={`${s.fullName} · ${s.citizenship} · ${s.countryOfResidence}`}
                />
              ))}
              <Row label="Submitted" value={formatDateTime(req.kyc.submittedAt)} />
            </div>
          ) : null}
        </Card>
      ) : null}

      {person.leads.length ? <ClientPersonalData lead={person.leads[0]!} /> : null}

      <AccessCard person={person} />

      <div className="sticky bottom-0 -mx-6 border-t border-border bg-card px-6 py-3">
        <button
          type="button"
          onClick={save}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}

function ClientPersonalData({ lead }: { lead: MortgageLead }) {
  const p = lead.profile;
  return (
    <Card title="Personal data on file (mortgage application)">
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <Row label="Date of birth" value={p.dateOfBirth ? formatDate(p.dateOfBirth) : "—"} />
        <Row label="SSN" value={p.ssn ?? "not provided"} />
        <Row label="ITIN" value={p.itin ?? (p.hasItin ? "declared" : "—")} />
        <Row label="US person" value={lead.usPerson ? "Yes" : "No"} />
        <Row label="Citizenship" value={p.citizenship ?? "—"} />
        <Row label="Second citizenship" value={p.secondCitizenship ?? "—"} />
        <Row label="Country of residence" value={p.countryOfResidence ?? "—"} />
        <Row label="US status" value={p.usStatus ?? "—"} />
        <Row
          label="Visa"
          value={
            p.usVisaActive
              ? `${p.visaType ?? "visa"} · ${p.visaIssued ? formatDate(p.visaIssued) : "—"} → ${
                  p.visaValidUntil ? formatDate(p.visaValidUntil) : "—"
                }`
              : "—"
          }
        />
        <Row label="Marital status" value={p.maritalStatus ?? "—"} />
        <Row label="Dependents" value={String(p.dependents?.length ?? 0)} />
        <Row
          label="Monthly gross income"
          value={p.monthlyGross ? `$${p.monthlyGross.toLocaleString()}` : "—"}
        />
        <Row label="US bank account" value={p.usBankAccount ? "Yes" : "No"} />
        <Row label="Property use" value={p.propertyUse ?? "—"} />
        <Row label="Profile submitted" value={formatDateTime(p.submittedAt)} />
      </dl>

      <SubList
        title="Address history"
        items={p.addresses.map(
          (a) =>
            `${a.street}, ${a.city}${a.state ? `, ${a.state}` : ""} ${a.zip} ${a.country ?? ""} · ${formatDate(
              a.from,
            )} → ${a.present ? "present" : formatDate(a.to)}`,
        )}
      />
      <SubList
        title="Employment history"
        items={p.employment.map(
          (e) =>
            `${e.title} at ${e.employer} · ${formatDate(e.from)} → ${
              e.current ? "present" : formatDate(e.to)
            }`,
        )}
      />
      <SubList
        title="Income sources"
        items={(p.incomes ?? []).map(
          (i) =>
            `${i.type} · ${i.employer || "—"} · ${i.title || ""} · ${
              i.current ? "current" : "past"
            }${i.currency && i.currency !== "USD" ? ` · ${i.currency}` : ""}`,
        )}
      />
    </Card>
  );
}

function AccessCard({ person }: { person: AdminPerson }) {
  const [info, setInfo] = useState<AdminAccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAccountInfo({ data: { email: person.email } })
      .then((r) => alive && setInfo(r))
      .catch(() => alive && setInfo(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [person.email]);

  async function changePassword() {
    setBusy(true);
    try {
      await setAccountPassword({ data: { email: person.email, password: pwd } });
      logActivity("Loqal admin", "set a new password", person.email);
      toast("Password updated", { description: person.email });
      setPwd("");
    } catch (e) {
      toast("Could not update the password", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function sendReset() {
    setBusy(true);
    try {
      await requestPasswordChange({
        data: {
          email: person.email,
          redirectTo: `${window.location.origin}/reset-password`,
        },
      });
      logActivity("Loqal admin", "requested a password change", person.email);
      toast("Password change requested", { description: `E-mail sent to ${person.email}` });
    } catch (e) {
      toast("Could not send the request", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Account access">
      {loading ? (
        <p className="text-xs text-muted-foreground">Checking the account…</p>
      ) : !info?.exists ? (
        <p className="text-xs text-muted-foreground">
          No login exists for this e-mail yet — the person registered but has not created an
          account, or signs in with a different address.
        </p>
      ) : (
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <Row
            label="Last authenticated"
            value={info.lastSignInAt ? formatDateTime(info.lastSignInAt) : "never"}
          />
          <Row label="Account created" value={info.createdAt ? formatDate(info.createdAt) : "—"} />
          <Row label="E-mail confirmed" value={info.emailConfirmed ? "Yes" : "No"} />
        </dl>
      )}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Set a new password
          </span>
          <input
            type="text"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="min. 8 characters"
            className="w-56 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <button
          type="button"
          disabled={busy || pwd.length < 8 || !info?.exists}
          onClick={changePassword}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50"
        >
          Change password
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={sendReset}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-brand-tint disabled:opacity-50"
        >
          Request password change by e-mail
        </button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Documents                                                           */
/* ------------------------------------------------------------------ */

function DocumentsTab({ person }: { person: AdminPerson }) {
  const req = person.request;
  const groups: { title: string; items: { name: string; at?: string; url?: string }[] }[] = [];

  if (req) {
    groups.push({
      title: "Verification documents",
      items: req.verificationDocs.map((name) => ({ name })),
    });
    const kycDocs: { name: string }[] = [];
    if (req.kyc?.creatorIdDoc) kycDocs.push({ name: `Creator ID · ${req.kyc.creatorIdDoc}` });
    if (req.kyc?.authorizationDoc)
      kycDocs.push({ name: `Authorization · ${req.kyc.authorizationDoc}` });
    for (const s of req.kyc?.shareholders ?? [])
      if (s.idDoc) kycDocs.push({ name: `${s.fullName} ID · ${s.idDoc}` });
    if (req.kyc?.director.idDoc)
      kycDocs.push({ name: `Director ID · ${req.kyc.director.idDoc}` });
    groups.push({ title: "KYB documents", items: kycDocs });
  }

  for (const lead of person.leads) {
    const p = lead.profile;
    const add = (title: string, docs?: { id: string; name: string; uploadedAt: string; url?: string }[]) => {
      if (docs?.length)
        groups.push({
          title: `${title} — ${lead.propertyLabel}`,
          items: docs.map((d) => ({
            name: d.name,
            at: d.uploadedAt,
            ...(d.url ? { url: d.url } : {}),
          })),
        });
    };
    add("Identity documents", p.idDocuments);
    add("Visa documents", p.visaDocuments);
    add("Bankruptcy discharge", p.bankruptcyDocuments);
    const infoDocs = lead.infoRequests.flatMap((r) => r.documents);
    if (infoDocs.length)
      groups.push({
        title: `Lender information requests — ${lead.propertyLabel}`,
        items: infoDocs.map((d) => ({
          name: d.name,
          at: d.uploadedAt,
          ...(d.url ? { url: d.url } : {}),
        })),
      });
  }

  const visible = groups.filter((g) => g.items.length);
  if (!visible.length)
    return <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>;

  return (
    <div className="space-y-5">
      {visible.map((g) => (
        <Card key={g.title} title={g.title}>
          <ul className="space-y-1.5 text-sm">
            {g.items.map((d, i) => (
              <li key={`${d.name}-${i}`} className="flex items-center justify-between gap-3">
                <span className="truncate text-foreground">📄 {d.name}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {d.at ? formatDate(d.at) : null}
                  {d.url ? (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-brand"
                    >
                      Open
                    </a>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Properties                                                          */
/* ------------------------------------------------------------------ */

function PropertiesTab({ person }: { person: AdminPerson }) {
  const { leads } = useLeads();
  const own = useMemo(
    () => leads.filter((l) => l.clientEmail.toLowerCase() === person.email.toLowerCase()),
    [leads, person.email],
  );

  if (!own.length)
    return (
      <p className="text-sm text-muted-foreground">
        No property files on this profile yet.
      </p>
    );

  return (
    <div className="space-y-5">
      {own.map((l) => (
        <Card key={l.id} title={l.propertyLabel}>
          <dl className="grid gap-2 text-xs sm:grid-cols-2">
            <Row label="Price" value={`$${l.propertyPrice.toLocaleString()}`} />
            <Row label="Application status" value={LEAD_STATUS_LABEL[l.status]} />
            <Row label="Submitted" value={formatDateTime(l.submittedAt)} />
            <Row label="Loan processor" value={l.assignedToName ?? "unassigned"} />
            <Row
              label="Lender terms"
              value={
                l.terms
                  ? `${l.terms.ratePct}% · ${l.terms.termYears}y · ${l.terms.downPaymentPct}% down (${
                      l.terms.lenderName ?? "lender"
                    })`
                  : "not issued"
              }
            />
            <Row label="Client decision" value={l.clientDecision ?? "pending"} />
            <Row
              label="Buyer's agent"
              value={
                l.buyerAgent
                  ? `${l.buyerAgent.agentName ?? "assigning"} · ${l.buyerAgent.feePct}% fee`
                  : "—"
              }
            />
            <Row
              label="Kickoff"
              value={l.buyerAgent?.kickoff ? KICKOFF_LABEL[l.buyerAgent.kickoff] : "—"}
            />
            <Row
              label="Representation"
              value={l.buyerAgent?.representation ?? "—"}
            />
          </dl>
          {l.infoRequests.length ? (
            <SubList
              title="Lender information requests"
              items={l.infoRequests.map(
                (r) =>
                  `${formatDate(r.requestedAt)} · ${r.question} — ${
                    r.answeredAt ? `answered ${formatDate(r.answeredAt)}` : "open"
                  }`,
              )}
            />
          ) : null}
          {l.clientQuestions?.length ? (
            <SubList
              title="Client questions"
              items={l.clientQuestions.map(
                (q) => `${formatDate(q.askedAt)} · ${q.text}`,
              )}
            />
          ) : null}
        </Card>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity                                                            */
/* ------------------------------------------------------------------ */

function ActivityTab({ person }: { person: AdminPerson }) {
  const entries = useActivity();
  const presence = usePresence();
  const email = person.email.toLowerCase();
  const name = person.name.toLowerCase();

  const own = entries.filter(
    (e) =>
      e.actor.toLowerCase().includes(email) ||
      e.actor.toLowerCase().includes(name) ||
      (e.details ?? "").toLowerCase().includes(email),
  );
  const visits = presence[email]?.visits ?? [];

  return (
    <div className="space-y-5">
      <Card title="Recorded platform actions">
        {own.length === 0 ? (
          <p className="text-xs text-muted-foreground">No logged actions for this profile.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {own.map((e) => (
              <li key={e.id} className="flex gap-3">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(e.at)}
                </span>
                <span className="text-foreground">
                  {e.action}
                  {e.details ? <span className="text-muted-foreground"> · {e.details}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Page-by-page trail">
        {visits.length === 0 ? (
          <p className="text-xs text-muted-foreground">No browsing recorded yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {visits.slice(0, 40).map((v, i) => (
              <li key={`${v.at}-${i}`} className="flex gap-3">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">
                  {formatDateTime(v.at)}
                </span>
                <span className="text-foreground">{v.path}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {v.seconds < 60 ? `${v.seconds}s` : `${Math.round(v.seconds / 60)} min`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

function MetricsTab({ person }: { person: AdminPerson }) {
  const presence = usePresence();
  const m = engagementFor(presence, person.email);

  if (!m.lastSeen)
    return (
      <p className="text-sm text-muted-foreground">
        No activity recorded for this profile yet — metrics appear once the person browses the
        platform while signed in.
      </p>
    );

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Last online" value={formatDateTime(m.lastSeen)} />
        <Metric label="Sessions" value={String(m.sessions)} />
        <Metric label="Time on platform" value={`${m.totalMinutes} min`} />
        <Metric label="Page views / week" value={String(m.visitsPerWeek)} />
      </div>
      <Card title="Where they spend time">
        <ul className="space-y-1.5 text-sm">
          {m.topPages.map((p) => (
            <li key={p.path} className="flex justify-between gap-3">
              <span className="text-foreground">{p.path}</span>
              <span className="text-xs text-muted-foreground">
                {p.visits} views · {p.minutes} min
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Search behaviour">
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <Row
            label="Areas searched most"
            value={m.topAreas.map((a) => `${a.area} (${a.count})`).join(", ") || "—"}
          />
          <Row
            label="Filters used most"
            value={m.topQueries.map((q) => `${q.query} (${q.count})`).join(", ") || "—"}
          />
          <Row
            label="Typical price band"
            value={
              m.priceBand
                ? `$${m.priceBand.min.toLocaleString()} – $${m.priceBand.max.toLocaleString()}`
                : "—"
            }
          />
          <Row label="First seen" value={m.firstSeen ? formatDateTime(m.firstSeen) : "—"} />
        </dl>
        {m.searches.length ? (
          <SubList
            title="Recent searches"
            items={m.searches.map(
              (s) =>
                `${formatDateTime(s.at)} · ${s.area || "anywhere"}${
                  s.query ? ` · ${s.query}` : ""
                }${
                  s.priceMin || s.priceMax
                    ? ` · $${(s.priceMin ?? 0).toLocaleString()}–$${(s.priceMax ?? 0).toLocaleString()}`
                    : ""
                }`,
            )}
          />
        ) : null}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                               */
/* ------------------------------------------------------------------ */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-brand">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0 font-semibold text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 break-words text-foreground">{value}</dd>
    </div>
  );
}

function Text({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}

function SubList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <ul className="mt-1.5 space-y-1 text-xs text-foreground">
        {items.map((i, idx) => (
          <li key={`${i}-${idx}`}>• {i}</li>
        ))}
      </ul>
    </div>
  );
}
