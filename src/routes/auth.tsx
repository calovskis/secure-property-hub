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
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in or become a Loqal — Loqal" },
      {
        name: "description",
        content:
          "Log in to your Loqal account or create your client profile to manage properties, services and payments in one place.",
      },
      { property: "og:title", content: "Sign in or become a Loqal" },
      {
        property: "og:description",
        content:
          "Access the Loqal concierge platform for real estate investors and property owners.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-brand";

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children} {required ? <span className="text-destructive">*</span> : "(optional)"}
    </span>
  );
}

/** Prototype-only: lets internal staff and onboarded partners land on their workspace. */
const INTERNAL_ROLES: { value: Role; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "corporate", label: "Corporate" },
  { value: "partner", label: "Partner" },
  { value: "admin", label: "Admin" },
];

function AuthPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [usPerson, setUsPerson] = useState<boolean | null>(null);
  const [showInternal, setShowInternal] = useState(false);
  const [loginRole, setLoginRole] = useState<Role>("client");
  const [loginPartnerType, setLoginPartnerType] = useState<PartnerType>("lender");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function complete(user: LoqalUser) {
    signIn(user);
    navigate({ to: homeRouteFor(user.role) });
  }

  /**
   * Backs the profile with a real Loqal Cloud account. Calendar and Meet
   * bookings are stored per account, so a backend session is required.
   */
  /** Secure password rules applied at registration only. */
  function passwordIssues(pw: string): string[] {
    const issues: string[] = [];
    if (pw.length < 8) issues.push("At least 8 characters");
    if (!/[a-z]/.test(pw)) issues.push("One lowercase letter");
    if (!/[A-Z]/.test(pw)) issues.push("One uppercase letter");
    if (!/\d/.test(pw)) issues.push("One number");
    if (!/[^A-Za-z0-9]/.test(pw)) issues.push("One special character (!@#$…)");
    return issues;
  }

  /** Sends a password-reset link to the e-mail typed in the form. */
  async function onForgotPassword() {
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError("Enter your e-mail first, then tap “Forgot your password?”.");
    setBusy(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) return setError(resetError.message);
    setNotice(
      "If an account exists for that e-mail, a password-reset link is on its way. The link opens a page where you set a new password.",
    );
  }

  async function ensureBackendSession(kind: "login" | "register") {
    if (kind === "register") {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      const alreadyRegistered =
        signUpError &&
        ((signUpError as { code?: string }).code === "user_already_exists" ||
          /already registered|already been registered|already exists/i.test(signUpError.message));
      if (signUpError && !alreadyRegistered) throw signUpError;
      if (alreadyRegistered) {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError)
          throw new Error(
            "An account already exists for this e-mail. Switch to “Log in” and use your existing password.",
          );
        return;
      }
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      if (/invalid login credentials/i.test(signInError.message)) {
        throw new Error("Invalid e-mail or password.");
      }
      throw signInError;
    }
  }


  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return setError("Enter the e-mail you registered with.");
    if (!password) return setError("Enter your password.");
    setError(null);
    setBusy(true);
    try {
      await ensureBackendSession("login");
    } catch (err) {
      setBusy(false);
      return setError(
        err instanceof Error ? err.message : "We could not sign you in. Please try again.",
      );
    }
    setBusy(false);
    complete({
      firstName: (() => {
        const raw = email.split("@")[0]?.replace(/[^a-zA-Z]/g, "") || "Loqal";
        return raw.charAt(0).toUpperCase() + raw.slice(1);
      })(),
      lastName: "",
      email,
      phone: "",
      usPerson: false,
      role: loginRole,
      ...(loginRole === "partner"
        ? {
            partnerType: loginPartnerType,
            companyName:
              loginPartnerType === "lender" ? "Demo Mortgage Partners" : "Demo Partner Co.",
            ...(loginPartnerType === "lender" ? { lenderLicence: "NMLS-2481907" } : {}),
          }
        : {}),
    });
  }

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName || !lastName) return setError("First name and last name are required.");
    if (!email) return setError("E-mail is required.");
    const pwIssues = passwordIssues(password);
    if (pwIssues.length > 0)
      return setError(`Your password needs: ${pwIssues.join(", ").toLowerCase()}.`);
    if (!phone) return setError("Phone number is required.");
    if (usPerson === null)
      return setError("Please tell us whether you are a US citizen or green card holder.");
    setError(null);
    setBusy(true);
    try {
      await ensureBackendSession("register");
    } catch (err) {
      setBusy(false);
      return setError(
        err instanceof Error ? err.message : "We could not create your account. Please try again.",
      );
    }
    setBusy(false);
    complete({
      firstName,
      lastName,
      email,
      phone,
      usPerson,
      role: "client",
      ...(middleName ? { middleName } : {}),
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

          <form onSubmit={mode === "login" ? (e) => void onLogin(e) : (e) => void onRegister(e)} className="space-y-4">
            {mode === "register" ? (
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
                  <Label>Middle name</Label>
                  <input
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
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
              ) : null}
              <label>
                <Label required>Password</Label>
                <input
                  type="password"
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </label>

              {mode === "login" ? (
                <button
                  type="button"
                  onClick={() => void onForgotPassword()}
                  className="self-start text-xs font-semibold text-brand underline-offset-2 hover:underline"
                >
                  Forgot your password?
                </button>
              ) : null}
            </div>

            {mode === "register" ? (
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {[
                  { ok: password.length >= 8, label: "At least 8 characters" },
                  { ok: /[a-z]/.test(password), label: "One lowercase letter" },
                  { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
                  { ok: /\d/.test(password), label: "One number" },
                  { ok: /[^A-Za-z0-9]/.test(password), label: "One special character (!@#$…)" },
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
            ) : null}

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

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {notice ? (
              <p className="rounded-md bg-brand-tint px-3 py-2 text-sm text-brand">{notice}</p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand py-3 text-sm font-semibold text-background transition-colors hover:bg-brand-soft disabled:opacity-60"
            >
              {busy
                ? "Please wait…"
                : mode === "login"
                  ? "Log in"
                  : "Create my Loqal profile"}
            </button>
          </form>

          {mode === "register" ? (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Registering a company or a service business?{" "}
              <Link to="/partner-access" className="font-semibold text-brand">
                Request partner or corporate access
              </Link>
            </p>
          ) : (
            <div className="mt-6 border-t border-border pt-4 text-center">
              <button
                type="button"
                onClick={() => setShowInternal((v) => !v)}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
              >
                Partner or internal sign-in
              </button>
              {showInternal ? (
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {INTERNAL_ROLES.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setLoginRole(r.value)}
                      className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                        loginRole === r.value
                          ? "border-brand bg-brand text-background"
                          : "border-border text-foreground hover:bg-brand-tint"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              ) : null}
              {showInternal && loginRole === "partner" ? (
                <div className="mt-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Partner type
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {(Object.keys(PARTNER_LABEL) as PartnerType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setLoginPartnerType(t)}
                        className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${
                          loginPartnerType === t
                            ? "border-gold bg-gold text-primary-foreground"
                            : "border-border text-foreground hover:bg-gold-tint"
                        }`}
                      >
                        {PARTNER_LABEL[t]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Your account is secured by Loqal Cloud — a real account is required to connect Google
            Calendar and Google Meet.
          </p>

        </div>
      </div>
    </div>
  );
}
