/**
 * Realtor partner profile, organised by topic:
 *   • Contact details (editable)
 *   • Languages (add / edit / delete one by one)
 *   • Company information (registration data + extra contact people)
 *   • Coverage & licences (state table with verification status)
 *   • Agreements & status
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type LoqalUser } from "@/lib/auth";
import { useLeads } from "@/lib/leads";
import { useBuyerProcess } from "@/lib/buyer-process";
import { activeLicenseStates, useRealtors } from "@/lib/realtors";
import { usePartnerRequests, type AdditionalContact } from "@/lib/partner-requests";
import { formatDate, formatDateTime } from "@/lib/dates";
import { WORLD_LANGUAGES } from "@/lib/languages";
import { TopicCard } from "@/components/profile/TopicCard";
import { LicenceCoverageTable } from "@/components/profile/realtor-licences";
import { uid } from "@/lib/mortgage-form";
import { PhoneField } from "@/components/form/PhoneField";
import { isValidPhone } from "@/lib/phone";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const labelClass =
  "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

function Row({ label, value }: { label: string; value?: string | number | null | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm text-foreground">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-3 text-center">
      <div className="text-lg font-bold text-brand">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

type InfoForm = {
  phone: string;
  position: string;
};


export function RealtorProfileCard({ user }: { user: LoqalUser }) {
  const { realtors, ensureSeat, updateRealtor } = useRealtors();
  const { requests, updateRequest } = usePartnerRequests();
  const { leads } = useLeads();
  const { photos } = useBuyerProcess();
  const me = realtors.find((r) => r.email.toLowerCase() === user.email.toLowerCase());
  const registration = requests.find((r) => r.email.toLowerCase() === user.email.toLowerCase());

  useEffect(() => {
    if (!me && user.email) ensureSeat(user.email, user.firstName, user.lastName, user.phone);
  }, [me, user, ensureSeat]);

  const [info, setInfo] = useState<InfoForm | null>(null);

  if (!me) return null;

  const mine = leads.filter((l) => l.buyerAgent?.agentId === me.id);
  const delivered = mine.filter((l) => photos[l.id]?.status === "delivered").length;
  const advocated = mine.filter((l) => l.buyerAgent?.representation === "loqal_rep").length;
  const personName = `${registration?.firstName || user.firstName} ${
    registration?.lastName || user.lastName
  }`.trim();
  const languages = registration?.languages?.length ? registration.languages : me.languages;

  function startEdit() {
    if (!me) return;
    setInfo({ phone: registration?.phone || me.phone, position: registration?.position ?? "" });
  }

  function save() {
    if (!me || !info) return;
    if (!isValidPhone(info.phone)) {
      toast.error("Please enter a valid phone number for the selected country.");
      return;
    }
    updateRealtor(me.id, { phone: info.phone.trim() });
    if (registration)
      updateRequest(registration.id, { position: info.position.trim(), phone: info.phone.trim() });
    setInfo(null);
    toast.success("Contact details updated.");
  }


  function saveLanguages(next: string[]) {
    if (!me) return;
    updateRealtor(me.id, { languages: next });
    if (registration) updateRequest(registration.id, { languages: next });
  }

  const businessAddress = registration
    ? [
        registration.street,
        registration.city,
        `${registration.state} ${registration.zip}`.trim(),
        registration.country,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <div className="space-y-3">
      {registration ? (
        <TopicCard
          title="Company information"
          summary={
            [registration.companyName, registration.companyType].filter(Boolean).join(" · ") ||
            "On file"
          }
        >
          <Row label="Company name" value={registration.companyName} />
          <Row label="Company type" value={registration.companyType} />
          <Row label="Registration №" value={registration.registrationNumber} />
          <Row label="Company licence №" value={registration.companyLicence} />
          <Row label="Business address" value={businessAddress} />
          <Row label="Company phone" value={registration.companyPhone} />
        </TopicCard>
      ) : null}

      <TopicCard
        title="Contact details"
        summary={
          [personName, registration?.position, registration?.phone || me.phone]
            .filter(Boolean)
            .join(" · ") ||
          "Add your contact details"
        }
        onEdit={info ? undefined : startEdit}
        defaultOpen={Boolean(info)}
      >
        {info ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Position</span>
                <input
                  value={info.position}
                  onChange={(e) => setInfo({ ...info, position: e.target.value })}
                  placeholder="e.g. Broker"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Personal phone</span>
                <PhoneField
                  value={info.phone}
                  onChange={(v) => setInfo({ ...info, phone: v })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setInfo(null)} className={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={save} className={btnPrimary}>
                Save changes
              </button>
            </div>
          </div>
        ) : (
          <div>
            <Row label="Name" value={registration?.firstName || user.firstName} />
            <Row label="Surname" value={registration?.lastName || user.lastName} />
            <Row label="Position" value={registration?.position} />
            <Row label="Personal phone" value={registration?.phone || me.phone} />
          </div>
        )}

        {registration ? (
          <AdditionalContacts
            contacts={registration.additionalContacts ?? []}
            onChange={(next) => updateRequest(registration.id, { additionalContacts: next })}
          />
        ) : null}
      </TopicCard>

      <TopicCard
        title="Languages"
        summary={languages.length ? languages.join(", ") : "No languages added yet"}
      >
        <p className="mb-3 rounded-md bg-brand-tint/40 p-3 text-xs leading-relaxed text-muted-foreground">
          Loqal asks clients for their preferred languages so we can match them with the best
          realtor for their needs. Please list only the languages you can communicate in fluently,
          both verbally and in writing.
        </p>
        <LanguagesEditor values={languages} onChange={saveLanguages} />
      </TopicCard>

      {registration ? (
        <>
          <TopicCard
            title="Coverage & licences"
            summary={
              registration.allStates
                ? "All states"
                : registration.states.length
                  ? `${registration.states.length} state${registration.states.length === 1 ? "" : "s"} served`
                  : "No states declared"
            }
          >
            <Row
              label="States served"
              value={registration.allStates ? "All states" : registration.states.join(", ")}
            />
            <div className="mt-4">
              <LicenceCoverageTable user={user} />
            </div>
          </TopicCard>


          <TopicCard
            title="Agreements & status"
            summary={`${
              registration.status === "approved"
                ? "Approved"
                : registration.status === "declined"
                  ? "Declined"
                  : "Pending review"
            } · submitted ${formatDate(registration.submittedAt)}`}
          >
            <Row label="Submitted" value={formatDate(registration.submittedAt)} />
            <Row
              label="Partner T&C accepted"
              value={registration.tcAcceptedAt ? formatDateTime(registration.tcAcceptedAt) : undefined}
            />
            <Row
              label="Agreement signed"
              value={
                registration.agreementSignedAt
                  ? `${formatDateTime(registration.agreementSignedAt)}${
                      registration.agreementSignedBy ? ` by ${registration.agreementSignedBy}` : ""
                    }`
                  : undefined
              }
            />
            <Row
              label="Countersigned by Loqal"
              value={
                registration.agreementCountersignedAt
                  ? formatDateTime(registration.agreementCountersignedAt)
                  : undefined
              }
            />
            <Row
              label="Registration status"
              value={
                registration.status === "approved"
                  ? "Approved"
                  : registration.status === "declined"
                    ? "Declined"
                    : "Pending review"
              }
            />
          </TopicCard>
        </>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">My work stats</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Assigned files" value={mine.length} />
          <Stat label="With Loqal advocate" value={advocated} />
          <Stat label="Photo sets delivered" value={delivered} />
          <Stat label="Licensed states" value={activeLicenseStates(me).length} />
        </div>
      </section>
    </div>
  );
}

/** Add, replace or delete one language at a time. */
function LanguagesEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div>
      {values.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No languages yet — buyers are matched to agents who speak their language.
        </p>
      ) : (
        <ul className="space-y-2">
          {values.map((lang) => (
            <li
              key={lang}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              {editing === lang ? (
                <LanguagePicker
                  exclude={values.filter((v) => v !== lang)}
                  onCancel={() => setEditing(null)}
                  onPick={(next) => {
                    onChange(values.map((v) => (v === lang ? next : v)));
                    setEditing(null);
                    toast.success("Language updated.");
                  }}
                />
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground">{lang}</span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(lang)}
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-tint"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(values.filter((v) => v !== lang));
                        toast.success(`${lang} removed.`);
                      }}
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive"
                    >
                      Delete
                    </button>
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        {adding ? (
          <LanguagePicker
            exclude={values}
            onCancel={() => setAdding(false)}
            onPick={(next) => {
              onChange([...values, next]);
              setAdding(false);
              toast.success(`${next} added.`);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
          >
            + Add language
          </button>
        )}
      </div>
    </div>
  );
}

function LanguagePicker({
  exclude,
  onPick,
  onCancel,
}: {
  exclude: string[];
  onPick: (language: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = WORLD_LANGUAGES.filter((l) => !exclude.includes(l));
    return (q ? pool.filter((l) => l.toLowerCase().includes(q)) : pool).slice(0, 8);
  }, [query, exclude]);

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a language…"
          className={inputClass}
        />
        <button type="button" onClick={onCancel} className={btnGhost}>
          Cancel
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {matches.map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => onPick(l)}
            className="rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand hover:bg-brand hover:text-background"
          >
            {l}
          </button>
        ))}
        {matches.length === 0 ? (
          <span className="text-xs text-muted-foreground">No match.</span>
        ) : null}
      </div>
    </div>
  );
}

/** Extra company contact people — name, surname, email, phone, position. */
function AdditionalContacts({
  contacts,
  onChange,
}: {
  contacts: AdditionalContact[];
  onChange: (next: AdditionalContact[]) => void;
}) {
  const [form, setForm] = useState<AdditionalContact | null>(null);
  const isNew = form ? !contacts.some((c) => c.id === form.id) : false;

  function submit() {
    if (!form) return;
    if (!form.firstName.trim() || !form.email.trim()) {
      toast.error("Name and email are required for a contact person.");
      return;
    }
    onChange(
      isNew ? [...contacts, form] : contacts.map((c) => (c.id === form.id ? form : c)),
    );
    setForm(null);
    toast.success("Contact person saved.");
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">Additional contact people</h4>
        {form === null ? (
          <button
            type="button"
            onClick={() =>
              setForm({
                id: uid(),
                firstName: "",
                lastName: "",
                email: "",
                phone: "",
                position: "",
              })
            }
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-brand-tint"
          >
            + Add contact
          </button>
        ) : null}
      </div>

      {contacts.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Nobody else added yet. Add colleagues Loqal may contact about this company.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    {`${c.firstName} ${c.lastName}`.trim()}
                    {c.position ? (
                      <span className="text-muted-foreground"> · {c.position}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {[c.email, c.phone].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(c)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-tint"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(contacts.filter((x) => x.id !== c.id))}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form ? (
        <div className="mt-3 space-y-3 rounded-md border border-brand/40 bg-brand-tint/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Name</span>
              <input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Surname</span>
              <input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Email</span>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Phone</span>
              <PhoneField
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={labelClass}>Position</span>
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                placeholder="e.g. Office manager"
                className={inputClass}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setForm(null)} className={btnGhost}>
              Cancel
            </button>
            <button type="button" onClick={submit} className={btnPrimary}>
              Save contact
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
