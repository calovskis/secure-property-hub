import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PARTNER_LABEL, type PartnerType } from "@/lib/auth";
import { US_STATES } from "@/data/us-states";

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
  const [address, setAddress] = useState("");
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

  function toggleState(s: string) {
    setStates((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return setError("Company name is required.");
    if (!companyType.trim()) return setError("Company type is required.");
    if (!registrationNumber.trim()) return setError("Registration number is required.");
    if (!address.trim()) return setError("Address is required.");
    if (!firstName.trim() || !lastName.trim())
      return setError("Contact name and surname are required.");
    if (!position.trim()) return setError("Position is required.");
    if (!email.trim()) return setError("Contact e-mail is required.");
    if (!phone.trim()) return setError("Phone number is required.");
    if (kind === "partner") {
      if (partnerType === "lender" && !licenceNumber.trim())
        return setError("Licence number is required for mortgage lenders.");
      if (!allStates && states.length === 0)
        return setError("Select the states you are active in, or choose all states.");
    }
    setError(null);
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
                Thank you, {firstName}. Our onboarding team will contact you at {email} within one
                business day.
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
                  <Label required>Address</Label>
                  <input
                    placeholder="Street, city, state, ZIP"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={inputClass}
                  />
                </label>
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
                    <Label required>States you are active in</Label>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
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
                      {!allStates && states.length > 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {states.length} selected
                        </span>
                      ) : null}
                    </div>
                    {!allStates ? (
                      <div className="max-h-56 overflow-y-auto rounded-lg border border-border p-3">
                        <div className="flex flex-wrap gap-2">
                          {US_STATES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => toggleState(s)}
                              className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                                states.includes(s)
                                  ? "border-brand bg-brand-tint text-brand"
                                  : "border-border text-muted-foreground hover:bg-brand-tint/50"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
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
                Prototype — requests are not stored yet.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
