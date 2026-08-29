/**
 * Realtor partner profile. Name, surname, email and company live in the
 * account card at the top of My Profile (a change there needs Loqal approval),
 * so this card holds what the agent may edit freely — contact details, address
 * and spoken languages — plus the full registration record and work stats.
 * Licences and their copies live in the identity & licence verification card.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { type LoqalUser } from "@/lib/auth";
import { useLeads } from "@/lib/leads";
import { useBuyerProcess } from "@/lib/buyer-process";
import { activeLicenseStates, useRealtors } from "@/lib/realtors";
import { usePartnerRequests } from "@/lib/partner-requests";
import { formatDate, formatDateTime } from "@/lib/dates";
import { StateCombobox } from "@/components/form/StateCombobox";
import { LanguageMultiSelect } from "@/components/form/LanguageMultiSelect";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
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
  street: string;
  city: string;
  state: string;
  zip: string;
  languages: string[];
};

export function RealtorProfileCard({ user }: { user: LoqalUser }) {
  const { realtors, ensureSeat, updateRealtor } = useRealtors();
  const { requests } = usePartnerRequests();
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
  const address = [me.address.street, me.address.city, `${me.address.state} ${me.address.zip}`.trim()]
    .filter(Boolean)
    .join(", ");

  function startEdit() {
    if (!me) return;
    setInfo({
      phone: me.phone,
      street: me.address.street,
      city: me.address.city,
      state: me.address.state,
      zip: me.address.zip,
      languages: me.languages,
    });
  }

  function save() {
    if (!me || !info) return;
    updateRealtor(me.id, {
      phone: info.phone.trim(),
      languages: info.languages,
      address: {
        street: info.street.trim(),
        city: info.city.trim(),
        state: info.state,
        zip: info.zip.trim(),
        country: me.address.country || "US",
      },
    });
    setInfo(null);
    toast.success("Contact details updated.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">Contact details</h2>
          {info ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setInfo(null)} className={btnGhost}>
                Cancel
              </button>
              <button type="button" onClick={save} className={btnPrimary}>
                Save changes
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEdit} className={btnGhost}>
              Edit contact details
            </button>
          )}
        </div>

        {info ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Phone
                </span>
                <input
                  value={info.phone}
                  onChange={(e) => setInfo({ ...info, phone: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Street
                </span>
                <input
                  value={info.street}
                  onChange={(e) => setInfo({ ...info, street: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  City
                </span>
                <input
                  value={info.city}
                  onChange={(e) => setInfo({ ...info, city: e.target.value })}
                  className={inputClass}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    State
                  </span>
                  <StateCombobox
                    value={info.state}
                    onChange={(code) => setInfo({ ...info, state: code })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    ZIP
                  </span>
                  <input
                    value={info.zip}
                    onChange={(e) => setInfo({ ...info, zip: e.target.value })}
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Languages I speak
              </span>
              <LanguageMultiSelect
                values={info.languages}
                onChange={(languages) => setInfo({ ...info, languages })}
              />
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Buyers are matched to agents who speak their language — keep this up to date.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3">
            <Row label="Phone" value={me.phone} />
            <Row label="Address" value={address} />
            <div className="flex items-baseline justify-between gap-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Languages
              </span>
              <span className="flex flex-wrap justify-end gap-1.5">
                {me.languages.length ? (
                  me.languages.map((l) => (
                    <span
                      key={l}
                      className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold text-brand"
                    >
                      {l}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-foreground">—</span>
                )}
              </span>
            </div>
          </div>
        )}
      </section>

      {registration ? (
        <section className="rounded-lg border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Registration information</h2>
            <span className="rounded-full bg-brand-tint px-3 py-1 text-[11px] font-semibold text-brand">
              Submitted {formatDate(registration.submittedAt)}
            </span>
          </div>

          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand">Brokerage</h3>
          <div className="mt-1">
            <Row label="Company" value={registration.companyName} />
            <Row label="Legal form" value={registration.companyType} />
            <Row label="Registration №" value={registration.registrationNumber} />
            <Row label="Company licence" value={registration.companyLicence} />
            <Row label="Company phone" value={registration.companyPhone} />
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand">
            Business address
          </h3>
          <div className="mt-1">
            <Row label="Street" value={registration.street} />
            <Row label="City" value={registration.city} />
            <Row label="State / ZIP" value={`${registration.state} ${registration.zip}`.trim()} />
            <Row label="Country" value={registration.country} />
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand">
            Contact person
          </h3>
          <div className="mt-1">
            <Row
              label="Name"
              value={`${registration.firstName} ${registration.lastName}`.trim()}
            />
            <Row label="Position" value={registration.position} />
            <Row label="Email" value={registration.email} />
            <Row label="Phone" value={registration.phone} />
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand">
            Coverage &amp; licences
          </h3>
          <div className="mt-1">
            <Row
              label="States served"
              value={registration.allStates ? "All states" : registration.states.join(", ")}
            />
            <Row
              label="Personal licences"
              value={(registration.realtorLicenses ?? [])
                .map((l) => `${l.state} · ${l.number} · valid till ${formatDate(l.validUntil)}`)
                .join(" | ")}
            />
            <Row label="Languages declared" value={(registration.languages ?? []).join(", ")} />
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand">
            Agreements
          </h3>
          <div className="mt-1">
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
          </div>
        </section>
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
