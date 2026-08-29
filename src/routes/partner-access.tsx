import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PARTNER_LABEL, type PartnerType } from "@/lib/auth";
import { StateMultiSelect } from "@/components/form/StateCombobox";
import { AddressFields } from "@/components/form/AddressFields";

import { DateInput } from "@/components/form/DateInput";
import { LanguageMultiSelect } from "@/components/form/LanguageMultiSelect";
import { US_STATE_CODES } from "@/data/us-states";
import { usePartnerRequests } from "@/lib/partner-requests";
import { notify } from "@/lib/notifications";
import { logActivity } from "@/lib/activity";
import { supabase } from "@/integrations/supabase/client";

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

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-t border-border pt-5">
      <span className="flex size-6 items-center justify-center rounded-full bg-brand text-xs font-bold text-background">
        {n}
      </span>
      <h2 className="text-sm font-semibold text-foreground">{children}</h2>
    </div>
  );
}

/** Per-state realtor licence — we only track the number and validity, not the issue date. */
type LicenseForm = { number: string; validUntil: string };

function PartnerAccessPage() {
  const [kind, setKind] = useState<"partner" | "corporate">("partner");
  const [partnerType, setPartnerType] = useState<PartnerType>("realtor");

  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("US");
  const [companyLicence, setCompanyLicence] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [position, setPosition] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  /** Secure password rules — same standard as client registration. */
  function passwordIssues(pw: string): string[] {
    const issues: string[] = [];
    if (pw.length < 8) issues.push("At least 8 characters");
    if (!/[a-z]/.test(pw)) issues.push("One lowercase letter");
    if (!/[A-Z]/.test(pw)) issues.push("One uppercase letter");
    if (!/\d/.test(pw)) issues.push("One number");
    if (!/[^A-Za-z0-9]/.test(pw)) issues.push("One special character (!@#$…)");
    return issues;
  }

  const [licenceNumber, setLicenceNumber] = useState("");
  const [allStates, setAllStates] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [licenses, setLicenses] = useState<Record<string, LicenseForm>>({});
  const [languages, setLanguages] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const { submit } = usePartnerRequests();

  const isRealtor = kind === "partner" && partnerType === "realtor";

  function toggleAllStates() {
    setAllStates((v) => {
      const next = !v;
      setStates(next ? [...US_STATE_CODES] : []);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return setError("Company name is required.");
    if (!companyType.trim()) return setError("Company type is required.");
    if (!registrationNumber.trim()) return setError("Registration number is required.");
    if (!street.trim() || !city.trim() || !zip.trim() || !country.trim())
      return setError("Full legal address (street, city, ZIP, country) is required.");
    if (country === "US" && !addressState.trim())
      return setError("Please select the state of your legal address.");
    if (isRealtor) {
      if (!companyLicence.trim())
        return setError("The company (brokerage) realtor licence number is required.");
      if (!companyPhone.trim()) return setError("The company phone number is required.");
    }
    if (!firstName.trim() || !lastName.trim())
      return setError("First name and last name are required.");
    if (!position.trim()) return setError("Position is required.");
    if (!email.trim()) return setError("Personal e-mail is required.");
    if (!phone.trim()) return setError("Personal phone number is required.");
    const pwIssues = passwordIssues(password);
    if (pwIssues.length > 0)
      return setError(`Your password needs: ${pwIssues.join(", ").toLowerCase()}.`);
    if (kind === "partner") {
      if (partnerType === "lender" && !licenceNumber.trim())
        return setError("Licence number is required for mortgage lenders.");
      if (states.length === 0)
        return setError(
          isRealtor
            ? "Realtor licenses are issued per state — select the states you are licensed in, or choose all states."
            : "Select the states you are active in, or choose all states.",
        );
      if (isRealtor) {
        for (const s of states) {
          const lic = licenses[s];
          if (!lic?.number.trim() || !lic.validUntil)
            return setError(`Enter the license number and its validity for ${s}.`);
        }
        if (languages.length === 0)
          return setError("Select at least one language you work in.");
      }
    }
    setError(null);
    // Create the login account up front — partners sign in with this e-mail
    // and password immediately, even while their access is pending approval.
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (signUpError && !/already registered/i.test(signUpError.message))
      return setError(signUpError.message);
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
      allStates,
      states,
      ...(kind === "partner" && partnerType === "lender"
        ? { lenderLicence: licenceNumber.trim() }
        : {}),
      ...(isRealtor
        ? {
            companyLicence: companyLicence.trim(),
            companyPhone: companyPhone.trim(),
            realtorLicenses: states.map((s) => ({ state: s, ...licenses[s]! })),
            languages,
          }
        : {}),
    });
    logActivity(
      `${firstName.trim()} ${lastName.trim()}`,
      kind === "partner" ? "requested partner registration" : "requested corporate access",
      companyName.trim(),
    );
    notify({
      id: `welcome-${email.trim().toLowerCase()}`,
      to: email.trim().toLowerCase(),
      title: "Thank you for your interest in joining Loqal",
      body:
        "Your registration is with our admin team. You can already log in to your portal — it becomes fully functional once approved. To speed up the review, please upload your verification documents (your personal ID and the licences you listed).",
      href: "/profile",
      severity: "info",
      emailCopy: true,
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
            <div className="mt-8 space-y-5">
              <div className="rounded-lg border border-border bg-brand-tint/40 p-6 text-center">
                <div className="text-base font-semibold text-foreground">
                  Thank you, {firstName} — request received
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  We've sent a confirmation to <strong>{email}</strong>. A Loqal admin reviews every
                  registration — you can already log in to your portal, and it becomes fully
                  functional once approved. We'll notify you by e-mail.
                </p>
              </div>
              <div className="rounded-lg border border-gold/40 bg-gold-tint/40 p-5">
                <div className="text-sm font-semibold text-foreground">
                  Speed up your review — verification documents
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  While you wait, upload your verification documents in your portal under My
                  Profile: your personal ID document
                  {isRealtor
                    ? " and copies of the personal real estate licences you listed (not the company licence)."
                    : " and the licences you listed."}
                </p>
                <Link
                  to="/profile"
                  className="mt-3 inline-flex rounded-md bg-brand px-4 py-2 text-xs font-semibold text-background hover:bg-brand-soft"
                >
                  Go to My Profile
                </Link>
              </div>
              <div className="text-center">
                <Link to="/" className="text-sm font-medium text-brand hover:underline">
                  Back to Loqal
                </Link>
              </div>
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

              {kind === "partner" ? (
                <>
                  <SectionTitle n={1}>What type of partner are you?</SectionTitle>
                  <div className="flex flex-wrap gap-2">
                    {PARTNER_TYPES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPartnerType(p)}
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
                </>
              ) : null}

              <SectionTitle n={kind === "partner" ? 2 : 1}>Company information</SectionTitle>
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
                <div className="sm:col-span-2">
                  <Label required>Legal address</Label>
                  <AddressFields
                    value={{ country, state: addressState, city, street, zip }}
                    streetPlaceholder="Street and number — start typing for suggestions"
                    onChange={(patch) => {
                      if (patch.country !== undefined) setCountry(patch.country);
                      if (patch.state !== undefined) setAddressState(patch.state);
                      if (patch.city !== undefined) setCity(patch.city);
                      if (patch.street !== undefined) setStreet(patch.street);
                      if (patch.zip !== undefined) setZip(patch.zip);
                    }}
                  />
                </div>
              </div>

              {isRealtor ? (
                <div className="grid grid-cols-1 gap-4 rounded-lg border border-brand/30 bg-brand-tint/30 p-4 sm:grid-cols-2">
                  <label>
                    <Label required>Company realtor licence number</Label>
                    <input
                      placeholder="Brokerage licence №"
                      value={companyLicence}
                      onChange={(e) => setCompanyLicence(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label>
                    <Label required>Company phone number</Label>
                    <input
                      type="tel"
                      placeholder="+1 555 010 0000"
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              ) : null}

              <SectionTitle n={kind === "partner" ? 3 : 2}>Contact person</SectionTitle>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <label>
                  <Label required>First name</Label>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <Label required>Last name</Label>
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
                  <Label required>Personal e-mail</Label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <label>
                  <Label required>Personal phone number</Label>
                  <input
                    type="tel"
                    placeholder="+1 555 010 0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label>
                  <Label required>Create a password</Label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                  />
                </label>
                <ul className="grid grid-cols-1 content-center gap-1">
                  {[
                    { ok: password.length >= 8, label: "At least 8 characters" },
                    { ok: /[a-z]/.test(password), label: "One lowercase letter" },
                    { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
                    { ok: /\d/.test(password), label: "One number" },
                    {
                      ok: /[^A-Za-z0-9]/.test(password),
                      label: "One special character (!@#$…)",
                    },
                  ].map((r) => (
                    <li
                      key={r.label}
                      className={`flex items-center gap-1.5 text-xs ${
                        r.ok ? "text-emerald-600" : "text-muted-foreground"
                      }`}
                    >
                      <span aria-hidden>{r.ok ? "✓" : "○"}</span>
                      {r.label}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                You will use this e-mail and password to log in to your partner portal while your
                registration is reviewed.
              </p>

              {kind === "partner" ? (
                <>
                  <SectionTitle n={4}>Coverage &amp; licences</SectionTitle>

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
                      {isRealtor
                        ? "States you are licensed in as a real estate agent"
                        : "States you are active in"}
                    </Label>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={toggleAllStates}
                        className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                          allStates
                            ? "border-brand bg-brand text-background"
                            : "border-border text-foreground hover:bg-brand-tint"
                        }`}
                      >
                        All states
                      </button>
                      {states.length > 0 && !allStates ? (
                        <span className="text-xs text-muted-foreground">
                          {states.length} selected
                        </span>
                      ) : null}
                      {allStates ? (
                        <span className="text-xs text-muted-foreground">
                          All {US_STATE_CODES.length} states selected
                        </span>
                      ) : null}
                    </div>
                    {!allStates ? (
                      <StateMultiSelect
                        values={states}
                        onAdd={(c) => setStates((prev) => [...prev, c])}
                        onRemove={(c) => setStates((prev) => prev.filter((x) => x !== c))}
                        placeholder="Add a state — type to search…"
                        emptyLabel="No states selected yet."
                      />
                    ) : null}
                  </div>

                  {isRealtor && states.length > 0 ? (
                    <div className="space-y-3 rounded-lg border border-border bg-brand-tint/30 p-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Real estate license per state
                      </span>
                      <p className="text-[11px] text-muted-foreground">
                        We only need the license number and how long it is valid — we'll remind you
                        30 and 15 days before a licence expires.
                      </p>
                      {states.map((s) => {
                        const lic = licenses[s] ?? { number: "", validUntil: "" };
                        const setLic = (patch: Partial<LicenseForm>) =>
                          setLicenses({ ...licenses, [s]: { ...lic, ...patch } });
                        return (
                          <div
                            key={s}
                            className="grid grid-cols-1 gap-3 sm:grid-cols-[48px_1fr_1fr] sm:items-end"
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

                  {isRealtor ? (
                    <div>
                      <Label required>Languages you work in</Label>
                      <LanguageMultiSelect values={languages} onChange={setLanguages} />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Start typing — matching languages pre-show for one-click selection. Buyers
                        are matched to agents who speak their language.
                      </p>
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
