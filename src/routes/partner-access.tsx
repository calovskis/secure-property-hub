import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PARTNER_LABEL, type PartnerType } from "@/lib/auth";
import { StateCombobox, StateMultiSelect } from "@/components/form/StateCombobox";
import { CountryCombobox } from "@/components/form/CountryCombobox";
import { DateInput } from "@/components/form/DateInput";
import { REALTOR_LANGUAGES, type RealtorLicense } from "@/lib/realtors";
import { usePartnerRequests } from "@/lib/partner-requests";

export const Route = createFileRoute("/partner-access")({
  component: PartnerAccessPage,
  head: () => ({
    meta: [
      { title: "Request partner or corporate access — Loqal" },
      {
        name: "description",
        content:
          "Realtors, mortgage lenders, cleaning crews, service providers and companies can request access to the Loqal platform.",
      },
      { property: "og:title", content: "Request partner or corporate access — Loqal" },
      {
        property: "og:description",
        content:
          "Tell us about your company and we will set up your Loqal partner or corporate workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

const PARTNER_TYPES = Object.keys(PARTNER_LABEL) as PartnerType[];

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children} {required ? <span className="text-destructive">*</span> : "(optional)"}
    </span>
  );
}

function PartnerAccessPage() {
  const [kind, setKind] = useState<"partner" | "corporate">("partner");

  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [partnerType, setPartnerType] = useState<PartnerType>("realtor");
  const [licenceNumber, setLicenceNumber] = useState("");
  const [allStates, setAllStates] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { submit } = usePartnerRequests();
  const [licenses, setLicenses] = useState<Record<string, Omit<RealtorLicense, "state">>>({});
  const [languages, setLanguages] = useState<string[]>([]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return setError("Company name is required.");
    if (!companyType.trim()) return setError("Company type is required.");
    if (!registrationNumber.trim()) return setError("Registration number is required.");
    if (!street.trim() || !city.trim() || !zip.trim() || !country.trim())
      return setError("Full address (street, city, ZIP, country) is required.");
    if (country === "US" && !addressState.trim())
      return setError("Please select the state of your address.");
    if (!firstName.trim() || !lastName.trim())
      return setError("Contact name and surname are required.");
    if (!position.trim()) return setError("Position is required.");
    if (!email.trim()) return setError("Contact e-mail is required.");
    if (!phone.trim()) return setError("Phone number is required.");
    if (kind === "partner") {
      if (partnerType === "lender" && !licenceNumber.trim())
        return setError("Licence number is required for mortgage lenders.");
      if (partnerType === "realtor") {
        if (states.length === 0)
          return setError("Realtor licenses are issued per state — select the states you are licensed in.");
        for (const s of states) {
          const lic = licenses[s];
          if (!lic?.number.trim() || !lic.issuedAt || !lic.validUntil)
            return setError(`Enter the license number, issue date and validity for ${s}.`);
        }
        if (languages.length === 0)
          return setError("Select at least one language you work in.");
      } else if (!allStates && states.length === 0) {
        return setError("Select the states you are active in, or choose all states.");
      }
    }
    setError(null);
    submit({
      kind,
      ...(kind === "partner" ? { partnerType } : {}),
      companyName: companyName.trim(),
      companyType: companyType.trim(),
      registrationNumber: registrationNumber.trim(),
      street: street.trim(),
      city: city.trim(),
      state: addressState,
      zip: zip.trim(),
      country,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      position: position.trim(),
      email: email.trim(),
      phone: phone.trim(),
      allStates: partnerType === "realtor" ? false : allStates,
      states,
      ...(kind === "partner" && partnerType === "lender"
        ? { lenderLicence: licenceNumber.trim() }
        : {}),
      ...(kind === "partner" && partnerType === "realtor"
        ? {
            realtorLicenses: states.map((s) => ({ state: s, ...licenses[s]! })),
            languages,
          }
        : {}),
    });
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-tint via-background to-gold-tint px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-brand">
          ← Back to Loqal
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
          <h1 className="text-xl font-bold text-foreground">
            Request partner or corporate access
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Companies and service providers are onboarded by our team. Tell us about your business
            and we will come back with next steps.
          </p>

          {sent ? (
            <div className="mt-8 rounded-lg border border-border bg-brand-tint/40 p-6 text-center">
              <div className="text-base font-semibold text-foreground">Request received</div>
              <p className="mt-2 text-sm text-muted-foreground">
                Thank you, {firstName}. A Loqal admin reviews every registration — once approved,
                you can log in to your partner workspace. We will notify you at {email}.
              </p>
              <Link
                to="/"
                className="mt-6 inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-background"
              >
                Back to Loqal
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-6 space-y-5">
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-brand-tint p-1">
                {(["partner", "corporate"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setKind(k);
                      setError(null);
                    }}
                    className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                      kind === k ? "bg-card text-brand shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {k === "partner" ? "Partner access" : "Corporate access"}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label>
                  <Label required>Company name</Label>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <Label required>Company type</Label>
                  <input
                    placeholder="LLC, Inc., LP…"
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <Label required>Registration number</Label>
                  <input
                    value={registrationNumber}
                    onChange={(e) => setRegistrationNumber(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <Label required>Street address</Label>
                  <input
                    placeholder="Street and number"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <Label required>City</Label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <div>
                  <Label required>State</Label>
                  <StateCombobox value={addressState} onChange={setAddressState} />
                </div>
                <label>
                  <Label required>ZIP code</Label>
                  <input value={zip} onChange={(e) => setZip(e.target.value)} className={inputClass} />
                </label>
                <div>
                  <Label required>Country</Label>
                  <CountryCombobox value={country} onChange={setCountry} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label>
                  <Label required>Name</Label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <Label required>Surname</Label>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <Label required>Position</Label>
                  <input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label>
                  <Label required>Contact e-mail</Label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <Label required>Phone number</Label>
                  <input
                    type="tel"
                    placeholder="+1 555 010 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>

              {kind === "partner" ? (
                <>
                  <div>
                    <Label required>Partner type</Label>
                    <div className="flex flex-wrap gap-2">
                      {PARTNER_TYPES.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => {
                            setPartnerType(p);
                            if (p === "realtor") setAllStates(false);
                          }}
                          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                            partnerType === p
                              ? "border-brand bg-brand text-background"
                              : "border-border text-foreground hover:bg-brand-tint"
                          }`}
                        >
                          {PARTNER_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {partnerType === "lender" ? (
                    <label className="block">
                      <Label required>Licence number</Label>
                      <input
                        placeholder="NMLS or state licence number"
                        value={licenceNumber}
                        onChange={(e) => setLicenceNumber(e.target.value)}
                        className={inputClass}
                      />
                    </label>
                  ) : null}

                  <div>
                    <Label required>
                      {partnerType === "realtor"
                        ? "States you are licensed in as a real estate agent"
                        : "States you are active in"}
                    </Label>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      {partnerType !== "realtor" ? (
                        <button
                          type="button"
                          onClick={() => {
                            setAllStates((v) => !v);
                            setStates([]);
                          }}
                          className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                            allStates
                              ? "border-brand bg-brand text-background"
                              : "border-border text-foreground hover:bg-brand-tint"
                          }`}
                        >
                          All states
                        </button>
                      ) : null}
                      {(partnerType === "realtor" || !allStates) && states.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {states.length} selected
                        </span>
                      ) : null}
                    </div>
                    {partnerType === "realtor" || !allStates ? (
                      <StateMultiSelect
                        values={states}
                        onAdd={(c) => setStates((prev) => [...prev, c])}
                        onRemove={(c) => setStates((prev) => prev.filter((x) => x !== c))}
                        placeholder="Add a state — type to search…"
                        emptyLabel="No states selected yet."
                      />
                    ) : null}
                  </div>

                  {partnerType === "realtor" && states.length > 0 ? (
                    <div className="space-y-3 rounded-lg border border-border bg-brand-tint/30 p-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Real estate license per state
                      </span>
                      {states.map((s) => {
                        const lic = licenses[s] ?? { number: "", issuedAt: "", validUntil: "" };
                        const setLic = (patch: Partial<Omit<RealtorLicense, "state">>) =>
                          setLicenses({ ...licenses, [s]: { ...lic, ...patch } });
                        return (
                          <div
                            key={s}
                            className="grid grid-cols-1 gap-3 sm:grid-cols-[48px_1fr_1fr_1fr] sm:items-end"
                          >
                            <span className="pt-2 text-sm font-semibold text-foreground">{s}</span>
                            <label>
                              <Label required>License №</Label>
                              <input
                                value={lic.number}
                                onChange={(e) => setLic({ number: e.target.value })}
                                className={inputClass}
                              />
                            </label>
                            <label>
                              <Label required>Issued</Label>
                              <DateInput
                                value={lic.issuedAt}
                                onChange={(v) => setLic({ issuedAt: v })}
                                className={inputClass}
                              />
                            </label>
                            <label>
                              <Label required>Valid until</Label>
                              <DateInput
                                value={lic.validUntil}
                                onChange={(v) => setLic({ validUntil: v })}
                                className={inputClass}
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {partnerType === "realtor" ? (
                    <div>
                      <Label required>Languages you work in</Label>
                      <div className="flex flex-wrap gap-2">
                        {REALTOR_LANGUAGES.map((l) => (
                          <button
                            key={l}
                            type="button"
                            onClick={() =>
                              setLanguages(
                                languages.includes(l)
                                  ? languages.filter((x) => x !== l)
                                  : [...languages, l],
                              )
                            }
                            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                              languages.includes(l)
                                ? "border-brand bg-brand text-background"
                                : "border-border text-foreground hover:bg-brand-tint"
                            }`}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : null}

              {error ? (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="w-full rounded-md bg-brand py-3 text-sm font-semibold text-background transition-colors hover:bg-brand-soft"
              >
                Submit request
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                Your request goes to the Loqal admin team — access opens once it is approved.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
