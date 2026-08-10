import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  PARTNER_LABEL,
  homeRouteFor,
  useAuth,
  type LoqalUser,
  type PartnerType,
  type Role,
} from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in or become a Loqal — Loqal" },
      {
        name: "description",
        content:
          "Log in to your Loqal account or create a profile as a client, corporate owner, partner or administrator.",
      },
      { property: "og:title", content: "Sign in or become a Loqal" },
      {
        property: "og:description",
        content:
          "Access the Loqal concierge platform for real estate investors, corporates, partners and administrators.",
      },
    ],
  }),
});

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

const ROLES: { value: Role; label: string; desc: string }[] = [
  { value: "client", label: "Client", desc: "Individual property owner or investor" },
  { value: "corporate", label: "Corporate", desc: "Company-owned portfolio" },
  { value: "partner", label: "Partner", desc: "Realtor, lender or service provider" },
  { value: "admin", label: "Admin", desc: "Loqal employee access" },
];

const PARTNER_TYPES = Object.keys(PARTNER_LABEL) as PartnerType[];

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children} {required ? <span className="text-destructive">*</span> : "(optional)"}
    </span>
  );
}

function AuthPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [usPerson, setUsPerson] = useState<boolean | null>(null);
  const [role, setRole] = useState<Role>("client");
  const [partnerType, setPartnerType] = useState<PartnerType>("realtor");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function complete(user: LoqalUser) {
    signIn(user);
    navigate({ to: homeRouteFor(user.role) });
  }

  function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return setError("Enter the e-mail you registered with.");
    setError(null);
    complete({
      firstName: email.split("@")[0]?.replace(/[^a-zA-Z]/g, "") || "Loqal",
      lastName: "Member",
      email,
      phone: "",
      usPerson: usPerson ?? false,
      role,
      ...(role === "partner" ? { partnerType } : {}),
    });
  }

  function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) return setError("Name and surname are required.");
    if (!email) return setError("E-mail is required.");
    if (!phone) return setError("Phone number is required.");
    if (usPerson === null)
      return setError("Please tell us whether you are a US citizen or green card holder.");
    if (role === "corporate" && !companyName) return setError("Company name is required.");
    setError(null);
    complete({
      firstName,
      lastName,
      email,
      phone,
      usPerson,
      role,
      ...(middleName ? { middleName } : {}),
      ...(role === "partner" ? { partnerType } : {}),
      ...(role === "corporate" ? { companyName } : {}),
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-tint via-background to-gold-tint px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-brand">
          ← Back to Loqal
        </Link>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-md bg-gradient-to-br from-gold to-gold/70 text-sm font-bold text-primary-foreground">
              LQ
            </span>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {mode === "login" ? "Log in to Loqal" : "Become a Loqal"}
              </h1>
              <p className="text-xs text-muted-foreground">
                One operating layer for property ownership.
              </p>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-brand-tint p-1">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                  mode === m ? "bg-card text-brand shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "login" ? "Log in" : "Create a profile"}
              </button>
            ))}
          </div>

          <form onSubmit={mode === "login" ? onLogin : onRegister} className="space-y-4">
            {mode === "register" ? (
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
                  <Label>Middle name</Label>
                  <input
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
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
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label>
                <Label required>E-mail</Label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </label>
              {mode === "register" ? (
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
              ) : (
                <label>
                  <Label required>Password</Label>
                  <input type="password" placeholder="••••••••" className={inputClass} />
                </label>
              )}
            </div>

            {mode === "register" ? (
              <div>
                <Label required>US citizen or green card holder?</Label>
                <div className="flex gap-2">
                  {[
                    { v: true, l: "Yes" },
                    { v: false, l: "No" },
                  ].map((o) => (
                    <button
                      key={o.l}
                      type="button"
                      onClick={() => setUsPerson(o.v)}
                      className={`rounded-md border px-5 py-2 text-sm font-semibold transition-colors ${
                        usPerson === o.v
                          ? "border-brand bg-brand text-background"
                          : "border-border bg-card text-foreground hover:bg-brand-tint"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <Label required>Access type</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      role === r.value
                        ? "border-brand bg-brand-tint"
                        : "border-border hover:bg-brand-tint/50"
                    }`}
                  >
                    <div className="text-sm font-semibold text-foreground">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground">{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {role === "partner" ? (
              <div>
                <Label required>Partner category</Label>
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
            ) : null}

            {role === "corporate" && mode === "register" ? (
              <label className="block">
                <Label required>Company name</Label>
                <input
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputClass}
                />
              </label>
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
              {mode === "login" ? "Log in" : "Create my Loqal profile"}
            </button>
            <p className="text-center text-[11px] text-muted-foreground">
              Prototype access — accounts are stored locally on this device only.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
