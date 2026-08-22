/**
 * Realtor partner profile: personal information, spoken languages and real
 * estate licenses — all editable by the agent. The assignment engine reads
 * this record, so a valid state license is what routes buyer files here.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fullName, type LoqalUser } from "@/lib/auth";
import { useLeads } from "@/lib/leads";
import { useBuyerProcess } from "@/lib/buyer-process";
import { activeLicenseStates, useRealtors } from "@/lib/realtors";
import { formatDate } from "@/lib/dates";
import { DateInput } from "@/components/form/DateInput";
import { StateCombobox } from "@/components/form/StateCombobox";
import { LanguageMultiSelect } from "@/components/form/LanguageMultiSelect";

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";
const btnPrimary =
  "rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft disabled:opacity-50";
const btnGhost =
  "rounded-md border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-brand-tint";

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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border p-3 text-center">
      <div className="text-lg font-bold text-brand">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

type InfoForm = {
  firstName: string;
  lastName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  languages: string[];
};

type LicenseForm = { state: string; number: string; validUntil: string };
const EMPTY_LICENSE: LicenseForm = { state: "", number: "", validUntil: "" };

export function RealtorProfileCard({ user }: { user: LoqalUser }) {
  const { realtors, ensureSeat, updateRealtor } = useRealtors();
  const { leads } = useLeads();
  const { photos } = useBuyerProcess();
  const me = realtors.find((r) => r.email.toLowerCase() === user.email.toLowerCase());

  useEffect(() => {
    if (!me && user.email) ensureSeat(user.email, user.firstName, user.lastName, user.phone);
  }, [me, user, ensureSeat]);

  const [info, setInfo] = useState<InfoForm | null>(null);
  const [lic, setLic] = useState<LicenseForm | null>(null);
  /** Index of the license being adjusted — null means we're adding a new one. */
  const [licIndex, setLicIndex] = useState<number | null>(null);

  if (!me) return null;

  const mine = leads.filter((l) => l.buyerAgent?.agentId === me.id);
  const delivered = mine.filter((l) => photos[l.id]?.status === "delivered").length;
  const advocated = mine.filter((l) => l.buyerAgent?.representation === "loqal_rep").length;
  const today = new Date().toISOString().slice(0, 10);
  const address = [me.address.street, me.address.city, `${me.address.state} ${me.address.zip}`
    .trim()]
    .filter(Boolean)
    .join(", ");

  function startEditInfo() {
    if (!me) return;
    setInfo({
      firstName: me.firstName,
      lastName: me.lastName,
      phone: me.phone,
      street: me.address.street,
      city: me.address.city,
      state: me.address.state,
      zip: me.address.zip,
      languages: me.languages,
    });
  }

  function saveInfo() {
    if (!me || !info) return;
    if (!info.firstName.trim() || !info.lastName.trim()) return;
    updateRealtor(me.id, {
      firstName: info.firstName.trim(),
      lastName: info.lastName.trim(),
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
    toast.success("Profile information updated.");
  }

  function saveLicense() {
    if (!me || !lic || !lic.state || !lic.number.trim() || !lic.validUntil) return;
    const entry = {
      state: lic.state,
      number: lic.number.trim(),
      ...(lic.issuedAt ? { issuedAt: lic.issuedAt } : {}),
      validUntil: lic.validUntil,
    };
    const licenses =
      licIndex !== null
        ? me.licenses.map((l, i) => (i === licIndex ? entry : l))
        : [...me.licenses, entry];
    updateRealtor(me.id, { licenses });
    setLic(null);
    setLicIndex(null);
    toast.success(licIndex !== null ? "License updated." : "License added.");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">My information</h2>
          {info ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setInfo(null)} className={btnGhost}>
                Cancel
              </button>
              <button
                type="button"
                onClick={saveInfo}
                disabled={!info.firstName.trim() || !info.lastName.trim()}
                className={btnPrimary}
              >
                Save changes
              </button>
            </div>
          ) : (
            <button type="button" onClick={startEditInfo} className={btnGhost}>
              Edit information
            </button>
          )}
        </div>

        {info ? (
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  First name
                </span>
                <input
                  value={info.firstName}
                  onChange={(e) => setInfo({ ...info, firstName: e.target.value })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Last name
                </span>
                <input
                  value={info.lastName}
                  onChange={(e) => setInfo({ ...info, lastName: e.target.value })}
                  className={inputClass}
                />
              </label>
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
            <Row label="Full name" value={fullName(user)} />
            <Row label="Email" value={me.email} />
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

      <section className="rounded-lg border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-foreground">My real estate licenses</h2>
          {lic === null ? (
            <button
              type="button"
              onClick={() => {
                setLic(EMPTY_LICENSE);
                setLicIndex(null);
              }}
              className={btnGhost}
            >
              + Add license
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Buyer files are only assigned in states where you hold a valid license.
        </p>

        {me.licenses.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-4 font-semibold">State</th>
                  <th className="py-2 pr-4 font-semibold">License №</th>
                  <th className="py-2 pr-4 font-semibold">Issued</th>
                  <th className="py-2 pr-4 font-semibold">Valid until</th>
                  <th className="py-2 font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {me.licenses.map((l, i) => (
                  <tr key={`${l.state}-${l.number}-${i}`}>
                    <td className="py-2.5 pr-4 font-semibold text-foreground">{l.state}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{l.number}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{formatDate(l.issuedAt)}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-muted-foreground">{formatDate(l.validUntil)}</span>
                      {l.validUntil < today ? (
                        <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                          Expired
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => {
                          setLic({
                            state: l.state,
                            number: l.number,
                            issuedAt: l.issuedAt ?? "",
                            validUntil: l.validUntil,
                          });
                          setLicIndex(i);
                        }}
                        className="mr-3 text-brand hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          updateRealtor(me.id, {
                            licenses: me.licenses.filter((_, idx) => idx !== i),
                          });
                          if (licIndex === i) {
                            setLic(null);
                            setLicIndex(null);
                          }
                          toast.success("License removed.");
                        }}
                        className="text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : lic === null ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No licenses on file yet. Add your first license to start receiving buyer files.
          </p>
        ) : null}

        {lic !== null ? (
          <div className="mt-4 space-y-4 rounded-md border border-border bg-background p-4">
            <h3 className="text-sm font-semibold text-foreground">
              {licIndex !== null ? "Adjust license" : "New license"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  State
                </span>
                <StateCombobox
                  value={lic.state}
                  onChange={(code) => setLic({ ...lic, state: code })}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  License number
                </span>
                <input
                  value={lic.number}
                  onChange={(e) => setLic({ ...lic, number: e.target.value })}
                  placeholder="e.g. FL-SL-3488210"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Issued (optional)
                </span>
                <DateInput
                  value={lic.issuedAt}
                  onChange={(v) => setLic({ ...lic, issuedAt: v })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Valid until
                </span>
                <DateInput
                  value={lic.validUntil}
                  onChange={(v) => setLic({ ...lic, validUntil: v })}
                  className={inputClass}
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setLic(null);
                  setLicIndex(null);
                }}
                className={btnGhost}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveLicense}
                disabled={!lic.state || !lic.number.trim() || !lic.validUntil}
                className={btnPrimary}
              >
                {licIndex !== null ? "Save license" : "Add license"}
              </button>
            </div>
          </div>
        ) : null}
      </section>

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
