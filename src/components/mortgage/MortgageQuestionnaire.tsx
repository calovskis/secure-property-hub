import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useAuth,
  type AddressEntry,
  type EmploymentEntry,
  type MortgageProfile,
} from "@/lib/auth";

const uid = () => Math.random().toString(36).slice(2, 9);

const emptyAddress = (): AddressEntry => ({
  id: uid(),
  street: "",
  city: "",
  state: "",
  zip: "",
  from: "",
  to: "",
});

const emptyEmployment = (): EmploymentEntry => ({
  id: uid(),
  employer: "",
  title: "",
  from: "",
  to: "",
  current: false,
});

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : "(optional)"}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function money(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function MortgageQuestionnaire({
  open,
  onOpenChange,
  propertyLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  propertyLabel?: string;
}) {
  const { user, saveMortgageProfile } = useAuth();
  const existing = user?.mortgageProfile;

  const [dob, setDob] = useState(existing?.dateOfBirth ?? "");
  const [ssn, setSsn] = useState(existing?.ssn ?? "");
  const [ssnAccepted, setSsnAccepted] = useState(existing?.ssnTermsAccepted ?? false);
  const [addresses, setAddresses] = useState<AddressEntry[]>(
    existing?.addresses?.length ? existing.addresses : [emptyAddress()],
  );
  const [employment, setEmployment] = useState<EmploymentEntry[]>(
    existing?.employment?.length ? existing.employment : [emptyEmployment()],
  );
  const [monthlyGross, setMonthlyGross] = useState(
    existing?.monthlyGross ? String(existing.monthlyGross) : "",
  );
  const [hasItin, setHasItin] = useState<boolean>(existing?.hasItin ?? false);
  const [itin, setItin] = useState(existing?.itin ?? "");
  const [countryOfResidence, setCountryOfResidence] = useState(existing?.countryOfResidence ?? "");
  const [citizenship, setCitizenship] = useState(existing?.citizenship ?? "");
  const [secondCitizenship, setSecondCitizenship] = useState(existing?.secondCitizenship ?? "");
  const [visaActive, setVisaActive] = useState<boolean>(existing?.usVisaActive ?? false);
  const [visaIssued, setVisaIssued] = useState(existing?.visaIssued ?? "");
  const [visaValidUntil, setVisaValidUntil] = useState(existing?.visaValidUntil ?? "");
  const [propertyUse, setPropertyUse] = useState<"vacation" | "investment" | "">(
    existing?.propertyUse ?? "",
  );
  const [usBankAccount, setUsBankAccount] = useState<boolean>(existing?.usBankAccount ?? false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const showSsn = Boolean(user?.usPerson);
  // Non-US applicants only provide address/employment/income history if they hold an ITIN.
  const showHistory = showSsn || hasItin;
  const monthly = Number(monthlyGross.replace(/[^0-9.]/g, "")) || 0;

  function patchAddress(id: string, patch: Partial<AddressEntry>) {
    setAddresses((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  function patchEmployment(id: string, patch: Partial<EmploymentEntry>) {
    setEmployment((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dob) return setError("Date of birth is required.");
    if (showSsn && ssn && !ssnAccepted)
      return setError("Please confirm you have read the SSN processing terms.");
    if (!showSsn) {
      if (hasItin && !itin.trim()) return setError("Please provide your ITIN number.");
      if (!countryOfResidence.trim()) return setError("Country of residence is required.");
      if (!citizenship.trim()) return setError("Citizenship is required.");
      if (visaActive && (!visaIssued || !visaValidUntil))
        return setError("Please provide the visa issue and expiry dates.");
      if (!propertyUse) return setError("Please tell us how you will use the property.");
    }
    if (showHistory) {
      if (!addresses[0]?.street || !addresses[0]?.city)
        return setError("At least one address in your 2-year history is required.");
      if (!employment[0]?.employer)
        return setError("At least one employer in your 2-year history is required.");
      if (!monthly) return setError("Current monthly gross income is required.");
    }

    const profile: MortgageProfile = {
      dateOfBirth: dob,
      ...(showSsn && ssn ? { ssn } : {}),
      ssnTermsAccepted: ssnAccepted,
      ...(showSsn
        ? {}
        : {
            hasItin,
            ...(hasItin ? { itin: itin.trim() } : {}),
            countryOfResidence: countryOfResidence.trim(),
            citizenship: citizenship.trim(),
            ...(secondCitizenship.trim() ? { secondCitizenship: secondCitizenship.trim() } : {}),
            usVisaActive: visaActive,
            ...(visaActive ? { visaIssued, visaValidUntil } : {}),
            propertyUse: propertyUse as "vacation" | "investment",
            usBankAccount,
          }),
      ...(showHistory
        ? { addresses, employment, monthlyGross: monthly }
        : { addresses: [], employment: [], monthlyGross: 0 }),
      submittedAt: new Date().toISOString(),
    };
    setError(null);
    saveMortgageProfile(profile);
    setDone(true);
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Mortgage pre-qualification</DialogTitle>
          <DialogDescription>
            {propertyLabel
              ? `A few details so a Loqal lending partner can price ${propertyLabel}.`
              : "A few details so a Loqal lending partner can price your financing."}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="rounded-lg border border-success/30 bg-success/10 p-6 text-center">
            <div className="text-3xl">✅</div>
            <div className="mt-2 text-base font-semibold text-foreground">
              Information received
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Your financial insights are now unlocked and a mortgage specialist will follow up.
            </p>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-background hover:bg-brand-soft"
            >
              Back to the property
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Date of birth" required hint="mm/dd/yyyy">
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className={inputClass}
                />
              </Field>

              {showSsn ? (
                <Field label="Social Security Number">
                  <input
                    inputMode="numeric"
                    placeholder="123-45-6789"
                    value={ssn}
                    onChange={(e) => setSsn(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              ) : null}
            </div>

            {showSsn ? (
              <label className="flex items-start gap-2 rounded-md bg-brand-tint/60 p-3 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={ssnAccepted}
                  onChange={(e) => setSsnAccepted(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  By providing my Social Security Number I confirm that I have read and accept the{" "}
                  <Link to="/ssn-terms" className="font-semibold text-brand underline">
                    SSN processing terms
                  </Link>
                  .
                </span>
              </label>
            ) : null}

            {!showSsn ? (
              <section className="space-y-4 rounded-lg border border-border bg-brand-tint/30 p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Non-US resident details <span className="text-destructive">*</span>
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Do you have an ITIN?" required>
                    <div className="flex gap-4 pt-1 text-sm text-foreground">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="hasItin"
                          checked={hasItin}
                          onChange={() => setHasItin(true)}
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="hasItin"
                          checked={!hasItin}
                          onChange={() => {
                            setHasItin(false);
                            setItin("");
                          }}
                        />
                        No
                      </label>
                    </div>
                  </Field>

                  {hasItin ? (
                    <Field label="ITIN number" required>
                      <input
                        inputMode="numeric"
                        placeholder="9XX-XX-XXXX"
                        value={itin}
                        onChange={(e) => setItin(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  ) : null}

                  <Field label="Country of residence" required>
                    <input
                      placeholder="e.g. Latvia"
                      value={countryOfResidence}
                      onChange={(e) => setCountryOfResidence(e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Citizenship" required>
                    <input
                      placeholder="e.g. Latvian"
                      value={citizenship}
                      onChange={(e) => setCitizenship(e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Double citizenship">
                    <input
                      placeholder="Second citizenship, if any"
                      value={secondCitizenship}
                      onChange={(e) => setSecondCitizenship(e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Is your US visa active?" required>
                    <div className="flex gap-4 pt-1 text-sm text-foreground">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="visaActive"
                          checked={visaActive}
                          onChange={() => setVisaActive(true)}
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="visaActive"
                          checked={!visaActive}
                          onChange={() => {
                            setVisaActive(false);
                            setVisaIssued("");
                            setVisaValidUntil("");
                          }}
                        />
                        No
                      </label>
                    </div>
                  </Field>

                  {visaActive ? (
                    <>
                      <Field label="Visa issued on" required>
                        <input
                          type="date"
                          value={visaIssued}
                          onChange={(e) => setVisaIssued(e.target.value)}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Visa valid until" required>
                        <input
                          type="date"
                          value={visaValidUntil}
                          onChange={(e) => setVisaValidUntil(e.target.value)}
                          className={inputClass}
                        />
                      </Field>
                    </>
                  ) : null}

                  <Field label="How will you use the property?" required>
                    <select
                      value={propertyUse}
                      onChange={(e) =>
                        setPropertyUse(e.target.value as "vacation" | "investment" | "")
                      }
                      className={inputClass}
                    >
                      <option value="">Select…</option>
                      <option value="vacation">Vacation home</option>
                      <option value="investment">Investment property</option>
                    </select>
                  </Field>

                  <Field label="Do you have a US bank account?" required>
                    <div className="flex gap-4 pt-1 text-sm text-foreground">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="usBank"
                          checked={usBankAccount}
                          onChange={() => setUsBankAccount(true)}
                        />
                        Yes
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="usBank"
                          checked={!usBankAccount}
                          onChange={() => setUsBankAccount(false)}
                        />
                        No
                      </label>
                    </div>
                  </Field>
                </div>

              </section>
            ) : null}



            {/* ADDRESS HISTORY */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  2 years of address history <span className="text-destructive">*</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setAddresses((p) => [...p, emptyAddress()])}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint"
                >
                  + Add address
                </button>
              </div>
              <div className="space-y-4">
                {addresses.map((a, i) => (
                  <div key={a.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>{i === 0 ? "Current address" : `Previous address ${i}`}</span>
                      {addresses.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setAddresses((p) => p.filter((x) => x.id !== a.id))}
                          className="text-destructive hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        placeholder="Street address"
                        value={a.street}
                        onChange={(e) => patchAddress(a.id, { street: e.target.value })}
                        className={`${inputClass} sm:col-span-2`}
                      />
                      <input
                        placeholder="City"
                        value={a.city}
                        onChange={(e) => patchAddress(a.id, { city: e.target.value })}
                        className={inputClass}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          placeholder="State"
                          value={a.state}
                          onChange={(e) => patchAddress(a.id, { state: e.target.value })}
                          className={inputClass}
                        />
                        <input
                          placeholder="ZIP"
                          value={a.zip}
                          onChange={(e) => patchAddress(a.id, { zip: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <label className="text-[11px] text-muted-foreground">
                        From
                        <input
                          type="month"
                          value={a.from}
                          onChange={(e) => patchAddress(a.id, { from: e.target.value })}
                          className={inputClass}
                        />
                      </label>
                      <label className="text-[11px] text-muted-foreground">
                        To
                        <input
                          type="month"
                          value={a.to}
                          onChange={(e) => patchAddress(a.id, { to: e.target.value })}
                          className={inputClass}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* EMPLOYMENT HISTORY */}
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                  2 years of employment history <span className="text-destructive">*</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setEmployment((p) => [...p, emptyEmployment()])}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand-tint"
                >
                  + Add employer
                </button>
              </div>
              <div className="space-y-4">
                {employment.map((emp, i) => (
                  <div key={emp.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>{i === 0 ? "Current employer" : `Previous employer ${i}`}</span>
                      {employment.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setEmployment((p) => p.filter((x) => x.id !== emp.id))}
                          className="text-destructive hover:underline"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        placeholder="Employer name"
                        value={emp.employer}
                        onChange={(e) => patchEmployment(emp.id, { employer: e.target.value })}
                        className={inputClass}
                      />
                      <input
                        placeholder="Job title"
                        value={emp.title}
                        onChange={(e) => patchEmployment(emp.id, { title: e.target.value })}
                        className={inputClass}
                      />
                      <label className="text-[11px] text-muted-foreground">
                        From
                        <input
                          type="month"
                          value={emp.from}
                          onChange={(e) => patchEmployment(emp.id, { from: e.target.value })}
                          className={inputClass}
                        />
                      </label>
                      <label className="text-[11px] text-muted-foreground">
                        To
                        <input
                          type="month"
                          value={emp.to}
                          disabled={emp.current}
                          onChange={(e) => patchEmployment(emp.id, { to: e.target.value })}
                          className={`${inputClass} disabled:opacity-50`}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
                        <input
                          type="checkbox"
                          checked={emp.current}
                          onChange={(e) => patchEmployment(emp.id, { current: e.target.checked })}
                        />
                        I currently work here
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* INCOME */}
            <section className="rounded-lg border border-border bg-brand-tint/40 p-4">
              <Field label="Monthly gross income — current employer" required>
                <input
                  inputMode="decimal"
                  placeholder="8,500"
                  value={monthlyGross}
                  onChange={(e) => setMonthlyGross(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <div className="mt-3 flex items-center justify-between rounded-md bg-card p-3">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  Annual gross income
                </span>
                <strong className="text-lg font-bold text-brand">{money(monthly * 12)}</strong>
              </div>
            </section>

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-brand-tint"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background hover:bg-brand-soft"
              >
                Submit information
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
