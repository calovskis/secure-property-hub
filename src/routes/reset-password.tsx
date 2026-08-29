/**
 * Password reset landing page. The recovery link e-mailed by
 * `resetPasswordForEmail` opens here with a recovery session in the URL —
 * the user sets a new password and is then sent to the sign-in page.
 * Public route: it must be reachable without being signed in.
 */
import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Set a new password | Loqal" },
      {
        name: "description",
        content:
          "Choose a new password for your Loqal account and get back to your real estate concierge dashboard.",
      },
      { property: "og:title", content: "Set a new password | Loqal" },
      {
        property: "og:description",
        content: "Choose a new password for your Loqal account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-brand";

function passwordIssues(pw: string): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push("At least 8 characters");
  if (!/[a-z]/.test(pw)) issues.push("One lowercase letter");
  if (!/[A-Z]/.test(pw)) issues.push("One uppercase letter");
  if (!/\d/.test(pw)) issues.push("One number");
  if (!/[^A-Za-z0-9]/.test(pw)) issues.push("One special character (!@#$…)");
  return issues;
}

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [linkValid, setLinkValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setLinkValid(true);
        setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setLinkValid(Boolean(data.session));
      setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const issues = passwordIssues(password);
    if (issues.length) return setError(`Your password still needs: ${issues.join(", ").toLowerCase()}.`);
    if (password !== confirm) return setError("The two passwords do not match.");
    setBusy(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(updateError.message);
    setDone(true);
    await supabase.auth.signOut();
    setTimeout(() => void navigate({ to: "/auth" }), 2200);
  }

  const checks = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[a-z]/.test(password), label: "One lowercase letter" },
    { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
    { ok: /\d/.test(password), label: "One number" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "One special character (!@#$…)" },
  ];

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>

        {!ready ? (
          <p className="mt-4 text-sm text-muted-foreground">Checking your reset link…</p>
        ) : done ? (
          <p className="mt-4 rounded-md bg-brand-tint px-3 py-2 text-sm text-brand">
            Your password has been updated. Taking you to the sign-in page…
          </p>
        ) : !linkValid ? (
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <p>
              This reset link is no longer valid — links expire after a short while and can be used
              only once.
            </p>
            <Link to="/auth" className="inline-block font-semibold text-brand">
              Request a new link
            </Link>
          </div>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </label>

            <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className={`flex items-center gap-1.5 text-xs ${
                    c.ok ? "text-emerald-600" : "text-muted-foreground"
                  }`}
                >
                  <span aria-hidden>{c.ok ? "✓" : "○"}</span>
                  {c.label}
                </li>
              ))}
            </ul>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Repeat new password
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </label>

            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand py-3 text-sm font-semibold text-background transition-colors hover:bg-brand-soft disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
