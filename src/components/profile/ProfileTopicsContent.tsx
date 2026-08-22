import { useState } from "react";
import { toast } from "sonner";
import type { MortgageProfile, StoredDocument } from "@/lib/auth";
import { countryLabel } from "@/data/countries";
import { isoToUsDate, formatDate } from "@/lib/dates";
import {
  ASSET_TYPE_LABEL,
  BANK_ACCOUNT_KIND_LABEL,
  MARITAL_LABEL,
  US_STATUS_LABEL,
  UNMARRIED_RELATIONSHIP_LABEL,
  INCOME_TYPE_LABEL,
  totalAssets,
  totalLiabilities,
  totalMonthlyIncome,
  monthlyForIncome,
  isForeignIncome,
  normalizeAssets,
  emptyAsset,
  emptyLiabilities,
  emptyDeclarations,
  emptyMilitary,
  emptyDemographics,
  uid,
  num,
  type AssetEntry,
  type AssetType,
  type MaritalStatus,
  type UsStatus,
  type Dependent,
} from "@/lib/mortgage-form";
import type { AddressEntry, EmploymentEntry } from "@/lib/auth";
import { inputClass, money } from "@/components/mortgage/form-ui";
import { TopicCard, TopicField } from "@/components/profile/TopicCard";
import { TopicEditDialog } from "@/components/profile/TopicEditDialog";
import { DateInput } from "@/components/form/DateInput";
import { CountryCombobox } from "@/components/form/CountryCombobox";
import { DocumentUploadBox } from "@/components/mortgage/DocumentUploadBox";
import { documentExpiryState } from "@/lib/mortgage-form";

type Save = (patch: Partial<MortgageProfile>) => void;

/* ------------------------------------------------------- Personal & household */

type PersonalPatch = {
  dateOfBirth: string;
  maritalStatus: MaritalStatus | "";
  unmarriedHasSpousalEquivalent: boolean;
  dependentsCount: number;
};

export function PersonalTopic({ profile, onSave }: { profile: MortgageProfile; onSave: Save }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const initial: PersonalPatch = {
    dateOfBirth: profile.dateOfBirth ?? "",
    maritalStatus: profile.maritalStatus ?? "",
    unmarriedHasSpousalEquivalent: Boolean(profile.unmarriedAddendum?.hasSpousalEquivalent),
    dependentsCount: profile.dependents?.length ?? 0,
  };

  return (
    <TopicCard
      title="Personal & household"
      summary={`${isoToUsDate(profile.dateOfBirth) || "—"} · ${
        profile.maritalStatus ? MARITAL_LABEL[profile.maritalStatus] : "—"
      } · ${profile.dependents?.length ?? 0} dependent(s)`}
      onEdit={() => setEditOpen(true)}
      defaultOpen={open}
    >
      <TopicField label="Date of birth" value={isoToUsDate(profile.dateOfBirth)} />
      <TopicField
        label="Marital status"
        value={profile.maritalStatus ? MARITAL_LABEL[profile.maritalStatus] : undefined}
      />
      {profile.maritalStatus === "unmarried" && profile.unmarriedAddendum ? (
        <>
          <TopicField
            label="Spousal-equivalent relationship"
            value={profile.unmarriedAddendum.hasSpousalEquivalent ? "Yes" : "No"}
          />
          {profile.unmarriedAddendum.relationship ? (
            <TopicField
              label="Relationship type"
              value={UNMARRIED_RELATIONSHIP_LABEL[profile.unmarriedAddendum.relationship]}
            />
          ) : null}
        </>
      ) : null}
      <TopicField label="Dependents" value={profile.dependents?.length ?? 0} />
      {(profile.dependents ?? []).map((d, i) => (
        <TopicField key={d.id} label={`Dependent ${i + 1} age`} value={d.age} />
      ))}

      <TopicEditDialog<PersonalPatch>
        open={editOpen}
        onOpenChange={setEditOpen}
        title="personal & household details"
        initial={initial}
        labels={{
          dateOfBirth: "Date of birth",
          maritalStatus: "Marital status",
          unmarriedHasSpousalEquivalent: "Spousal-equivalent relationship",
          dependentsCount: "Number of dependents",
        }}
        onSave={(draft) => {
          const dependents: Dependent[] = Array.from({ length: draft.dependentsCount }, (_, i) => ({
            id: profile.dependents?.[i]?.id ?? uid(),
            age: profile.dependents?.[i]?.age ?? "",
          }));
          onSave({
            dateOfBirth: draft.dateOfBirth,
            maritalStatus: (draft.maritalStatus || undefined) as MaritalStatus | undefined,
            unmarriedAddendum:
              draft.maritalStatus === "unmarried"
                ? { ...profile.unmarriedAddendum, hasSpousalEquivalent: draft.unmarriedHasSpousalEquivalent }
                : profile.unmarriedAddendum,
            dependents,
          } as Partial<MortgageProfile>);
          toast.success("Personal & household details updated");
        }}
      >
        {(draft, setDraft) => (
          <>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Date of birth
              </span>
              <DateInput
                value={draft.dateOfBirth}
                onChange={(v) => setDraft({ dateOfBirth: v })}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Marital status
              </span>
              <select
                className={inputClass}
                value={draft.maritalStatus}
                onChange={(e) => setDraft({ maritalStatus: e.target.value as MaritalStatus })}
              >
                <option value="">Select…</option>
                {Object.entries(MARITAL_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {draft.maritalStatus === "unmarried" ? (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draft.unmarriedHasSpousalEquivalent}
                  onChange={(e) => setDraft({ unmarriedHasSpousalEquivalent: e.target.checked })}
                />
                Person with real-property rights similar to a spouse
              </label>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Number of dependents
              </span>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={draft.dependentsCount}
                onChange={(e) => setDraft({ dependentsCount: Math.max(0, Number(e.target.value) || 0) })}
              />
            </label>
          </>
        )}
      </TopicEditDialog>
    </TopicCard>
  );
}

/* --------------------------------------------------- Citizenship & identification */

type CitizenshipPatch = {
  usStatus: UsStatus | "";
  countryOfResidence: string;
  citizenship: string;
  secondCitizenship: string;
  hasItin: boolean;
  itin: string;
  visaIssued: string;
  visaValidUntil: string;
  otherVisaType: string;
};

function maskSsn(ssn?: string) {
  if (!ssn) return undefined;
  const digits = ssn.replace(/\D/g, "");
  if (digits.length < 4) return "••• •• ••••";
  return `••• •• ${digits.slice(-4)}`;
}

export function CitizenshipTopic({
  profile,
  usPerson,
  onSave,
}: {
  profile: MortgageProfile;
  usPerson: boolean;
  onSave: Save;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const status = profile.usStatus ?? profile.visaType;

  const initial: CitizenshipPatch = {
    usStatus: profile.usStatus ?? "",
    countryOfResidence: profile.countryOfResidence ?? "",
    citizenship: profile.citizenship ?? "",
    secondCitizenship: profile.secondCitizenship ?? "",
    hasItin: Boolean(profile.hasItin),
    itin: profile.itin ?? "",
    visaIssued: profile.visaIssued ?? "",
    visaValidUntil: profile.visaValidUntil ?? "",
    otherVisaType: profile.otherVisaType ?? "",
  };

  return (
    <TopicCard
      title="Citizenship & identification"
      summary={`${status ? US_STATUS_LABEL[status] : "—"}${
        profile.countryOfResidence ? ` · ${countryLabel(profile.countryOfResidence)}` : ""
      }`}
      onEdit={() => setEditOpen(true)}
    >
      <TopicField label="US status" value={status ? US_STATUS_LABEL[status] : undefined} />
      {usPerson ? (
        <TopicField label="SSN on file" value={maskSsn(profile.ssn) ?? "Not on file"} />
      ) : (
        <>
          <TopicField
            label="Country of residence"
            value={profile.countryOfResidence ? countryLabel(profile.countryOfResidence) : undefined}
          />
          <TopicField
            label="Citizenship"
            value={profile.citizenship ? countryLabel(profile.citizenship) : undefined}
          />
          {profile.secondCitizenship ? (
            <TopicField label="Second citizenship" value={countryLabel(profile.secondCitizenship)} />
          ) : null}
          <TopicField label="Has ITIN" value={profile.hasItin ? "Yes" : "No"} />
          {profile.hasItin ? <TopicField label="ITIN" value={profile.itin} /> : null}
          {profile.usVisaActive ? (
            <>
              <TopicField
                label="Visa / status type"
                value={profile.visaType ? US_STATUS_LABEL[profile.visaType] : undefined}
              />
              {profile.otherVisaType ? (
                <TopicField label="Visa detail" value={profile.otherVisaType} />
              ) : null}
              <TopicField label="Visa issued" value={isoToUsDate(profile.visaIssued ?? "")} />
              <TopicField label="Visa valid until" value={isoToUsDate(profile.visaValidUntil ?? "")} />
            </>
          ) : null}
        </>
      )}

      <TopicEditDialog<CitizenshipPatch>
        open={editOpen}
        onOpenChange={setEditOpen}
        title="citizenship & identification"
        initial={initial}
        labels={{
          usStatus: "US status",
          countryOfResidence: "Country of residence",
          citizenship: "Citizenship",
          secondCitizenship: "Second citizenship",
          hasItin: "Has ITIN",
          itin: "ITIN",
          visaIssued: "Visa issued",
          visaValidUntil: "Visa valid until",
          otherVisaType: "Visa detail",
        }}
        onSave={(draft) => {
          onSave({
            usStatus: (draft.usStatus || undefined) as UsStatus | undefined,
            countryOfResidence: draft.countryOfResidence || undefined,
            citizenship: draft.citizenship || undefined,
            secondCitizenship: draft.secondCitizenship || undefined,
            hasItin: draft.hasItin,
            itin: draft.itin ?? "",
            visaIssued: draft.visaIssued || undefined,
            visaValidUntil: draft.visaValidUntil || undefined,
            otherVisaType: draft.otherVisaType || undefined,
          });
          toast.success("Citizenship & identification updated");
        }}
      >
        {(draft, setDraft) => (
          <>
            {!usPerson ? (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                    Country of residence
                  </span>
                  <CountryCombobox
                    value={draft.countryOfResidence}
                    onChange={(v) => setDraft({ countryOfResidence: v })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                    Citizenship
                  </span>
                  <CountryCombobox
                    value={draft.citizenship}
                    onChange={(v) => setDraft({ citizenship: v })}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                    Second citizenship (optional)
                  </span>
                  <CountryCombobox
                    value={draft.secondCitizenship}
                    onChange={(v) => setDraft({ secondCitizenship: v })}
                    allowClear
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={draft.hasItin}
                    onChange={(e) => setDraft({ hasItin: e.target.checked })}
                  />
                  Has ITIN
                </label>
                {draft.hasItin ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                      ITIN
                    </span>
                    <input
                      className={inputClass}
                      value={draft.itin}
                      onChange={(e) => setDraft({ itin: e.target.value })}
                    />
                  </label>
                ) : null}
              </>
            ) : null}
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                US status
              </span>
              <select
                className={inputClass}
                value={draft.usStatus}
                onChange={(e) => setDraft({ usStatus: e.target.value as UsStatus })}
              >
                <option value="">Select…</option>
                {Object.entries(US_STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Visa detail (if "Other")
              </span>
              <input
                className={inputClass}
                value={draft.otherVisaType}
                onChange={(e) => setDraft({ otherVisaType: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  Visa issued
                </span>
                <DateInput
                  value={draft.visaIssued}
                  onChange={(v) => setDraft({ visaIssued: v })}
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  Visa valid until
                </span>
                <DateInput
                  value={draft.visaValidUntil}
                  onChange={(v) => setDraft({ visaValidUntil: v })}
                  className={inputClass}
                />
              </label>
            </div>
          </>
        )}
      </TopicEditDialog>
    </TopicCard>
  );
}

/* -------------------------------------------------------------- Address history */

export function AddressTopic({ profile, onSave }: { profile: MortgageProfile; onSave: Save }) {
  const [editOpen, setEditOpen] = useState(false);
  const addresses = profile.addresses ?? [];
  const initial = { addresses };

  return (
    <TopicCard
      title="Address history"
      summary={`${addresses.length} address${addresses.length === 1 ? "" : "es"}`}
      onEdit={() => setEditOpen(true)}
    >
      <ul className="space-y-2">
        {addresses.map((a) => (
          <li key={a.id} className="rounded-md border border-border p-3 text-sm">
            <div className="text-foreground">
              {[a.street, a.city, a.state, a.zip, countryLabel(a.country ?? "")]
                .filter(Boolean)
                .join(", ")}
            </div>
            <div className="text-xs text-muted-foreground">
              {isoToUsDate(a.from) || a.from || "—"} —{" "}
              {a.present ? "Present" : isoToUsDate(a.to) || a.to || "—"}
            </div>
          </li>
        ))}
        {!addresses.length ? <p className="text-sm text-muted-foreground">No addresses on file.</p> : null}
      </ul>

      <TopicEditDialog<{ addresses: AddressEntry[] }>
        open={editOpen}
        onOpenChange={setEditOpen}
        title="address history"
        initial={initial}
        labels={{ addresses: "Addresses" }}
        onSave={(draft) => {
          onSave({ addresses: draft.addresses });
          toast.success("Address history updated");
        }}
      >
        {(draft, setDraft) => (
          <div className="space-y-3">
            {draft.addresses.map((a, i) => (
              <div key={a.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputClass}
                    placeholder="Street"
                    value={a.street}
                    onChange={(e) => {
                      const next = [...draft.addresses];
                      next[i] = { ...a, street: e.target.value };
                      setDraft({ addresses: next });
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="City"
                    value={a.city}
                    onChange={(e) => {
                      const next = [...draft.addresses];
                      next[i] = { ...a, city: e.target.value };
                      setDraft({ addresses: next });
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="State"
                    value={a.state}
                    onChange={(e) => {
                      const next = [...draft.addresses];
                      next[i] = { ...a, state: e.target.value };
                      setDraft({ addresses: next });
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Zip"
                    value={a.zip}
                    onChange={(e) => {
                      const next = [...draft.addresses];
                      next[i] = { ...a, zip: e.target.value };
                      setDraft({ addresses: next });
                    }}
                  />
                </div>
                <CountryCombobox
                  value={a.country ?? ""}
                  onChange={(v) => {
                    const next = [...draft.addresses];
                    next[i] = { ...a, country: v };
                    setDraft({ addresses: next });
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <DateInput
                    value={a.from}
                    onChange={(v) => {
                      const next = [...draft.addresses];
                      next[i] = { ...a, from: v };
                      setDraft({ addresses: next });
                    }}
                    className={inputClass}
                  />
                  <DateInput
                    value={a.to}
                    disabled={Boolean(a.present)}
                    onChange={(v) => {
                      const next = [...draft.addresses];
                      next[i] = { ...a, to: v };
                      setDraft({ addresses: next });
                    }}
                    className={inputClass}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={Boolean(a.present)}
                    onChange={(e) => {
                      const next = [...draft.addresses];
                      next[i] = { ...a, present: e.target.checked };
                      setDraft({ addresses: next });
                    }}
                  />
                  Current address
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold text-destructive"
                  onClick={() => setDraft({ addresses: draft.addresses.filter((x) => x.id !== a.id) })}
                >
                  Remove address
                </button>
              </div>
            ))}
            <button
              type="button"
              className="w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-semibold text-brand hover:bg-brand-tint"
              onClick={() =>
                setDraft({
                  addresses: [
                    ...draft.addresses,
                    { id: uid(), street: "", city: "", state: "", zip: "", country: "US", from: "", to: "", present: false },
                  ],
                })
              }
            >
              + Add address
            </button>
          </div>
        )}
      </TopicEditDialog>
    </TopicCard>
  );
}

/* ------------------------------------------------------------- Income & employment */

export function IncomeTopic({ profile, onSave }: { profile: MortgageProfile; onSave: Save }) {
  const [editOpen, setEditOpen] = useState(false);
  const employment = profile.employment ?? [];
  const incomes = profile.incomes ?? [];
  const initial = { monthlyGross: profile.monthlyGross ?? 0, employment };

  return (
    <TopicCard
      title="Income & employment"
      summary={`${money(profile.monthlyGross ?? 0)}/mo · ${employment.length} employer(s)`}
      onEdit={() => setEditOpen(true)}
    >
      <TopicField label="Monthly gross income" value={money(profile.monthlyGross ?? 0)} />
      {incomes.length ? (
        <TopicField label="Computed monthly income (sources)" value={money(totalMonthlyIncome(incomes))} />
      ) : null}
      <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Work history
      </div>
      <ul className="mt-2 space-y-2">
        {employment.map((e) => (
          <li key={e.id} className="rounded-md border border-border p-3 text-sm">
            <div className="text-foreground">
              {e.employer}
              {e.title ? ` — ${e.title}` : ""}
            </div>
            <div className="text-xs text-muted-foreground">
              {isoToUsDate(e.from) || e.from || "—"} — {e.current ? "Present" : isoToUsDate(e.to) || e.to || "—"}
            </div>
          </li>
        ))}
        {!employment.length ? <p className="text-sm text-muted-foreground">No employment on file.</p> : null}
      </ul>
      {incomes.length ? (
        <>
          <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Income sources
          </div>
          <ul className="mt-2 space-y-2">
            {incomes.map((s) => (
              <li key={s.id} className="rounded-md border border-border p-3 text-sm">
                <div className="text-foreground">
                  {INCOME_TYPE_LABEL[s.type]} — {s.employer || "—"}
                  {isForeignIncome(s) ? " · Foreign" : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  ~{money(monthlyForIncome(s))}/mo
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <TopicEditDialog<{ monthlyGross: number; employment: EmploymentEntry[] }>
        open={editOpen}
        onOpenChange={setEditOpen}
        title="income & employment"
        initial={initial}
        labels={{ monthlyGross: "Monthly gross income", employment: "Employment history" }}
        onSave={(draft) => {
          onSave({ monthlyGross: draft.monthlyGross, employment: draft.employment });
          toast.success("Income & employment updated");
        }}
      >
        {(draft, setDraft) => (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                Monthly gross income
              </span>
              <input
                type="number"
                className={inputClass}
                value={draft.monthlyGross}
                onChange={(e) => setDraft({ monthlyGross: Number(e.target.value) || 0 })}
              />
            </label>
            {draft.employment.map((e, i) => (
              <div key={e.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className={inputClass}
                    placeholder="Employer"
                    value={e.employer}
                    onChange={(ev) => {
                      const next = [...draft.employment];
                      next[i] = { ...e, employer: ev.target.value };
                      setDraft({ employment: next });
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Title"
                    value={e.title}
                    onChange={(ev) => {
                      const next = [...draft.employment];
                      next[i] = { ...e, title: ev.target.value };
                      setDraft({ employment: next });
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <DateInput
                    value={e.from}
                    onChange={(v) => {
                      const next = [...draft.employment];
                      next[i] = { ...e, from: v };
                      setDraft({ employment: next });
                    }}
                    className={inputClass}
                  />
                  <DateInput
                    value={e.to}
                    disabled={e.current}
                    onChange={(v) => {
                      const next = [...draft.employment];
                      next[i] = { ...e, to: v };
                      setDraft({ employment: next });
                    }}
                    className={inputClass}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={e.current}
                    onChange={(ev) => {
                      const next = [...draft.employment];
                      next[i] = { ...e, current: ev.target.checked };
                      setDraft({ employment: next });
                    }}
                  />
                  Current employer
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold text-destructive"
                  onClick={() => setDraft({ employment: draft.employment.filter((x) => x.id !== e.id) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-semibold text-brand hover:bg-brand-tint"
              onClick={() =>
                setDraft({
                  employment: [
                    ...draft.employment,
                    { id: uid(), employer: "", title: "", from: "", to: "", current: true },
                  ],
                })
              }
            >
              + Add employer
            </button>
          </div>
        )}
      </TopicEditDialog>
    </TopicCard>
  );
}

/* ------------------------------------------------------------------------ Assets */

export function AssetsTopic({ profile, onSave }: { profile: MortgageProfile; onSave: Save }) {
  const [editOpen, setEditOpen] = useState(false);
  const assets = normalizeAssets(profile.assets);
  const initial = { entries: assets.entries };

  return (
    <TopicCard
      title="Assets"
      summary={`${assets.entries.length} item(s) · ${money(totalAssets(profile.assets))} total`}
      onEdit={() => setEditOpen(true)}
    >
      <ul className="space-y-2">
        {assets.entries.map((a) => (
          <li key={a.id} className="rounded-md border border-border p-3 text-sm">
            <div className="text-foreground">
              {ASSET_TYPE_LABEL[a.type]}
              {a.kind ? ` — ${BANK_ACCOUNT_KIND_LABEL[a.kind] ?? a.kind}` : ""}
              {a.institution ? ` · ${a.institution}` : ""}
            </div>
            <div className="text-xs text-muted-foreground">
              {money(num(a.value))} {a.currency} · {countryLabel(a.country)}
              {a.address ? ` · ${a.address}` : ""}
            </div>
          </li>
        ))}
        {!assets.entries.length ? <p className="text-sm text-muted-foreground">No assets on file.</p> : null}
      </ul>

      <TopicEditDialog<{ entries: AssetEntry[] }>
        open={editOpen}
        onOpenChange={setEditOpen}
        title="assets"
        initial={initial}
        labels={{ entries: "Assets" }}
        onSave={(draft) => {
          onSave({ assets: { entries: draft.entries } });
          toast.success("Assets updated");
        }}
      >
        {(draft, setDraft) => (
          <div className="space-y-3">
            {draft.entries.map((a, i) => (
              <div key={a.id} className="rounded-md border border-border p-3 space-y-2">
                <select
                  className={inputClass}
                  value={a.type}
                  onChange={(e) => {
                    const next = [...draft.entries];
                    next[i] = { ...a, type: e.target.value as AssetType };
                    setDraft({ entries: next });
                  }}
                >
                  {Object.entries(ASSET_TYPE_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                {a.type === "bank_account" ? (
                  <select
                    className={inputClass}
                    value={a.kind}
                    onChange={(e) => {
                      const next = [...draft.entries];
                      next[i] = { ...a, kind: e.target.value };
                      setDraft({ entries: next });
                    }}
                  >
                    {Object.entries(BANK_ACCOUNT_KIND_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                ) : null}
                {a.type !== "real_estate" ? (
                  <input
                    className={inputClass}
                    placeholder="Institution"
                    value={a.institution}
                    onChange={(e) => {
                      const next = [...draft.entries];
                      next[i] = { ...a, institution: e.target.value };
                      setDraft({ entries: next });
                    }}
                  />
                ) : (
                  <input
                    className={inputClass}
                    placeholder="Property address"
                    value={a.address}
                    onChange={(e) => {
                      const next = [...draft.entries];
                      next[i] = { ...a, address: e.target.value };
                      setDraft({ entries: next });
                    }}
                  />
                )}
                <div className="grid grid-cols-2 gap-2">
                  <CountryCombobox
                    value={a.country}
                    onChange={(v) => {
                      const next = [...draft.entries];
                      next[i] = { ...a, country: v };
                      setDraft({ entries: next });
                    }}
                  />
                  <input
                    className={inputClass}
                    placeholder="Currency"
                    value={a.currency}
                    onChange={(e) => {
                      const next = [...draft.entries];
                      next[i] = { ...a, currency: e.target.value };
                      setDraft({ entries: next });
                    }}
                  />
                </div>
                <input
                  className={inputClass}
                  placeholder="Value"
                  value={a.value}
                  onChange={(e) => {
                    const next = [...draft.entries];
                    next[i] = { ...a, value: e.target.value };
                    setDraft({ entries: next });
                  }}
                />
                {a.type === "other" ? (
                  <input
                    className={inputClass}
                    placeholder="Description"
                    value={a.description}
                    onChange={(e) => {
                      const next = [...draft.entries];
                      next[i] = { ...a, description: e.target.value };
                      setDraft({ entries: next });
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  className="text-xs font-semibold text-destructive"
                  onClick={() => setDraft({ entries: draft.entries.filter((x) => x.id !== a.id) })}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-semibold text-brand hover:bg-brand-tint"
              onClick={() => setDraft({ entries: [...draft.entries, emptyAsset()] })}
            >
              + Add asset
            </button>
          </div>
        )}
      </TopicEditDialog>
    </TopicCard>
  );
}

/* -------------------------------------------------------------------- Liabilities */

export function LiabilitiesTopic({ profile, onSave }: { profile: MortgageProfile; onSave: Save }) {
  const [editOpen, setEditOpen] = useState(false);
  const l = profile.liabilities ?? emptyLiabilities();
  const initial = { ...l };

  return (
    <TopicCard
      title="Liabilities"
      summary={`${money(totalLiabilities(l))} total`}
      onEdit={() => setEditOpen(true)}
    >
      <TopicField label="Property loans" value={money(num(l.propertyLoans))} />
      <TopicField label="Vehicle loans" value={money(num(l.vehicleLoans))} />
      <TopicField label="Credit cards" value={money(num(l.creditCards))} />
      <TopicField label="Student loans" value={money(num(l.studentLoans))} />
      {(l.other ?? []).map((o) => (
        <TopicField key={o.id} label={o.label || "Other"} value={money(num(o.amount))} />
      ))}

      <TopicEditDialog<typeof initial>
        open={editOpen}
        onOpenChange={setEditOpen}
        title="liabilities"
        initial={initial}
        labels={{
          propertyLoans: "Property loans",
          vehicleLoans: "Vehicle loans",
          creditCards: "Credit cards",
          studentLoans: "Student loans",
          other: "Other liabilities",
        }}
        onSave={(draft) => {
          onSave({ liabilities: draft });
          toast.success("Liabilities updated");
        }}
      >
        {(draft, setDraft) => (
          <div className="space-y-3">
            {(["propertyLoans", "vehicleLoans", "creditCards", "studentLoans"] as const).map((key) => (
              <label key={key} className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">
                  {key.replace(/([A-Z])/g, " $1")}
                </span>
                <input
                  className={inputClass}
                  value={draft[key]}
                  onChange={(e) => setDraft({ [key]: e.target.value } as never)}
                />
              </label>
            ))}
            {draft.other.map((o, i) => (
              <div key={o.id} className="flex gap-2">
                <input
                  className={inputClass}
                  placeholder="Label"
                  value={o.label}
                  onChange={(e) => {
                    const next = [...draft.other];
                    next[i] = { ...o, label: e.target.value };
                    setDraft({ other: next });
                  }}
                />
                <input
                  className={inputClass}
                  placeholder="Amount"
                  value={o.amount}
                  onChange={(e) => {
                    const next = [...draft.other];
                    next[i] = { ...o, amount: e.target.value };
                    setDraft({ other: next });
                  }}
                />
                <button
                  type="button"
                  className="text-xs font-semibold text-destructive"
                  onClick={() => setDraft({ other: draft.other.filter((x) => x.id !== o.id) })}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-semibold text-brand hover:bg-brand-tint"
              onClick={() => setDraft({ other: [...draft.other, { id: uid(), label: "", amount: "" }] })}
            >
              + Add other liability
            </button>
          </div>
        )}
      </TopicEditDialog>
    </TopicCard>
  );
}

/* ----------------------------------------------------------- Declarations & military */

const DECLARATION_LABELS: Record<string, string> = {
  primaryResidence: "Will occupy as primary residence",
  ownershipInterestLast3Years: "Owned property in last 3 years",
  familyOrBusinessWithSeller: "Family/business relationship with seller",
  borrowingOtherMoney: "Borrowing other money for this transaction",
  applyingOtherMortgage: "Applying for another mortgage",
  applyingNewCredit: "Applying for new credit before closing",
  priorityLien: "Property subject to a priority lien",
  coSignerOrGuarantor: "Co-signer or guarantor on other debt",
  outstandingJudgments: "Outstanding judgments",
  delinquentFederalDebt: "Delinquent on federal debt",
  partyToLawsuit: "Party to a lawsuit",
  conveyedTitleInLieu: "Conveyed title in lieu of foreclosure",
  preForeclosureOrShortSale: "Completed pre-foreclosure / short sale",
  propertyForeclosed: "Had a property foreclosed",
  bankruptcy: "Filed for bankruptcy",
};

export function DeclarationsTopic({ profile, onSave }: { profile: MortgageProfile; onSave: Save }) {
  const [editOpen, setEditOpen] = useState(false);
  const d = profile.declarations ?? emptyDeclarations();
  const m = profile.military ?? emptyMilitary();
  const initial = { ...d, served: m.served, activeDuty: m.activeDuty };

  const flagged = Object.keys(DECLARATION_LABELS).filter((k) => (d as never)[k]);

  return (
    <TopicCard
      title="Declarations & military"
      summary={`${flagged.length} flagged declaration(s) · Military service: ${m.served ? "Yes" : "No"}`}
      onEdit={() => setEditOpen(true)}
    >
      {Object.entries(DECLARATION_LABELS).map(([k, label]) => (
        <TopicField key={k} label={label} value={(d as never)[k] ? "Yes" : "No"} />
      ))}
      <TopicField label="Served in the military" value={m.served ? "Yes" : "No"} />
      {m.served ? (
        <>
          <TopicField label="Currently on active duty" value={m.activeDuty ? "Yes" : "No"} />
          <TopicField label="Retired or discharged" value={m.retiredOrDischarged ? "Yes" : "No"} />
          <TopicField label="Reserve / National Guard only" value={m.reserveOrNationalGuardOnly ? "Yes" : "No"} />
          <TopicField label="Surviving spouse" value={m.survivingSpouse ? "Yes" : "No"} />
        </>
      ) : null}

      <TopicEditDialog<typeof initial>
        open={editOpen}
        onOpenChange={setEditOpen}
        title="declarations & military service"
        initial={initial}
        labels={{ ...DECLARATION_LABELS, served: "Served in the military", activeDuty: "Active duty" }}
        onSave={(draft) => {
          const { served, activeDuty, ...declPatch } = draft;
          onSave({
            declarations: { ...d, ...declPatch },
            military: { ...m, served, activeDuty },
          });
          toast.success("Declarations & military updated");
        }}
      >
        {(draft, setDraft) => (
          <div className="space-y-2">
            {Object.entries(DECLARATION_LABELS).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={Boolean((draft as never)[k])}
                  onChange={(e) => setDraft({ [k]: e.target.checked } as never)}
                />
                {label}
              </label>
            ))}
            <div className="mt-3 border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={draft.served}
                  onChange={(e) => setDraft({ served: e.target.checked })}
                />
                Served in the military
              </label>
              {draft.served ? (
                <label className="mt-2 flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={draft.activeDuty}
                    onChange={(e) => setDraft({ activeDuty: e.target.checked })}
                  />
                  Currently on active duty
                </label>
              ) : null}
            </div>
          </div>
        )}
      </TopicEditDialog>
    </TopicCard>
  );
}

/* --------------------------------------------------------------------- Demographics */

export function DemographicsTopic({ profile, onSave }: { profile: MortgageProfile; onSave: Save }) {
  const [editOpen, setEditOpen] = useState(false);
  const dem = profile.demographics ?? emptyDemographics();
  const initial = { sex: dem.sex, ethnicityDeclined: dem.ethnicityDeclined, raceDeclined: dem.raceDeclined };

  return (
    <TopicCard
      title="Demographics"
      summary={dem.sex ? `Sex: ${dem.sex}` : "Not provided"}
      onEdit={() => setEditOpen(true)}
    >
      <TopicField label="Ethnicity" value={dem.ethnicityDeclined ? "Declined to answer" : dem.ethnicity.join(", ")} />
      <TopicField label="Race" value={dem.raceDeclined ? "Declined to answer" : dem.race.join(", ")} />
      <TopicField label="Sex" value={dem.sex || undefined} />

      <TopicEditDialog<typeof initial>
        open={editOpen}
        onOpenChange={setEditOpen}
        title="demographics"
        initial={initial}
        labels={{ sex: "Sex", ethnicityDeclined: "Ethnicity declined", raceDeclined: "Race declined" }}
        onSave={(draft) => {
          onSave({ demographics: { ...dem, ...draft } });
          toast.success("Demographics updated");
        }}
      >
        {(draft, setDraft) => (
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-muted-foreground">Sex</span>
              <select
                className={inputClass}
                value={draft.sex}
                onChange={(e) => setDraft({ sex: e.target.value as typeof draft.sex })}
              >
                <option value="">Select…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="declined">Prefer not to say</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={draft.ethnicityDeclined}
                onChange={(e) => setDraft({ ethnicityDeclined: e.target.checked })}
              />
              Decline to answer ethnicity
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={draft.raceDeclined}
                onChange={(e) => setDraft({ raceDeclined: e.target.checked })}
              />
              Decline to answer race
            </label>
          </div>
        )}
      </TopicEditDialog>
    </TopicCard>
  );
}

/* -------------------------------------------------------------------------- Documents */

function DocList({ docs }: { docs?: StoredDocument[] | undefined }) {
  if (!docs?.length) return <p className="text-sm text-muted-foreground">None uploaded.</p>;
  return (
    <ul className="space-y-2">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
          <span className="text-foreground">📎 {d.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{formatDate(d.uploadedAt)}</span>
            {d.url ? (
              <a href={d.url} download={d.name} className="text-xs font-semibold text-brand hover:underline">
                Download
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function DocumentsTopic({ profile, onSave }: { profile: MortgageProfile; onSave: Save }) {
  const expiry = documentExpiryState(profile.visaValidUntil);
  const totalDocs =
    (profile.visaDocuments?.length ?? 0) +
    (profile.idDocuments?.length ?? 0) +
    (profile.bankruptcyDocuments?.length ?? 0);

  return (
    <TopicCard title="Documents" summary={`${totalDocs} document(s) on file`}>
      {expiry === "expired" ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Your visa document has expired (valid until {isoToUsDate(profile.visaValidUntil ?? "")}). Please
          upload a replacement below.
        </div>
      ) : expiry === "expiring" ? (
        <div className="mb-4 rounded-md border border-gold/40 bg-gold-tint/60 p-3 text-sm text-foreground">
          Your visa document expires within 3 days ({isoToUsDate(profile.visaValidUntil ?? "")}). Please
          upload a replacement below.
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Visa documents
          </div>
          <DocList docs={profile.visaDocuments} />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Identification documents
          </div>
          <DocList docs={profile.idDocuments} />
        </div>
        <div>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Bankruptcy documents
          </div>
          <DocList docs={profile.bankruptcyDocuments} />
        </div>

        {expiry ? (
          <DocumentUploadBox
            title="Upload a replacement visa document"
            description="Your current visa document is expired or expiring soon. Upload a new copy to keep your file current."
            confirmLabel="Confirm and attach document"
            onConfirm={(docs) => {
              onSave({
                visaDocuments: [
                  ...(profile.visaDocuments ?? []),
                  ...docs.map((d) => ({ id: d.id, name: d.name, uploadedAt: new Date().toISOString(), url: d.url })),
                ],
              });
              toast.success("Replacement visa document attached");
            }}
          />
        ) : null}
      </div>
    </TopicCard>
  );
}
